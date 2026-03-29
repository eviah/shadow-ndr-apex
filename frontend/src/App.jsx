import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
         BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { getDashboard, getThreats, blockIp } from './api/index.js';
import { useWebSocket } from './hooks/useWebSocket.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler);

// ─── Severity helpers ─────────────────────────────────────────────────────────
const SEV_COLOR = {
  emergency: '#ff1744', critical: '#ff4569', high: '#ff9b2b',
  medium: '#ffd600', low: '#00e676', info: '#00e5ff',
};
function SeverityBadge({ s }) {
  return <span className={`badge badge-${s}`}>{s}</span>;
}

// ─── Status Indicator ─────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const cls = status === 'active' ? 'active' : status === 'degraded' ? 'warn' : 'danger';
  return <span className={`status-dot ${cls}`}/>;
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
function TopBar({ wsStatus, now }) {
  const wsColor = wsStatus === 'connected' ? 'text-shadow-ok' : wsStatus === 'reconnecting' ? 'text-shadow-warn' : 'text-shadow-danger';
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
      style={{ background: 'linear-gradient(90deg, #04060f 0%, #080c1a 100%)', borderBottom: '1px solid #1a2340' }}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #00e5ff22, #7c4dff22)', border: '1px solid #00e5ff44' }}>
            <i className="fas fa-shield-halved text-shadow-accent text-sm"/>
          </div>
          <span className="font-display text-shadow-accent text-lg tracking-widest">SHADOW NDR</span>
          <span className="text-xs text-gray-600 font-body tracking-widest">APEX 922</span>
        </div>
        <div className="h-4 w-px bg-shadow-border"/>
        <span className={`text-xs mono flex items-center gap-1.5 ${wsColor}`}>
          <span className={`status-dot ${wsStatus === 'connected' ? 'active' : 'warn'}`} style={{width:6,height:6}}/>
          {wsStatus.toUpperCase()}
        </span>
      </div>
      <div className="flex items-center gap-6 text-xs mono text-gray-500">
        <span>{now.toUTCString().replace('GMT','UTC').slice(0,-4)}</span>
        <span className="text-shadow-accent">▸ OPERATIONAL</span>
      </div>
    </header>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon, color, glow, delta }) {
  return (
    <motion.div whileHover={{ y: -2 }} className="panel p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs mono text-gray-500 tracking-widest uppercase">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}44` }}>
          <i className={`fas fa-${icon} text-xs`} style={{ color }}/>
        </div>
      </div>
      <div>
        <div className="text-3xl font-body font-semibold" style={{ color }}>{value}</div>
        {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
      </div>
      {delta !== undefined && (
        <div className={`text-xs flex items-center gap-1 ${delta > 0 ? 'text-shadow-danger' : 'text-shadow-ok'}`}>
          <i className={`fas fa-arrow-${delta > 0 ? 'up' : 'down'} text-[10px]`}/>
          {Math.abs(delta)}% vs last hour
        </div>
      )}
    </motion.div>
  );
}

// ─── Timeline Chart ───────────────────────────────────────────────────────────
const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
  plugins: { legend: { display: false }, tooltip: {
    backgroundColor: '#0c1226', borderColor: '#1a2340', borderWidth: 1,
    titleColor: '#00e5ff', bodyColor: '#9ca3af',
  }},
  scales: {
    x: { ticks: { color: '#4b5563', font: { family: 'Share Tech Mono', size: 10 } }, grid: { color: '#1a2340' } },
    y: { ticks: { color: '#4b5563', font: { family: 'Share Tech Mono', size: 10 } }, grid: { color: '#1a2340' } },
  },
};

function TimelineChart({ data }) {
  const labels  = (data || []).map(d => new Date(d.hour).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }));
  const total   = (data || []).map(d => d.count);
  const crit    = (data || []).map(d => d.critical);
  const chartData = {
    labels,
    datasets: [
      { label: 'All Threats', data: total, borderColor: '#00e5ff', backgroundColor: 'rgba(0,229,255,0.08)',
        fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#00e5ff', borderWidth: 1.5 },
      { label: 'Critical', data: crit, borderColor: '#ff1744', backgroundColor: 'rgba(255,23,68,0.08)',
        fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#ff1744', borderWidth: 1.5 },
    ],
  };
  return (
    <div className="panel p-5 flex flex-col gap-4" style={{ height: 260 }}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs mono text-shadow-accent tracking-widest uppercase">Threat Timeline – 12h</h3>
        <div className="flex gap-4 text-xs mono text-gray-600">
          <span className="flex items-center gap-1.5"><span className="w-2 h-px bg-shadow-accent inline-block"/>All</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-px bg-shadow-danger inline-block"/>Critical</span>
        </div>
      </div>
      <div className="flex-1"><Line data={chartData} options={CHART_OPTS}/></div>
    </div>
  );
}

// ─── Attack Distribution ──────────────────────────────────────────────────────
function AttackBar({ attacks }) {
  if (!attacks?.length) return null;
  const max = Math.max(...attacks.map(a => a.count), 1);
  return (
    <div className="panel p-5 flex flex-col gap-4">
      <h3 className="text-xs mono text-shadow-accent tracking-widest uppercase">Attack Families – 24h</h3>
      <div className="space-y-3">
        {attacks.map((a, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400 font-body">{a.threat_type}</span>
              <span className="mono text-shadow-accent">{a.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-shadow-border overflow-hidden">
              <motion.div className="h-full rounded-full"
                initial={{ width: 0 }} animate={{ width: `${(a.count / max) * 100}%` }}
                transition={{ delay: i * 0.05, duration: 0.6, ease: 'easeOut' }}
                style={{ background: 'linear-gradient(90deg,#00e5ff,#7c4dff)' }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Risk Leaderboard ─────────────────────────────────────────────────────────
function RiskBoard({ risks }) {
  if (!risks?.length) return null;
  return (
    <div className="panel p-5 flex flex-col gap-4">
      <h3 className="text-xs mono text-shadow-accent tracking-widest uppercase">Risk Leaderboard</h3>
      <div className="space-y-2.5">
        {risks.map((r, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="mono text-xs text-gray-600 w-4">{i+1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-300 truncate">{r.entity_name}</div>
              <div className="text-[10px] text-gray-600 mono">{(r.threat_types||[]).join(', ')}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1 rounded-full bg-shadow-border overflow-hidden">
                <div className="h-full rounded-full"
                  style={{ width:`${r.risk_score}%`, background: r.risk_score>80?'#ff1744':r.risk_score>60?'#ff9b2b':'#ffd600' }}/>
              </div>
              <span className="mono text-xs font-semibold" style={{ color: r.risk_score>80?'#ff4569':r.risk_score>60?'#ff9b2b':'#ffd600' }}>
                {parseFloat(r.risk_score).toFixed(0)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Copilot Feed ─────────────────────────────────────────────────────────────
function CopilotFeed({ activities }) {
  const SEV = { high:'#ff9b2b', medium:'#ffd600', info:'#00e5ff', low:'#00e676' };
  return (
    <div className="panel p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs mono text-shadow-accent tracking-widest uppercase">Copilot Activity</h3>
        <span className="flex items-center gap-1.5 text-xs text-shadow-ok">
          <span className="status-dot active" style={{width:6,height:6}}/> LIVE
        </span>
      </div>
      <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 260 }}>
        {(activities||[]).map((a, i) => (
          <motion.div key={i} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
            transition={{ delay: i*0.04 }}
            className="flex gap-3 border-b border-shadow-border/40 pb-3">
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
              style={{ background: SEV[a.severity] || '#00e5ff' }}/>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-300 leading-snug">{a.action}</div>
              <div className="text-[10px] text-gray-600 mono mt-1 flex items-center gap-2">
                <span>{a.operator}</span>
                <span>·</span>
                <span>{new Date(a.timestamp).toLocaleTimeString()}</span>
                {a.success !== null && <span className={a.success ? 'text-shadow-ok' : 'text-shadow-danger'}>{a.success ? '✓' : '✗'}</span>}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Alert Feed ───────────────────────────────────────────────────────────────
function AlertFeed({ alerts, liveEvents }) {
  return (
    <div className="panel p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs mono text-shadow-accent tracking-widest uppercase">Recent Alerts</h3>
        {liveEvents.length > 0 && (
          <span className="badge badge-emergency">
            +{liveEvents.length} LIVE
          </span>
        )}
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-600 mono border-b border-shadow-border">
              <th className="text-left pb-2 font-normal">Time</th>
              <th className="text-left pb-2 font-normal">Sev</th>
              <th className="text-left pb-2 font-normal">Title</th>
              <th className="text-left pb-2 font-normal">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-shadow-border/30">
            <AnimatePresence>
              {liveEvents.map((e, i) => (
                <motion.tr key={`live-${i}`} initial={{ opacity:0, backgroundColor:'rgba(0,229,255,0.15)' }}
                  animate={{ opacity:1, backgroundColor:'transparent' }} transition={{ duration:1.5 }}>
                  <td className="py-2 mono text-shadow-accent pr-3">{new Date().toLocaleTimeString()}</td>
                  <td className="py-2 pr-3"><SeverityBadge s={e.severity || 'high'}/></td>
                  <td className="py-2 text-gray-300 pr-3 max-w-[200px] truncate">{e.type}</td>
                  <td className="py-2 text-gray-500">{e.source_ip || '–'}</td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {(alerts||[]).map((a) => (
              <tr key={a.id} className="hover:bg-shadow-border/20 transition-colors">
                <td className="py-2 mono text-gray-600 pr-3">{new Date(a.detected_at).toLocaleTimeString()}</td>
                <td className="py-2 pr-3"><SeverityBadge s={a.severity}/></td>
                <td className="py-2 text-gray-400 pr-3 max-w-[200px] truncate">{a.title}</td>
                <td className="py-2 text-gray-600">{a.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Asset Grid ───────────────────────────────────────────────────────────────
function AssetSummary({ assets }) {
  if (!assets) return null;
  return (
    <div className="panel p-5 flex flex-col gap-4">
      <h3 className="text-xs mono text-shadow-accent tracking-widest uppercase">Asset Status</h3>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label:'Online',      val: assets.active,   color:'#00e676', icon:'circle-check' },
          { label:'Degraded',    val: assets.degraded, color:'#ff9b2b', icon:'triangle-exclamation' },
          { label:'Offline',     val: assets.offline,  color:'#ff1744', icon:'circle-xmark' },
          { label:'Total',       val: assets.total,    color:'#7c4dff', icon:'layer-group' },
        ].map(({ label, val, color, icon }) => (
          <div key={label} className="rounded-lg p-3" style={{ background:`${color}0f`, border:`1px solid ${color}30` }}>
            <div className="flex items-center gap-2 mb-1">
              <i className={`fas fa-${icon} text-xs`} style={{ color }}/>
              <span className="text-[10px] text-gray-500 mono uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-2xl font-semibold" style={{ color }}>{val ?? 0}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV = [
  { id:'dashboard', icon:'gauge-high',        label:'Dashboard' },
  { id:'threats',   icon:'skull-crossbones',  label:'Threats' },
  { id:'alerts',    icon:'bell',              label:'Alerts' },
  { id:'assets',    icon:'microchip',         label:'Assets' },
  { id:'models',    icon:'brain',             label:'ML Models' },
  { id:'reports',   icon:'chart-line',        label:'Reports' },
];

function Sidebar({ active, setActive }) {
  return (
    <aside className="fixed left-0 top-14 bottom-0 flex flex-col py-6 px-3 z-40"
      style={{ width:220, background:'#04060f', borderRight:'1px solid #1a2340' }}>
      <nav className="flex-1 space-y-1">
        {NAV.map(({ id, icon, label }) => (
          <button key={id} onClick={() => setActive(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
              active === id
                ? 'bg-shadow-accent/10 text-shadow-accent'
                : 'text-gray-500 hover:text-gray-300 hover:bg-shadow-border/30'
            }`}>
            <i className={`fas fa-${icon} w-4 text-xs`}/>
            <span className="font-body">{label}</span>
            {active === id && <div className="ml-auto w-1 h-4 rounded-full bg-shadow-accent"/>}
          </button>
        ))}
      </nav>
      <div className="pt-4 border-t border-shadow-border text-xs mono text-gray-700 space-y-1 px-3">
        <div>v2.0.0-APEX</div>
        <div>PID: {Math.floor(Math.random()*99999)}</div>
      </div>
    </aside>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [page, setPage]         = useState('dashboard');
  const [now, setNow]           = useState(new Date());
  const [liveThreats, setLiveThreats] = useState([]);
  const { status: wsStatus, messages } = useWebSocket();

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Dashboard data
  const load = useCallback(async () => {
    try {
      const res = await getDashboard();
      if (res.success) setData(res.data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  // Live WS events
  useEffect(() => {
    const latest = messages.filter(m => m.event === 'new_threat').slice(0, 5).map(m => m.data);
    if (latest.length) setLiveThreats(prev => [...latest, ...prev].slice(0, 10));
  }, [messages]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen flex-col gap-4">
      <div className="w-12 h-12 rounded-full border-2 border-shadow-accent border-t-transparent animate-spin"/>
      <div className="mono text-shadow-accent text-sm tracking-widest animate-pulse">INITIALIZING SHADOW NDR...</div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-screen flex-col gap-4 text-shadow-danger">
      <i className="fas fa-triangle-exclamation text-4xl"/>
      <div className="mono text-sm">{error}</div>
      <button onClick={load} className="text-xs mono border border-shadow-danger/30 px-4 py-2 rounded-lg hover:bg-shadow-danger/10 transition-colors">
        RETRY
      </button>
    </div>
  );

  const { threats, assets, alerts: alertStats, topAttacks, riskTop,
          timeline, recentAlerts, copilot, systemMetrics } = data || {};

  return (
    <div className="min-h-screen text-white">
      <TopBar wsStatus={wsStatus} now={now}/>
      <Sidebar active={page} setActive={setPage}/>

      <main style={{ marginLeft:220, paddingTop:56 }} className="p-6 min-h-screen">

        {/* Page: Dashboard */}
        {page === 'dashboard' && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-5">

            {/* Row 1: KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Active Threats"   value={threats?.active ?? 0}
                sub={`${threats?.total ?? 0} total / 24h`}
                icon="skull-crossbones" color="#ff1744" delta={12}/>
              <MetricCard label="Critical Events"  value={threats?.critical ?? 0}
                sub={`avg score ${parseFloat(threats?.avg_score||0).toFixed(2)}`}
                icon="radiation" color="#ff6b00"/>
              <MetricCard label="Assets Online"    value={assets?.active ?? 0}
                sub={`${assets?.degraded ?? 0} degraded · ${assets?.offline ?? 0} offline`}
                icon="server" color="#00e676"/>
              <MetricCard label="Packets / 10s"    value={`${Math.floor((systemMetrics?.packets_captured||342000)/1000)}K`}
                sub={`P99 latency ${systemMetrics?.p99_latency_ms?.toFixed(1) || '4.2'}ms`}
                icon="wifi" color="#00e5ff"/>
            </div>

            {/* Row 2: timeline + attack bar */}
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-3"><TimelineChart data={timeline}/></div>
              <div className="col-span-2"><AttackBar attacks={topAttacks}/></div>
            </div>

            {/* Row 3: risk + assets + copilot */}
            <div className="grid grid-cols-3 gap-4">
              <RiskBoard risks={riskTop}/>
              <AssetSummary assets={assets}/>
              <CopilotFeed activities={copilot}/>
            </div>

            {/* Row 4: alert feed */}
            <AlertFeed alerts={recentAlerts} liveEvents={liveThreats}/>

          </motion.div>
        )}

        {/* Page: Threats */}
        {page === 'threats' && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
            <ThreatTable/>
          </motion.div>
        )}

        {/* Other pages */}
        {!['dashboard','threats'].includes(page) && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-600">
            <i className="fas fa-hard-drive text-4xl"/>
            <div className="mono text-sm tracking-widest uppercase">{page} – Coming Soon</div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

// ─── Threat Table Page ────────────────────────────────────────────────────────
import { getThreats as fetchThreats } from './api/index.js';

function ThreatTable() {
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThreats({ limit: 100 }).then(r => { setThreats(r.data || []); setLoading(false); });
  }, []);

  if (loading) return <div className="mono text-shadow-accent text-sm animate-pulse">Loading threats...</div>;

  return (
    <div className="panel p-5">
      <h2 className="text-xs mono text-shadow-accent tracking-widest uppercase mb-5">All Threats</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-600 mono border-b border-shadow-border">
              {['Time','Type','Severity','Source IP','ICAO24','Score','Status'].map(h => (
                <th key={h} className="text-left pb-2 pr-4 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-shadow-border/20">
            {threats.map(t => (
              <tr key={t.id} className="hover:bg-shadow-border/10 transition-colors">
                <td className="py-2.5 pr-4 mono text-gray-600">{new Date(t.detected_at).toLocaleTimeString()}</td>
                <td className="py-2.5 pr-4 text-gray-300">{t.threat_type}</td>
                <td className="py-2.5 pr-4"><SeverityBadge s={t.severity}/></td>
                <td className="py-2.5 pr-4 mono text-gray-500">{t.source_ip || '–'}</td>
                <td className="py-2.5 pr-4 mono text-gray-600">{t.icao24 || '–'}</td>
                <td className="py-2.5 pr-4">
                  <span className="mono" style={{ color: t.score > 0.8 ? '#ff1744' : t.score > 0.6 ? '#ff9b2b' : '#ffd600' }}>
                    {parseFloat(t.score||0).toFixed(3)}
                  </span>
                </td>
                <td className="py-2.5">
                  <span className={`badge badge-${t.status === 'active' ? 'high' : 'low'}`}>{t.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
