import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class WebSocketManager {
  constructor() {
    this._wss = null;
    this._clients = new Map();   // id → { ws, lastPong, subscriptions }
    this._heartbeatTimer = null;
    this._stats = { connections: 0, messages_sent: 0, messages_received: 0 };
  }

  attach(server) {
    this._wss = new WebSocketServer({ server, path: '/ws' });

    this._wss.on('connection', (ws, req) => {
      const id = uuid();
      const ip = req.socket.remoteAddress;

      this._clients.set(id, { ws, lastPong: Date.now(), subscriptions: new Set(['all']) });
      this._stats.connections++;

      logger.info({ clientId: id, ip }, 'WS client connected');

      // Send welcome + current stats immediately
      this._sendTo(id, { event: 'connected', data: { clientId: id, serverTime: new Date().toISOString() } });

      ws.on('pong', () => {
        const client = this._clients.get(id);
        if (client) client.lastPong = Date.now();
      });

      ws.on('message', (raw) => {
        this._stats.messages_received++;
        try {
          const msg = JSON.parse(raw.toString());
          this._handleClientMessage(id, msg);
        } catch {
          this._sendTo(id, { event: 'error', data: 'Invalid JSON' });
        }
      });

      ws.on('close', (code, reason) => {
        this._clients.delete(id);
        logger.info({ clientId: id, code, reason: reason.toString() }, 'WS client disconnected');
      });

      ws.on('error', (err) => {
        logger.warn({ clientId: id, err: err.message }, 'WS client error');
        this._clients.delete(id);
      });
    });

    this._startHeartbeat();
    logger.info('✅ WebSocket server attached (path: /ws)');
  }

  _handleClientMessage(id, msg) {
    switch (msg.type) {
      case 'subscribe':
        const client = this._clients.get(id);
        if (client && msg.channels) {
          msg.channels.forEach(ch => client.subscriptions.add(ch));
          this._sendTo(id, { event: 'subscribed', data: { channels: [...client.subscriptions] } });
        }
        break;
      case 'ping':
        this._sendTo(id, { event: 'pong', data: { ts: Date.now() } });
        break;
      default:
        logger.debug({ clientId: id, type: msg.type }, 'WS unknown message type');
    }
  }

  broadcast(payload, channel = 'all') {
    const data = JSON.stringify(payload);
    let sent = 0;
    this._clients.forEach(({ ws, subscriptions }, id) => {
      if (ws.readyState === WebSocket.OPEN &&
          (subscriptions.has(channel) || subscriptions.has('all'))) {
        ws.send(data);
        sent++;
        this._stats.messages_sent++;
      }
    });
    return sent;
  }

  _sendTo(id, payload) {
    const client = this._clients.get(id);
    if (client?.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(payload));
      this._stats.messages_sent++;
    }
  }

  _startHeartbeat() {
    this._heartbeatTimer = setInterval(() => {
      const now = Date.now();
      this._clients.forEach(({ ws, lastPong }, id) => {
        if (now - lastPong > config.WS_CLIENT_TIMEOUT_MS) {
          logger.warn({ clientId: id }, 'WS client timed out – terminating');
          ws.terminate();
          this._clients.delete(id);
          return;
        }
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      });
    }, config.WS_HEARTBEAT_INTERVAL_MS);
  }

  getStats() {
    return { ...this._stats, activeClients: this._clients.size };
  }

  async shutdown() {
    clearInterval(this._heartbeatTimer);
    this._clients.forEach(({ ws }) => ws.terminate());
    this._clients.clear();
    await new Promise(resolve => this._wss.close(resolve));
    logger.info('WebSocket server closed');
  }
}

export const wsManager = new WebSocketManager();
