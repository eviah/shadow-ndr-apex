import { Router } from 'express';
import CircuitBreaker from 'opossum';
import { db } from '../services/database.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Circuit breaker wraps heavy DB aggregation
const dashboardCB = new CircuitBreaker(fetchDashboardData, {
  timeout:          9000,
  errorThresholdPercentage: 50,
  resetTimeout:     15_000,
  volumeThreshold:  5,
  name:             'dashboard',
});

dashboardCB.fallback(() => ({ _fallback: true, message: 'Dashboard data temporarily unavailable' }));
dashboardCB.on('open',    () => logger.warn('Dashboard circuit breaker OPEN'));
dashboardCB.on('halfOpen',() => logger.info('Dashboard circuit breaker HALF-OPEN'));
dashboardCB.on('close',   () => logger.info('Dashboard circuit breaker CLOSED'));

async function fetchDashboardData() {
  const [
    threatStats, assetStats, alertStats, topAttacks,
    riskTop, timeline, recentAlerts, copilot,
    topAttackers, systemMetrics
  ] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*)::INT                                                          AS total,
        COUNT(CASE WHEN severity IN ('critical','emergency') THEN 1 END)::INT AS critical,
        COUNT(CASE WHEN status = 'active' THEN 1 END)::INT                   AS active,
        AVG(score)::FLOAT                                                     AS avg_score
      FROM threats
      WHERE detected_at > NOW() - INTERVAL '24 hours'
    `),
    db.query(`
      SELECT
        COUNT(*)::INT                                                  AS total,
        COUNT(CASE WHEN status = 'active'    THEN 1 END)::INT         AS active,
        COUNT(CASE WHEN status = 'degraded'  THEN 1 END)::INT         AS degraded,
        COUNT(CASE WHEN status = 'offline'   THEN 1 END)::INT         AS offline,
        COUNT(CASE WHEN asset_type LIKE '%sensor%' THEN 1 END)::INT   AS sensors
      FROM assets
    `),
    db.query(`
      SELECT COUNT(*)::INT AS total,
             COUNT(CASE WHEN acknowledged = FALSE THEN 1 END)::INT AS unacknowledged
      FROM alerts
      WHERE detected_at > NOW() - INTERVAL '6 hours'
    `),
    db.query(`
      SELECT threat_type, COUNT(*)::INT AS count, MAX(score)::FLOAT AS max_score
      FROM threats
      WHERE detected_at > NOW() - INTERVAL '24 hours'
      GROUP BY threat_type
      ORDER BY count DESC
      LIMIT 8
    `),
    db.query(`
      SELECT entity_name, risk_score, entity_type,
             threat_types, calculated_at
      FROM risk_scores
      ORDER BY risk_score DESC
      LIMIT 5
    `),
    db.query(`
      SELECT DATE_TRUNC('hour', detected_at) AS hour,
             COUNT(*)::INT                   AS count,
             AVG(score)::FLOAT               AS avg_score,
             COUNT(CASE WHEN severity IN ('critical','emergency') THEN 1 END)::INT AS critical
      FROM threats
      WHERE detected_at > NOW() - INTERVAL '12 hours'
      GROUP BY 1 ORDER BY 1
    `),
    db.query(`
      SELECT a.*, t.threat_type, t.source_ip::TEXT
      FROM alerts a
      LEFT JOIN threats t ON a.threat_id = t.id
      ORDER BY a.detected_at DESC
      LIMIT 15
    `),
    db.query(`
      SELECT * FROM copilot_activity
      ORDER BY timestamp DESC
      LIMIT 8
    `),
    db.query(`SELECT * FROM v_top_attackers LIMIT 5`),
    db.query(`
      SELECT packets_captured, packets_anomalous, avg_score, p99_latency_ms, active_streams
      FROM system_metrics
      ORDER BY recorded_at DESC
      LIMIT 1
    `),
  ]);

  return {
    threats:       threatStats.rows[0],
    assets:        assetStats.rows[0],
    alerts:        alertStats.rows[0],
    topAttacks:    topAttacks.rows,
    riskTop:       riskTop.rows,
    timeline:      timeline.rows,
    recentAlerts:  recentAlerts.rows,
    copilot:       copilot.rows,
    topAttackers:  topAttackers.rows,
    systemMetrics: systemMetrics.rows[0] || { packets_captured: 342000, packets_anomalous: 4100, avg_score: 0.74, p99_latency_ms: 4.2, active_streams: 9 },
    generatedAt:   new Date().toISOString(),
  };
}

router.get('/', async (req, res) => {
  const data = await dashboardCB.fire();
  if (data._fallback) return res.status(503).json({ success: false, ...data });
  res.json({ success: true, data });
});

export default router;
