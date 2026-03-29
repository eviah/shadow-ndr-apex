/**
 * Shadow NDR APEX 922 – Production Server v2.0
 * ═══════════════════════════════════════════════
 * • Pino structured logging
 * • Zod-validated env config
 * • PostgreSQL connection pool (pg-pool, circuit breaker)
 * • Kafka producer (idempotent) + consumer (concurrent partitions + DLQ)
 * • WebSocket manager (heartbeat, subscriptions, per-client timeout)
 * • Redis for session/cache (ioredis)
 * • Helmet + compression + rate limiting
 * • Circuit breaker on heavy DB aggregations (opossum)
 * • Graceful shutdown (SIGTERM/SIGINT) with 15s drain timeout
 * • Health + metrics endpoints
 */

import 'express-async-errors';
import express from 'express';
import { createServer } from 'http';
import { config } from './config/index.js';
import { logger, httpLogger } from './utils/logger.js';
import { securityMiddleware, errorHandler, notFoundHandler } from './middleware/index.js';
import { db }           from './services/database.js';
import { kafkaService } from './services/kafka.js';
import { wsManager }    from './services/websocket.js';

import dashboardRouter from './routes/dashboard.js';
import threatsRouter   from './routes/threats.js';
import healthRouter    from './routes/health.js';

// ─── App Setup ────────────────────────────────────────────────────────────────

const app    = express();
const server = createServer(app);

app.set('trust proxy', 1);
app.use(securityMiddleware);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(httpLogger);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/dashboard', dashboardRouter);
app.use('/api/threats',   threatsRouter);
app.use('/health',        healthRouter);

app.get('/', (req, res) => {
  res.json({
    name:    'Shadow NDR APEX 922',
    version: '2.0.0',
    status:  'operational',
    docs:    '/health',
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

// ─── WebSocket ────────────────────────────────────────────────────────────────

wsManager.attach(server);

// ─── Startup Sequence ─────────────────────────────────────────────────────────

async function start() {
  try {
    logger.info('Starting Shadow NDR APEX 922...');

    // 1. Database
    await db.connect();

    // 2. Kafka
    await kafkaService.connect();
    kafkaService.startConsumer().catch((err) => {
      logger.error({ err }, 'Kafka consumer fatal error');
    });

    // 3. HTTP Server
    await new Promise((resolve, reject) => {
      server.listen(config.PORT, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    logger.info({
      port:  config.PORT,
      env:   config.NODE_ENV,
      pid:   process.pid,
    }, `🚀 Shadow NDR APEX 922 is LIVE`);

    // 4. Simulate live metric updates every 10s
    setInterval(async () => {
      try {
        await db.query(
          `INSERT INTO system_metrics
             (packets_captured, packets_anomalous, avg_score, p99_latency_ms, active_streams)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            Math.floor(300000 + Math.random() * 100000),
            Math.floor(3000   + Math.random() * 3000),
            parseFloat((0.60  + Math.random() * 0.30).toFixed(3)),
            parseFloat((2.5   + Math.random() * 5.0).toFixed(2)),
            Math.floor(5 + Math.random() * 10),
          ]
        );
        // Broadcast live metrics to connected clients
        const { rows } = await db.query(
          `SELECT * FROM system_metrics ORDER BY recorded_at DESC LIMIT 1`
        );
        wsManager.broadcast({ event: 'metrics_update', data: rows[0] }, 'metrics');
      } catch { /* non-fatal */ }
    }, 10_000);

  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown initiated...');

  // Stop accepting new connections
  server.close();

  // Wait up to 15s for in-flight requests
  const drain = new Promise(resolve => setTimeout(resolve, 15_000));

  try {
    await Promise.race([
      Promise.all([
        wsManager.shutdown(),
        kafkaService.disconnect(),
        db.disconnect(),
      ]),
      drain,
    ]);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  shutdown('unhandledRejection');
});

start();
