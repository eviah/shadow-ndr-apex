import axios from 'axios';

// נתוני דמה לדשבורד
const mockDashboardData = {
  success: true,
  data: {
    threats: { total: 47, critical: 12, active: 34, avg_score: 0.74 },
    assets: { total: 47, active: 35, degraded: 8, offline: 4, sensors: 23 },
    alerts: { total: 18, unacknowledged: 7 },
    topAttacks: [
      { threat_type: 'ADS-B Spoofing', count: 34, max_score: 0.96 },
      { threat_type: 'ACARS Injection', count: 22, max_score: 0.89 },
      { threat_type: 'GPS Jamming', count: 18, max_score: 0.78 },
      { threat_type: 'Mode S Hijack', count: 12, max_score: 0.94 },
      { threat_type: 'VDL Attack', count: 6, max_score: 0.82 }
    ],
    riskTop: [
      { entity_name: 'EL AL 747', risk_score: 95.4, threat_types: ['ADS-B Spoofing'] },
      { entity_name: 'Delta 123', risk_score: 87.2, threat_types: ['ACARS Injection'] },
      { entity_name: 'United 555', risk_score: 76.8, threat_types: ['GPS Jamming'] },
      { entity_name: 'Emirates 202', risk_score: 66.1, threat_types: ['Mode S Hijack'] },
      { entity_name: 'Lufthansa 400', risk_score: 44.3, threat_types: ['None'] }
    ],
    timeline: [
      { hour: '2026-03-29T08:00:00', count: 23, critical: 5, avg_score: 0.71 },
      { hour: '2026-03-29T09:00:00', count: 31, critical: 8, avg_score: 0.74 },
      { hour: '2026-03-29T10:00:00', count: 28, critical: 6, avg_score: 0.72 },
      { hour: '2026-03-29T11:00:00', count: 35, critical: 9, avg_score: 0.76 },
      { hour: '2026-03-29T12:00:00', count: 42, critical: 11, avg_score: 0.79 }
    ],
    recentAlerts: [
      { id: 1, title: 'Ghost aircraft on approach', severity: 'critical', source: 'ADS-B', detected_at: new Date().toISOString() },
      { id: 2, title: 'ACARS bomb threat keyword', severity: 'emergency', source: 'ACARS', detected_at: new Date().toISOString() },
      { id: 3, title: 'GPS interference detected', severity: 'high', source: 'GPS', detected_at: new Date().toISOString() }
    ],
    copilot: [
      { action: 'Patched SQL injection in adsb_parser.py', operator: 'security_bot', severity: 'high', timestamp: new Date().toISOString(), success: true },
      { action: 'Updated Modbus input validation', operator: 'automation', severity: 'medium', timestamp: new Date().toISOString(), success: true },
      { action: 'Blocked IP 172.16.8.9', operator: 'shadow_bot', severity: 'high', timestamp: new Date().toISOString(), success: true }
    ],
    systemMetrics: { packets_captured: 342000, p99_latency_ms: 4.2, avg_score: 0.74 },
    generatedAt: new Date().toISOString()
  }
};

// API פונקציות
export const getDashboard = async () => {
  // נסה להתחבר ל-Backend האמיתי, אם לא עובד - תחזיר דמה
  try {
    const response = await axios.get('/api/dashboard', { timeout: 2000 });
    return response.data;
  } catch (error) {
    console.log('⚠️ Backend not available, using mock data');
    return mockDashboardData;
  }
};

export const getThreats = async (params = {}) => {
  try {
    const response = await axios.get('/api/threats', { params });
    return response.data;
  } catch (error) {
    return { success: true, data: mockDashboardData.data.topAttacks, pagination: { total: 34 } };
  }
};

export const updateThreat = async (id, body) => {
  return { success: true };
};

export const blockIp = async (ip, reason) => {
  console.log(`Blocking IP: ${ip} - ${reason}`);
  return { success: true };
};

export default { getDashboard, getThreats, updateThreat, blockIp };