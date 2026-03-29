-- Shadow NDR PostgreSQL Schema v2.0
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Threats table with TimescaleDB-ready partitioning by day
CREATE TABLE IF NOT EXISTS threats (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_type VARCHAR(100)     NOT NULL,
    severity    VARCHAR(20)      NOT NULL CHECK (severity IN ('info','low','medium','high','critical','emergency')),
    source_ip   INET,
    dest_ip     INET,
    icao24      VARCHAR(10),
    protocol    VARCHAR(20),
    score       FLOAT            CHECK (score BETWEEN 0 AND 1),
    description TEXT,
    raw_features JSONB,
    detector_scores JSONB,
    status      VARCHAR(20)      DEFAULT 'active' CHECK (status IN ('active','resolved','fp','investigating')),
    assigned_to VARCHAR(100),
    detected_at TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    tags        TEXT[]
);

CREATE INDEX idx_threats_detected_at ON threats (detected_at DESC);
CREATE INDEX idx_threats_severity    ON threats (severity);
CREATE INDEX idx_threats_status      ON threats (status);
CREATE INDEX idx_threats_icao24      ON threats (icao24) WHERE icao24 IS NOT NULL;
CREATE INDEX idx_threats_score       ON threats (score DESC);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title        VARCHAR(300)  NOT NULL,
    severity     VARCHAR(20)   NOT NULL,
    source       VARCHAR(100),
    threat_id    UUID          REFERENCES threats(id) ON DELETE SET NULL,
    acknowledged BOOLEAN       DEFAULT FALSE,
    ack_by       VARCHAR(100),
    ack_at       TIMESTAMPTZ,
    detected_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_alerts_detected_at ON alerts (detected_at DESC);
CREATE INDEX idx_alerts_ack         ON alerts (acknowledged);

-- Assets (sensors, gateways, aircraft, etc.)
CREATE TABLE IF NOT EXISTS assets (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(150)  NOT NULL,
    asset_type    VARCHAR(50)   NOT NULL,
    status        VARCHAR(20)   DEFAULT 'active' CHECK (status IN ('active','degraded','offline','compromised')),
    ip_address    INET,
    location      VARCHAR(100),
    criticality   FLOAT         DEFAULT 0.5 CHECK (criticality BETWEEN 0 AND 1),
    last_seen     TIMESTAMPTZ,
    metadata      JSONB,
    created_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- Risk scores (time-series)
CREATE TABLE IF NOT EXISTS risk_scores (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id     UUID,
    entity_name   VARCHAR(150)  NOT NULL,
    entity_type   VARCHAR(50),
    risk_score    FLOAT         NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    threat_types  TEXT[],
    calculated_at TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_risk_entity_time ON risk_scores (entity_name, calculated_at DESC);

-- Copilot audit log
CREATE TABLE IF NOT EXISTS copilot_activity (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action      VARCHAR(300)  NOT NULL,
    details     TEXT,
    severity    VARCHAR(20)   DEFAULT 'info',
    category    VARCHAR(50),
    operator    VARCHAR(100)  DEFAULT 'shadow_bot',
    success     BOOLEAN       DEFAULT TRUE,
    duration_ms INTEGER,
    timestamp   TIMESTAMPTZ   DEFAULT NOW()
);

-- Defense actions taken by RL agent
CREATE TABLE IF NOT EXISTS defense_actions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_id    UUID          REFERENCES threats(id) ON DELETE CASCADE,
    action       VARCHAR(50)   NOT NULL,
    target       VARCHAR(200),
    confidence   FLOAT,
    reward       FLOAT,
    confirmed    BOOLEAN,
    applied_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- System metrics (rolling)
CREATE TABLE IF NOT EXISTS system_metrics (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    packets_captured BIGINT    DEFAULT 0,
    packets_anomalous BIGINT   DEFAULT 0,
    avg_score        FLOAT,
    p99_latency_ms   FLOAT,
    active_streams   INT,
    recorded_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Views
CREATE OR REPLACE VIEW v_threat_summary AS
SELECT
    DATE_TRUNC('hour', detected_at) AS hour,
    COUNT(*)                         AS total,
    COUNT(CASE WHEN severity = 'critical'  THEN 1 END) AS critical,
    COUNT(CASE WHEN severity = 'emergency' THEN 1 END) AS emergency,
    AVG(score)                       AS avg_score
FROM threats
WHERE detected_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1;

CREATE OR REPLACE VIEW v_top_attackers AS
SELECT
    source_ip::TEXT AS source_ip,
    COUNT(*)         AS attack_count,
    MAX(score)       AS max_score,
    ARRAY_AGG(DISTINCT threat_type) AS attack_types
FROM threats
WHERE detected_at > NOW() - INTERVAL '24 hours'
  AND source_ip IS NOT NULL
GROUP BY source_ip
ORDER BY attack_count DESC
LIMIT 10;
