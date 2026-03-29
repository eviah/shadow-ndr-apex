import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const schema = z.object({
  NODE_ENV:                  z.enum(['development','production','test']).default('development'),
  PORT:                      z.coerce.number().default(3001),
  LOG_LEVEL:                 z.string().default('info'),
  DB_HOST:                   z.string(),
  DB_PORT:                   z.coerce.number().default(5432),
  DB_USER:                   z.string(),
  DB_PASSWORD:               z.string(),
  DB_NAME:                   z.string(),
  DB_POOL_MIN:               z.coerce.number().default(2),
  DB_POOL_MAX:               z.coerce.number().default(20),
  DB_IDLE_TIMEOUT_MS:        z.coerce.number().default(30000),
  DB_CONNECT_TIMEOUT_MS:     z.coerce.number().default(5000),
  DB_STATEMENT_TIMEOUT_MS:   z.coerce.number().default(10000),
  KAFKA_BROKERS:             z.string(),
  KAFKA_CLIENT_ID:           z.string().default('shadow-ndr-apex'),
  KAFKA_GROUP_ID:            z.string().default('shadow-ui-group'),
  KAFKA_TOPIC_THREATS:       z.string().default('shadow.threats'),
  KAFKA_TOPIC_COMMANDS:      z.string().default('shadow.commands'),
  KAFKA_TOPIC_DLQ:           z.string().default('shadow.dlq'),
  REDIS_URL:                 z.string().default('redis://localhost:6379'),
  CORS_ORIGINS:              z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS:      z.coerce.number().default(60000),
  RATE_LIMIT_MAX:            z.coerce.number().default(500),
  WS_HEARTBEAT_INTERVAL_MS:  z.coerce.number().default(30000),
  WS_CLIENT_TIMEOUT_MS:      z.coerce.number().default(90000),
  CB_THRESHOLD:              z.coerce.number().default(5),
  CB_TIMEOUT_MS:             z.coerce.number().default(10000),
  CB_RESET_MS:               z.coerce.number().default(30000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
