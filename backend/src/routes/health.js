import { Router } from 'express';
import { db } from '../services/database.js';
import { kafkaService } from '../services/kafka.js';
import { wsManager } from '../services/websocket.js';

const router = Router();

router.get('/', async (req, res) => {
  const [dbHealth, kafkaHealth] = await Promise.allSettled([
    db.healthCheck(),
    kafkaService.healthCheck(),
  ]);

  const healthy =
    dbHealth.status    === 'fulfilled' && dbHealth.value.healthy &&
    kafkaHealth.status === 'fulfilled' && kafkaHealth.value.healthy;

  res.status(healthy ? 200 : 503).json({
    status:    healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth.status === 'fulfilled' ? dbHealth.value : { healthy: false },
      kafka:    kafkaHealth.status === 'fulfilled' ? kafkaHealth.value : { healthy: false },
      websocket: wsManager.getStats(),
    },
  });
});

router.get('/metrics', async (req, res) => {
  res.json({
    kafka:     kafkaService.getStats(),
    websocket: wsManager.getStats(),
    process: {
      uptime:       Math.floor(process.uptime()),
      memory:       process.memoryUsage(),
      cpuUsage:     process.cpuUsage(),
      nodeVersion:  process.version,
    },
  });
});

export default router;
