import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

class Database {
  constructor() {
    this._pool = null;
    this._connected = false;
  }

  get pool() {
    if (!this._pool) throw new Error('Database not initialized. Call connect() first.');
    return this._pool;
  }

  async connect() {
    this._pool = new Pool({
      host:               config.DB_HOST,
      port:               config.DB_PORT,
      user:               config.DB_USER,
      password:           config.DB_PASSWORD,
      database:           config.DB_NAME,
      min:                config.DB_POOL_MIN,
      max:                config.DB_POOL_MAX,
      idleTimeoutMillis:  config.DB_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: config.DB_CONNECT_TIMEOUT_MS,
      statement_timeout:  config.DB_STATEMENT_TIMEOUT_MS,
      application_name:   'shadow-ndr-apex',
    });

    this._pool.on('connect', () => logger.debug('DB pool: new client connected'));
    this._pool.on('error', (err) => logger.error({ err }, 'DB pool error'));

    // Verify connection
    const client = await this._pool.connect();
    const { rows } = await client.query('SELECT current_database(), NOW()');
    client.release();
    this._connected = true;
    logger.info({ db: rows[0].current_database }, '✅ PostgreSQL connected');
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this._pool.query(text, params);
      logger.debug({ query: text.substring(0, 80), ms: Date.now() - start, rows: result.rowCount }, 'sql');
      return result;
    } catch (err) {
      logger.error({ query: text.substring(0, 80), err: err.message }, 'sql error');
      throw err;
    }
  }

  async transaction(fn) {
    const client = await this._pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async healthCheck() {
    try {
      const { rows } = await this.query('SELECT 1 AS ok');
      return { healthy: rows[0].ok === 1, pool: {
        total: this._pool.totalCount,
        idle:  this._pool.idleCount,
        waiting: this._pool.waitingCount,
      }};
    } catch {
      return { healthy: false };
    }
  }

  async disconnect() {
    if (this._pool) {
      await this._pool.end();
      logger.info('PostgreSQL pool closed');
    }
  }
}

export const db = new Database();
