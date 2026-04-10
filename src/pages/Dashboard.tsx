import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Eye, Cpu, HardDrive, Zap, Shield, 
  Server, Clock, AlertTriangle, RefreshCw 
} from 'lucide-react';
import { apiFetch } from '../api';
import './ModuleCommon.css';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import io from 'socket.io-client';
import { BASE_URL } from '../api';
import { NodeGrid } from '../components/stream-management/NodeGrid';

// Connect via Vite proxy (same origin) — avoids CORS & direct port issues
const SOCKET_URL = window.location.origin;

interface DashboardPayload {
  metrics: {
    cpu: number;
    memory: number;
    health: { ffmpeg: string; database: string; encoder: string; disk: string };
  };
  streams: any[];
  timestamp: string;
}

const METRIC_COLORS: any = {
    indigo: '#6366f1',
    emerald: '#10b981',
    rose: '#f43f5e',
    amber: '#f59e0b',
    cyan: '#06b6d4',
    violet: '#8b5cf6'
};

export default function Dashboard() {
    const [metrics, setMetrics] = useState({ 
        cpu: 0, 
        memory: 0, 
        activeStreams: 0, 
        totalViews: 0, 
        health: { ffmpeg: '...', database: '...', disk: '...' } as any 
    });
    const [streams, setStreams] = useState<any[]>([]);
    const [nodes, setNodes] = useState<any[]>([]);
    const [cpuHistory, setCpuHistory] = useState<any[]>([]);
    const [memoryHistory, setMemoryHistory] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            path: '/socket.io',
            transports: ['websocket', 'polling']
        });
        
        // Fallback: if socket takes too long, stop loading anyway
        const loadingTimeout = setTimeout(() => setLoading(false), 5000);

        socket.on('connect', () => {
            console.log('[Dashboard] Socket.IO connected via proxy');
            clearTimeout(loadingTimeout);
        });

        socket.on('connect_error', (err) => {
            console.warn('[Dashboard] Socket.IO connect error:', err.message);
            setLoading(false);
        });
        
        socket.on('DASHBOARD_UPDATE', (payload: DashboardPayload) => {
            setLoading(false);
            if (payload && payload.metrics) {
                setMetrics(prev => ({
                    ...prev,
                    cpu: payload.metrics.cpu,
                    memory: payload.metrics.memory,
                    health: payload.metrics.health || prev.health,
                    activeStreams: payload.streams?.length || 0
                }));
                setStreams(payload.streams || []);

                const timeLabel = new Date().toLocaleTimeString('id-id', { hour12: false });
                setCpuHistory(prev => [...prev.slice(-14), { time: timeLabel, value: payload.metrics.cpu }]);
                setMemoryHistory(prev => [...prev.slice(-14), { time: timeLabel, value: payload.metrics.memory }]);
            }
        });

        const initialLoad = async () => {
            try {
                const [data, nData] = await Promise.all([
                    apiFetch('/api/streams/dashboard/summary', { skipCache: true }),
                    apiFetch('/api/nodes', { skipCache: true })
                ]);
                
                if (data) {
                    setMetrics(prev => ({ 
                        ...prev, 
                        totalViews: data.totalSessions || 0,
                        cpu: data.metrics?.cpu || 0,
                        memory: data.metrics?.memory || 0,
                        health: data.metrics?.health || prev.health,
                        activeStreams: data.activeStreamsCount || 0
                    }));
                    setStreams(data.activeStreams || []);
                    setActivities(data.activities || []);
                }
                if (nData) {
                    setNodes(nData);
                }
            } catch (err) {
                console.error('Dashboard Load Error:', err);
                toast.error('Gagal memuat ringkasan dashboard.');
            } finally {
                setLoading(false);
                clearTimeout(loadingTimeout);
            }
        };
        initialLoad();

        return () => { 
            socket.disconnect();
            clearTimeout(loadingTimeout);
        };
    }, []);

    const triggerRestart = async (id: string) => {
        toast.promise(apiFetch(`/api/streams/${id}/start`, { method: 'POST' }), {
            loading: `Restarting ${id}...`,
            success: 'Restart signal sent!',
            error: 'Failed to restart.'
        });
    };

    if (loading) return (
        <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0b0f19' }}>
            <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{ width: '60px', height: '60px', borderRadius: '50%', border: '3px solid #6366f1', borderTopColor: 'transparent', marginBottom: '20px' }}
            />
            <div className="loader-text" style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '4px', color: '#6366f1' }}>
                ENGAGING COMMAND CENTER...
            </div>
        </div>
    );

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div 
            className="dashboard-container"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            style={{ padding: '30px', maxWidth: '1600px', margin: '0 auto' }}
        >
            <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' } }} />
            
            {/* ELITE HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px' }}>
                <div>
                    <motion.h1 style={{ fontSize: '2.5rem', marginBottom: '5px', color: 'white' }}>Terminal Overview</motion.h1>
                    <div className="sub-header">
                        Broadcasting Operations • {now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                </div>
                <div style={{ textAlign: 'right', color: 'white' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                        {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '5px' }}>
                        <HealthBadge label="FFMPEG" ok={metrics.health?.ffmpeg === 'OK'} />
                        <HealthBadge label="STREAMS" ok={metrics.activeStreams > 0} />
                        <HealthBadge label="DATABASE" ok={metrics.health?.database === 'OK'} />
                    </div>
                </div>
            </div>

            {/* METRICS GRID */}
            <NodeGrid nodes={nodes} />

            <div className="pro-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '30px', gap: '20px' }}>
                <MetricCard icon={<Activity />} label="ACTIVE INSTANCES" value={metrics.activeStreams} color="indigo" variants={cardVariants} />
                <MetricCard icon={<Eye />} label="TOTAL REACH" value={metrics.totalViews.toLocaleString()} color="emerald" variants={cardVariants} />
                <MetricCard icon={<Cpu />} label="CPU LOAD" value={`${metrics.cpu}%`} color="rose" variants={cardVariants} />
                <MetricCard icon={<Server />} label="RAM USAGE" value={`${metrics.memory}%`} color="amber" variants={cardVariants} />
                <MetricCard 
                    icon={<HardDrive />} 
                    label="DISK FREE" 
                    value={metrics.health?.disk || 'PROBING'} 
                    color="cyan" 
                    variants={cardVariants} 
                    footer={
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', marginTop: '10px', overflow: 'hidden' }}>
                            <div 
                                style={{ 
                                    width: metrics.health?.disk ? `${100 - (parseFloat(metrics.health.disk) / 50 * 100)}%` : '0%', // Rough estimate assuming 50GB total if disk string is like '45.2 GB Free'
                                    height: '100%', 
                                    background: '#06b6d4',
                                    transition: 'width 1s ease'
                                }} 
                            />
                        </div>
                    }
                />
                <MetricCard icon={<Zap />} label="FFMPEG ENGINE" value={metrics.health?.encoder || 'CPU'} color="violet" variants={cardVariants} />
            </div>

            {/* ANALYTICS ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                <motion.div className="glass-card-pro" variants={cardVariants}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}><Cpu size={18} /> CPU REAL-TIME</h3>
                        <span className="status-live" />
                    </div>
                    <div style={{ height: '180px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={cpuHistory}>
                                <defs>
                                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
                                <Area type="monotone" dataKey="value" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                <motion.div className="glass-card-pro" variants={cardVariants}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}><Server size={18} /> RAM UTILIZATION</h3>
                        <span className="status-live" />
                    </div>
                    <div style={{ height: '180px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={memoryHistory}>
                                <defs>
                                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
                                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorMem)" isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>

            {/* OPERATIONS TABLE */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
                <motion.div className="glass-card-pro" variants={cardVariants}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3 style={{ color: 'white' }}>📹 LIVE WORKERS</h3>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{streams.length} ACTIVE</span>
                    </div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>
                                    <th style={{ padding: '12px 10px' }}>ID</th>
                                    <th>CPU</th>
                                    <th>BITRATE</th>
                                    <th>STATUS</th>
                                    <th>COMMAND</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {streams.map(s => (
                                        <motion.tr 
                                            key={s.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem', color: 'white' }}
                                        >
                                            <td style={{ padding: '15px 10px', color: '#6366f1', fontWeight: 600 }}>{s.id}</td>
                                            <td>
                                                <div style={{ width: '60%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
                                                    <div style={{ width: `${s.cpu || 0}%`, height: '100%', background: '#6366f1', borderRadius: '10px' }} />
                                                </div>
                                            </td>
                                            <td>{s.bitrate || 0} <small>kbps</small></td>
                                            <td>
                                                <span style={{ 
                                                    padding: '4px 10px', 
                                                    borderRadius: '6px', 
                                                    fontSize: '0.7rem', 
                                                    background: s.status === 'OK' || s.status === 'LIVE' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                    color: s.status === 'OK' || s.status === 'LIVE' ? '#10b981' : '#ef4444'
                                                }}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td>
                                                <button onClick={() => triggerRestart(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><RefreshCw size={16} /></button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                                {streams.length === 0 && (
                                    <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', opacity: 0.5, color: '#64748b' }}>No active workers detected. Start a stream from Management.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                <motion.div className="glass-card-pro" variants={cardVariants}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3 style={{ color: 'white' }}>🛡️ SYSTEM SENTINEL</h3>
                        <Shield size={16} color="#64748b" />
                    </div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {activities && activities.length > 0 ? activities.map((a: any, i: number) => (
                            <div key={i} style={{ display: 'flex', gap: '15px', padding: '12px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', color: 'white' }}>
                                <span style={{ color: '#64748b' }}>{a.created_at ? new Date(a.created_at).toLocaleTimeString('id-id', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                <span style={{ color: '#94a3b8' }}><b>{a.username || 'SYS'}:</b></span>
                                <span>{a.action}</span>
                            </div>
                        )) : (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No recent system signals.</div>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}

const MetricCard = ({ icon, label, value, color, variants }: any) => {
    const bgColor = METRIC_COLORS[color] || METRIC_COLORS.indigo;
    
    return (
        <motion.div className="glass-card-pro" variants={variants} whileHover={{ scale: 1.02 }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ 
                    width: '45px', height: '45px', 
                    borderRadius: '12px', 
                    background: `${bgColor}15`, 
                    color: bgColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    {React.cloneElement(icon, { size: 22 })}
                </div>
                <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>{value}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{label}</div>
                </div>
            </div>
        </motion.div>
    );
};

const HealthBadge = ({ label, ok }: { label: string, ok: boolean }) => (
    <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px', 
        background: 'rgba(30,41,59,0.5)', 
        padding: '2px 8px', 
        borderRadius: '6px',
        fontSize: '0.65rem',
        border: '1px solid rgba(255,255,255,0.05)'
    }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ok ? '#10b981' : '#ef4444', boxShadow: ok ? '0 0 5px #10b981' : 'none' }} />
        <span style={{ color: '#94a3b8', fontWeight: 700 }}>{label}</span>
    </div>
);
