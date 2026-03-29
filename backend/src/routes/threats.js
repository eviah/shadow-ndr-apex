import { Router } from 'express';
import { db } from '../services/database.js';
import { kafkaService } from '../services/kafka.js';
import { z } from 'zod';

const router = Router();

const PaginationSchema = z.object({
  page:     z.coerce.number().min(1).default(1),
  limit:    z.coerce.number().min(1).max(200).default(50),
  severity: z.string().optional(),
  status:   z.string().optional(),
  from:     z.string().optional(),
  to:       z.string().optional(),
});

const CommandSchema = z.object({
  ip:       z.string().ip(),
  reason:   z.string().min(1).max(500),
  duration: z.number().min(60).max(86400).default(3600),
  action:   z.enum(['block','throttle','isolate']).default('block'),
});

router.get('/', async (req, res) => {
  const { page, limit, severity, status, from, to } = PaginationSchema.parse(req.query);
  const offset = (page - 1) * limit;

  const conditions = ['1=1'];
  const params = [];
  let pi = 1;
  if (severity) { conditions.push(`severity = $${pi++}`); params.push(severity); }
  if (status)   { conditions.push(`status   = $${pi++}`); params.push(status); }
  if (from)     { conditions.push(`detected_at >= $${pi++}`); params.push(new Date(from)); }
  if (to)       { conditions.push(`detected_at <= $${pi++}`); params.push(new Date(to)); }

  const where = conditions.join(' AND ');
  const [rows, count] = await Promise.all([
    db.query(`SELECT * FROM threats WHERE ${where} ORDER BY detected_at DESC LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, limit, offset]),
    db.query(`SELECT COUNT(*)::INT AS total FROM threats WHERE ${where}`, params),
  ]);

  res.json({ success: true, data: rows.rows, pagination: { page, limit, total: count.rows[0].total } });
});

router.get('/:id', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM threats WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ success: false, error: 'Threat not found' });
  res.json({ success: true, data: rows[0] });
});

router.patch('/:id/status', async (req, res) => {
  const { status } = z.object({ status: z.enum(['active','resolved','fp','investigating']) }).parse(req.body);
  const { rows } = await db.query(
    `UPDATE threats SET status=$1, resolved_at=CASE WHEN $1='resolved' THEN NOW() ELSE NULL END WHERE id=$2 RETURNING *`,
    [status, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, data: rows[0] });
});

router.post('/command/block', async (req, res) => {
  const command = CommandSchema.parse(req.body);
  await kafkaService.sendCommand({ type: 'BLOCK_IP', ...command });
  await db.query(
    `INSERT INTO copilot_activity (action, details, severity, category, operator) VALUES ($1,$2,$3,$4,$5)`,
    [`Blocked IP ${command.ip}`, command.reason, 'high', 'response', 'api']
  );
  res.json({ success: true, message: `${command.action.toUpperCase()} command sent for ${command.ip}` });
});

export default router;
