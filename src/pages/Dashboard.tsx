import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../api';
import './ModuleCommon.css';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, CartesianGrid 
} from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import io from 'socket.io-client';

const SOCKET_URL = window.location.origin.replace('5173', '3001');

const ActivityIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
const CpuIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></svg>;
const EyeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const ServerIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6" y2="6"/><line x1="6" y1="18" x2="6" y2="18"/></svg>;

interface DashboardPayload {
  metrics: {
    cpu: number;
    memory: number;
    health: { ffmpeg: string; database: string };
  };
  streams: any[];
  timestamp: string;
}

export default function Dashboard() {
    const [metrics, setMetrics] = useState({ cpu: 0, memory: 0, activeStreams: 0, totalViews: 0, health: null as any });
    const [streams, setStreams] = useState<any[]>([]);
    const [cpuHistory, setCpuHistory] = useState<any[]>([]);
    const [memoryHistory, setMemoryHistory] = useState<any[]>([]);
    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    // REAL-TIME CONNECTION
    useEffect(() => {
        const socket = io(SOCKET_URL);
        
        socket.on('DASHBOARD_UPDATE', (payload: DashboardPayload) => {
            setLoading(false);
            setMetrics(prev => ({
                ...prev,
                cpu: payload.metrics.cpu,
                memory: payload.metrics.memory,
                health: payload.metrics.health,
                activeStreams: payload.streams.length
            }));
            setStreams(payload.streams);

            const timeLabel = new Date().toLocaleTimeString('id-ID', { hour12: false });
            
            setCpuHistory(prev => [...prev.slice(-15), { time: timeLabel, value: payload.metrics.cpu }]);
            setMemoryHistory(prev => [...prev.slice(-15), { time: timeLabel, value: payload.metrics.memory }]);

            // Alerts
            if (payload.metrics.cpu > 90) toast.error('🚨 CPU Overload Alert!');
            if (payload.metrics.health.ffmpeg !== 'OK') toast.error('⚠️ FFmpeg Service Error!');
            
            payload.streams.forEach(s => {
                if (s.status === 'ERROR') toast.error(`❌ Stream ${s.id} Down!`, { id: `err-${s.id}` });
                if (s.fps < 15 && s.fps > 0) toast(`⚠️ Low FPS on ${s.id}`, { icon: '⚠️', id: `fps-${s.id}` });
            });
        });

        // Initial Load for static data
        const initialLoad = async () => {
            try {
                const data = await apiFetch('/api/streams/dashboard/summary');
                setMetrics(prev => ({ 
                    ...prev, 
                    totalViews: data.totalSessions || 0,
                    cpu: data.metrics?.cpu || 0,
                    memory: data.metrics?.memory || 0,
                    health: data.metrics?.health || null,
                    activeStreams: data.activeStreamsCount || 0
                }));
                setStreams(data.activeStreams || []);
                setRecentLogs(data.recentLogs || []);
            } catch (err) {
                console.error('Failed to load initial dashboard data', err);
            } finally {
                setLoading(false);
            }
        };
        initialLoad();

        return () => { socket.disconnect(); };
    }, []);

    const pad = (n: number) => String(n).padStart(2, '0');
    const hours = now.getHours();
    const timeStr = `${pad(hours)}:${pad(now.getMinutes())}`;
    const seconds = pad(now.getSeconds());
    const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
    
    let greeting = 'SELAMAT MALAM';
    if (hours >= 5 && hours < 12) greeting = 'SELAMAT PAGI';
    else if (hours >= 12 && hours < 15) greeting = 'SELAMAT SIANG';
    else if (hours >= 15 && hours < 18) greeting = 'SELAMAT SORE';

    const triggerRestart = async (id: string) => {
        toast.promise(apiFetch(`/api/streams/${id}/start`, { method: 'POST' }), {
            loading: `Restarting ${id}...`,
            success: 'Restart signal sent!',
            error: 'Failed to restart.'
        });
    };

    if (loading) return <div className="dashboard-container"><div className="loader-center">OPTIMIZING REAL-TIME ENGINE...</div></div>;

    return (
        <div className="dashboard-container">
            <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' } }} />
            
            <div className="db-header">
                <div className="db-title">
                    <div className="db-welcome-premium">
                        <div className="dw-greeting">
                            <span className="g-text">{greeting}, ADMIN</span>
                            <span className="g-time">{timeStr}<small>:{seconds}</small></span>
                            <div className="dw-health-subtle">
                                <div className={`h-dot ${metrics?.health?.ffmpeg === 'OK' ? 'ok' : 'err'}`} title={`FFMPEG: ${metrics?.health?.ffmpeg}`} />
                                <div className={`h-dot ${metrics?.health?.database === 'OK' ? 'ok' : 'err'}`} title={`DATABASE: ${metrics?.health?.database}`} />
                            </div>
                        </div>
                        <div className="dw-date">{dateStr}</div>
                    </div>
                </div>
            </div>

            {/* METRICS GRID */}
            <div className="metrics-grid stats-compact">
                <MetricCard icon={<ActivityIcon />} label="ACTIVE" sub="RUNNING INSTANCES" value={metrics.activeStreams} color="blue" />
                <MetricCard icon={<EyeIcon />} label="VIEWS" sub="ACCUMULATED REACH" value={metrics.totalViews.toLocaleString()} color="green" />
                <MetricCard icon={<CpuIcon />} label="CPU" sub="PROCESSOR LOAD" value={`${metrics.cpu}%`} color="purple" />
                <MetricCard icon={<ServerIcon />} label="RAM" sub="MEMORY UTILIZATION" value={`${metrics.memory}%`} color="orange" />
            </div>

            {/* CHARTS SECTION */}
            <div className="dashboard-charts-row">
                <div className="chart-box glass-premium">
                    <div className="chart-header">
                        <h4>📈 CPU LOAD HISTORY</h4>
                        <span className="live-badge">LIVE</span>
                    </div>
                    <div className="chart-container-mini">
                        <ResponsiveContainer width="100%" height={120}>
                            <LineChart data={cpuHistory}>
                                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
                                <Line type="monotone" dataKey="value" stroke="#818cf8" strokeWidth={3} dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="chart-box glass-premium">
                    <div className="chart-header">
                        <h4>📊 MEMORY TREND</h4>
                        <span className="live-badge">LIVE</span>
                    </div>
                    <div className="chart-container-mini">
                        <ResponsiveContainer width="100%" height={120}>
                            <AreaChart data={memoryHistory}>
                                <defs>
                                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
                                <Area type="monotone" dataKey="value" stroke="#f59e0b" fillOpacity={1} fill="url(#colorMem)" strokeWidth={2} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* LIVE STREAMS TABLE */}
            <div className="recent-activity card glass-premium" style={{ marginTop: '20px' }}>
                <div className="activity-header-compact">
                    <h3>📹 REAL-TIME STREAM METRICS</h3>
                    <span className="metrics-count">{streams.length} INSTANCES</span>
                </div>
                <div className="compact-table-wrapper">
                    <table className="compact-monitoring-table">
                        <thead>
                            <tr>
                                <th>STREAM ID</th>
                                <th>CPU</th>
                                <th>BITRATE</th>
                                <th>FPS</th>
                                <th>STATUS</th>
                                <th>ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {streams.map(s => (
                                <tr key={s.id}>
                                    <td className="st-id">{s.id}</td>
                                    <td><div className="mini-progress"><div className="mini-fill" style={{ width: `${s.cpu}%` }}></div></div> {s.cpu}%</td>
                                    <td className="st-br">{s.bitrate} kbps</td>
                                    <td className="st-fps">{s.fps}</td>
                                    <td><span className={`status-pill-small ${s.status === 'OK' ? 'ok' : 'err'}`}>{s.status}</span></td>
                                    <td>
                                        <button className="btn-mini-restart" onClick={() => triggerRestart(s.id)}>🔄 RESTART</button>
                                    </td>
                                </tr>
                            ))}
                            {streams.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>No active streams detected.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

const MetricCard = ({ icon, label, sub, value, color }: any) => (
    <div className="metric-card glass-premium">
        <div className={`m-icon ${color}`}>{icon}</div>
        <div className="m-data">
            <div className="m-val-group">
                <span className="m-value">{value}</span>
                <span className="m-unit">{label}</span>
            </div>
            <div className="m-label">{sub}</div>
        </div>
    </div>
);
