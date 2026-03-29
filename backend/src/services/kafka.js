import { Kafka, logLevel } from 'kafkajs';
import pRetry from 'p-retry';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { db } from './database.js';
import { wsManager } from './websocket.js';

class KafkaService {
  constructor() {
    this._kafka = new Kafka({
      clientId: config.KAFKA_CLIENT_ID,
      brokers:  config.KAFKA_BROKERS.split(','),
      logLevel: logLevel.WARN,
      retry: {
        retries:      parseInt(config.KAFKA_RETRY_ATTEMPTS),
        initialRetryTime: parseInt(config.KAFKA_RETRY_INITIAL_DELAY_MS),
        factor: 2,
        multiplier: 1.5,
        maxRetryTime: 30_000,
      },
    });
    this._producer = null;
    this._consumer = null;
    this._dlqProducer = null;
    this._running = false;
    this._stats = { produced: 0, consumed: 0, errors: 0, dlq: 0 };
  }

  async connect() {
    this._producer = this._kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30_000,
      idempotent: true,
    });
    this._consumer = this._kafka.consumer({
      groupId: config.KAFKA_GROUP_ID,
      sessionTimeout: 30_000,
      heartbeatInterval: 3_000,
      maxBytesPerPartition: 1_048_576,
      retry: { retries: 5 },
    });

    await this._producer.connect();
    logger.info('✅ Kafka producer connected');
  }

  async startConsumer() {
    await this._consumer.connect();
    await this._consumer.subscribe({
      topics: [config.KAFKA_TOPIC_THREATS],
      fromBeginning: false,
    });

    this._running = true;
    await this._consumer.run({
      partitionsConsumedConcurrently: 3,
      eachMessage: async ({ topic, partition, message }) => {
        const value = message.value?.toString();
        if (!value) return;

        await pRetry(
          async () => this._processMessage(value),
          {
            retries: 3,
            onFailedAttempt: (err) => {
              logger.warn({ attempt: err.attemptNumber, err: err.message }, 'Kafka message processing retry');
            },
          }
        ).catch(async (err) => {
          // Send to DLQ after exhausting retries
          this._stats.dlq++;
          logger.error({ err: err.message }, 'Sending message to DLQ');
          await this._sendToDLQ(value, err.message).catch(() => {});
        });
      },
    });

    logger.info({ topic: config.KAFKA_TOPIC_THREATS }, '✅ Kafka consumer started');
  }

  async _processMessage(raw) {
    const threat = JSON.parse(raw);
    this._stats.consumed++;

    // Validate required fields
    if (!threat.type || !threat.severity) {
      throw new Error(`Invalid message: missing type or severity`);
    }

    // Persist to database
    const { rows } = await db.query(
      `INSERT INTO threats
         (threat_type, severity, source_ip, dest_ip, icao24, score, description, raw_features, detector_scores, detected_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, detected_at`,
      [
        threat.type, threat.severity,
        threat.source_ip || threat.source || null,
        threat.dest_ip   || null,
        threat.icao24    || null,
        threat.score     || 0.5,
        threat.description || threat.desc || '',
        threat.features  ? JSON.stringify(threat.features)         : null,
        threat.detectors ? JSON.stringify(threat.detectors)        : null,
        threat.timestamp ? new Date(threat.timestamp) : new Date(),
      ]
    );

    // Broadcast to all WebSocket clients
    wsManager.broadcast({
      event: 'new_threat',
      data: { ...threat, id: rows[0].id, detected_at: rows[0].detected_at },
    });

    // If critical/emergency → also create alert
    if (['critical','emergency'].includes(threat.severity)) {
      await db.query(
        `INSERT INTO alerts (title, severity, source, threat_id) VALUES ($1,$2,$3,$4)`,
        [
          `[AUTO] ${threat.type} – ${threat.source_ip || 'unknown'}`,
          threat.severity, threat.type, rows[0].id,
        ]
      );
      wsManager.broadcast({ event: 'new_alert', data: { severity: threat.severity, type: threat.type } });
    }
  }

  async _sendToDLQ(raw, errorMessage) {
    await this._producer.send({
      topic: config.KAFKA_TOPIC_DLQ,
      messages: [{ value: JSON.stringify({ raw, error: errorMessage, ts: Date.now() }) }],
    });
  }

  async sendCommand(command) {
    const result = await this._producer.send({
      topic: config.KAFKA_TOPIC_COMMANDS,
      messages: [{ key: command.type, value: JSON.stringify({ ...command, timestamp: Date.now() }) }],
    });
    this._stats.produced++;
    return result;
  }

  async disconnect() {
    this._running = false;
    await this._consumer?.disconnect();
    await this._producer?.disconnect();
    logger.info('Kafka disconnected');
  }

  getStats() { return { ...this._stats }; }

  async healthCheck() {
    try {
      const admin = this._kafka.admin();
      await admin.connect();
      const topics = await admin.listTopics();
      await admin.disconnect();
      return { healthy: true, topics: topics.length };
    } catch {
      return { healthy: false };
    }
  }
}

export const kafkaService = new KafkaService();
