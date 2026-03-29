import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export const securityMiddleware = [
  helmet({ contentSecurityPolicy: false }),
  compression(),
  cors({
    origin: config.CORS_ORIGINS.split(',').map(o => o.trim()),
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','X-Request-ID'],
    credentials: true,
  }),
  rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max:      config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders:   false,
    handler: (req, res) => {
      logger.warn({ ip: req.ip, url: req.url }, 'Rate limit hit');
      res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000) });
    },
  }),
];

export const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  logger.error({ err: err.message, stack: err.stack, url: req.url, method: req.method }, 'Unhandled error');
  res.status(status).json({
    error: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(config.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
};
