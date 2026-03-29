-- Seed data
INSERT INTO assets (name, asset_type, status, ip_address, location, criticality) VALUES
('ADS-B Sensor TLV-1',     'adsb_sensor',   'active',    '192.168.10.11', 'Terminal A', 0.95),
('ADS-B Sensor TLV-2',     'adsb_sensor',   'active',    '192.168.10.12', 'Terminal B', 0.95),
('ACARS Gateway Primary',  'gateway',        'active',    '192.168.20.1',  'ATC Tower',  0.98),
('ACARS Gateway Backup',   'gateway',        'degraded',  '192.168.20.2',  'ATC Tower',  0.90),
('Mode S Monitor Alpha',   'adsb_sensor',   'degraded',  '192.168.10.21', 'Runway 28R', 0.85),
('VDL Ground Station 1',   'ground_station', 'active',   '10.10.5.1',     'South Apron',0.88),
('CPDLC Controller Main',  'controller',    'active',    '10.10.1.5',     'ATC Main',   0.99),
('GPS Reference Station',  'gps',           'active',    '10.10.3.1',     'Roof',       0.92),
('Network TAP - Core',     'tap',           'active',    '192.168.1.254', 'Server Room',0.80),
('Firewall Perimeter',     'firewall',      'active',    '10.0.0.1',      'DMZ',        0.97);

INSERT INTO threats (threat_type, severity, source_ip, dest_ip, icao24, score, description, status) VALUES
('ADS-B Spoofing',       'critical',  '192.168.1.45',   '0.0.0.0',       'ABCDEF', 0.96, 'Ghost aircraft injected with ICAO 0xABCDEF near approach', 'active'),
('ACARS Injection',      'high',      '10.0.0.23',      '192.168.20.1',  NULL,     0.87, 'Unauthorised uplink TELEX H1 – keyword bomb detected',   'investigating'),
('GPS Jamming',          'medium',    '172.16.8.9',     NULL,             NULL,     0.71, 'Signal degradation on 3 GPS receivers simultaneously',    'active'),
('Mode S Hijack',        'critical',  '192.168.10.200', NULL,             'FF1234', 0.94, 'Squawk 7500 detected on non-emergency flight',            'active'),
('VDL Frame Injection',  'high',      '10.10.10.5',     '10.10.5.1',     NULL,     0.82, 'Malformed X.25 frame targeting VDL ground station',       'active'),
('Radar Jamming',        'emergency', '172.16.0.50',    NULL,             NULL,     0.98, 'Primary radar return masked – wide-area jamming suspected','active'),
('CPDLC Spoofing',       'critical',  '10.10.1.99',     '10.10.1.5',     NULL,     0.91, 'Fake ATC clearance issued via CPDLC channel',             'active');

INSERT INTO alerts (title, severity, source) VALUES
('Ghost aircraft on final approach – squawk mismatch',  'critical',  'ADS-B'),
('ACARS message contains threat keyword [bomb]',        'emergency', 'ACARS'),
('GPS interference – 3 receivers degraded',             'high',      'GPS'),
('Primary radar return masked – jamming suspected',     'emergency', 'Radar'),
('CPDLC clearance mismatch – possible spoofing',        'critical',  'CPDLC');

INSERT INTO risk_scores (entity_name, entity_type, risk_score, threat_types) VALUES
('EL AL 747 – LY001',  'aircraft', 95.4, ARRAY['ADS-B Spoofing']),
('Delta DAL-123',       'aircraft', 87.2, ARRAY['ACARS Injection']),
('United UAL-555',      'aircraft', 76.8, ARRAY['GPS Jamming']),
('Emirates EK-202',     'aircraft', 66.1, ARRAY['Mode S Hijack']),
('Lufthansa DLH-400',   'aircraft', 44.3, ARRAY['None']);

INSERT INTO copilot_activity (action, details, severity, category, success, duration_ms) VALUES
('Patched SQL injection in adsb_parser.py',            'Fixed parameter binding in query builder',          'high',   'vuln_fix',  TRUE, 1240),
('Updated Modbus input validation rules',              'Added boundary checks for register addresses',      'medium', 'hardening', TRUE, 890),
('Blocked IP 172.16.8.9 – GPS jamming source',         'Automated block via RL agent ISOLATE action',      'high',   'response',  TRUE, 45),
('Rotated ATC communication encryption keys',          'Quarterly key rotation completed successfully',     'info',   'crypto',    TRUE, 3200),
('Deployed ACARS anomaly model v12.3',                 'New contrastive model – 23% fewer false positives', 'info',   'ml_update', TRUE, 8900);
