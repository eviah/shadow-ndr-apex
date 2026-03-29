import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  transport: config.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
    : undefined,
  base: { service: 'shadow-ndr-apex' },
  redact: ['password', 'DB_PASSWORD', 'authorization'],
});

export const httpLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method, url: req.url,
      status: res.statusCode, ms: Date.now() - start,
    }, 'http');
  });
  next();
};
