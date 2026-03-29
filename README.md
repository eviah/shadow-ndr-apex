# Shadow NDR APEX 922 – Command Center v2.0

## What's upgraded in v2.0

### Server
- Pino structured logging (JSON in prod, pretty in dev)
- Zod config validation (fails fast on bad env)
- PostgreSQL pool tuning (min/max, idle timeout, statement timeout, query tracing)
- Kafka: idempotent producer, concurrent partition consumers, automatic DLQ
- WebSocket: heartbeat, per-client timeout, subscription channels, reconnect stats
- Circuit breaker (opossum) on heavy DB dashboard query
- Rate limiting (express-rate-limit)
- Helmet + compression
- Graceful shutdown with 15s drain timeout
- uncaughtException / unhandledRejection handlers
- Health endpoint at /health with Kafka + DB status
- Metrics endpoint at /health/metrics

### Database
- UUID primary keys
- Strict CHECK constraints on enums
- TimescaleDB-ready schema (detected_at indexed DESC)
- v_threat_summary and v_top_attackers views
- system_metrics table + live insertion every 10s

### Frontend
- Military-grade dark ops aesthetic (Share Tech Mono + DM Sans)
- Scanline overlay, panel glow effects, status dots with pulse rings
- Animated metric cards, framer-motion transitions
- Chart.js dual-line timeline (threats + critical)
- Animated progress bars for attack families
- Live WebSocket events appear highlighted in alert table
- Auto-reconnecting WebSocket with exponential backoff

## Quick Start

```bash
# 1. Infrastructure
docker-compose up -d

# 2. Backend
cd backend && npm install && npm run dev

# 3. Frontend
cd frontend && npm install && npm run dev

# 4. Open
open http://localhost:3000
```

## Kafka Message Format
```json
{
  "type": "ADS-B Spoofing",
  "severity": "critical",
  "source_ip": "192.168.1.45",
  "dest_ip": "0.0.0.0",
  "icao24": "ABCDEF",
  "score": 0.96,
  "description": "Ghost aircraft detected",
  "timestamp": 1699123456789
}
```
