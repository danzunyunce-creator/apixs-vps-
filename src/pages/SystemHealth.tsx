import { useState, useEffect } from 'react';
import { Activity, Server, Cpu, HardDrive, AlertTriangle, CheckCircle2, ChevronRight, TerminalSquare, Info, AlertOctagon } from 'lucide-react';
import { apiFetch } from '../api';
import './SystemHealth.css';

interface SystemHealthData {
    cpu: number;
    ram: number;
    activeStreams: number;
    uptime: number;
    platform: string;
    arch: string;
}

interface SystemLog {
    id: number;
    stream_id: string | null;
    level: string;
    message: string;
    source_ip: string | null;
    created_at: string;
}

export default function SystemHealth() {
    const [health, setHealth] = useState<SystemHealthData | null>(null);
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [healthRes, logsRes] = await Promise.all([
                apiFetch('/api/system/health', { skipCache: true }),
                apiFetch('/api/system/logs?limit=50', { skipCache: true })
            ]);
            
            setHealth(healthRes);
            setLogs(logsRes);
        } catch (error) {
            console.error('Error fetching system health', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000); // Poll every 15s
        return () => clearInterval(interval);
    }, []);

    const formatUptime = (seconds: number) => {
        const d = Math.floor(seconds / (3600*24));
        const h = Math.floor(seconds % (3600*24) / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        return `${d}d ${h}h ${m}m`;
    };

    const getLogIcon = (level: string) => {
        switch(level.toLowerCase()) {
            case 'error': return <AlertOctagon size={16} className="text-red-400" />;
            case 'warn': return <AlertTriangle size={16} className="text-amber-400" />;
            default: return <Info size={16} className="text-blue-400" />;
        }
    };

    const getLogLevelStyle = (level: string) => {
        switch(level.toLowerCase()) {
            case 'error': return 'border-l-4 border-red-500 bg-red-500/5';
            case 'warn': return 'border-l-4 border-amber-500 bg-amber-500/5';
            default: return 'border-l-4 border-blue-500 bg-blue-500/5';
        }
    };

    return (
        <div className="module-container system-health" style={{ padding: '0 0 2rem 0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div className="module-header glass-panel" style={{ margin: '1.5rem', marginBottom: '1rem' }}>
                <div>
                    <h1 className="module-title">
                        <Activity className="text-emerald-400" size={28} />
                        System Telemetry
                    </h1>
                    <p className="module-subtitle">Enterprise observability dashboard: Real-time VPS health and background logs.</p>
                </div>
            </div>

            <div className="telemetry-grid" style={{ margin: '0 1.5rem', display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '1.5rem', flex: 1, overflow: 'hidden' }}>
                
                {/* Left Column: Metrics */}
                <div className="glass-panel metrics-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', overflowY: 'auto' }}>
                    <h3 className="flex items-center gap-2 text-zinc-300 font-semibold mb-2">
                        <Server size={18} className="text-emerald-400" />
                        Infrastructure Health
                    </h3>

                    {health ? (
                        <>
                            <div className="metric-card bg-zinc-900/50 rounded-xl p-4 border border-white/5 relative overflow-hidden">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="text-zinc-400 text-sm font-medium flex items-center gap-2">
                                        <Cpu size={16} /> CPU Load (1m avg)
                                    </div>
                                    <div className={`font-bold text-lg ${health.cpu > 70 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {health.cpu}%
                                    </div>
                                </div>
                                <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2">
                                    <div className={`h-1.5 rounded-full ${health.cpu > 70 ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(health.cpu, 100)}%` }}></div>
                                </div>
                            </div>

                            <div className="metric-card bg-zinc-900/50 rounded-xl p-4 border border-white/5 relative overflow-hidden">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="text-zinc-400 text-sm font-medium flex items-center gap-2">
                                        <HardDrive size={16} /> Memory Usage
                                    </div>
                                    <div className={`font-bold text-lg ${health.ram > 85 ? 'text-red-400' : 'text-primary'}`}>
                                        {health.ram}%
                                    </div>
                                </div>
                                <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2">
                                    <div className={`h-1.5 rounded-full ${health.ram > 85 ? 'bg-red-400' : 'bg-primary'}`} style={{ width: `${health.ram}%` }}></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div className="bg-zinc-900/50 rounded-lg p-3 border border-white/5">
                                    <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Active Streams</div>
                                    <div className="text-2xl font-bold text-zinc-100">{health.activeStreams}</div>
                                </div>
                                <div className="bg-zinc-900/50 rounded-lg p-3 border border-white/5">
                                    <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Uptime</div>
                                    <div className="text-sm font-medium text-zinc-200 mt-1">{formatUptime(health.uptime)}</div>
                                </div>
                            </div>

                            <div className="mt-auto group cursor-pointer bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl p-4 transition-colors">
                                <div className="flex items-start gap-3">
                                    <Activity className="text-red-400 mt-0.5" size={20} />
                                    <div>
                                        <h4 className="text-red-200 font-medium text-sm">Emergency Diagnostics</h4>
                                        <p className="text-red-400/70 text-xs mt-1">Run deep vacuum & reap zombie processes if system is lagging.</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-zinc-500">
                            Loading telemetry...
                        </div>
                    )}
                </div>

                {/* Right Column: Terminal Logs */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="flex items-center gap-2 text-zinc-300 font-semibold">
                            <TerminalSquare size={18} className="text-primary" />
                            Live System Output
                        </h3>
                        <div className="flex gap-2">
                            <span className="flex items-center gap-1.5 text-xs text-zinc-400 px-2.5 py-1 rounded-full bg-zinc-800">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Streaming Logs
                            </span>
                        </div>
                    </div>
                    
                    <div className="logs-container" style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#0a0a0a', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {loading && logs.length === 0 ? (
                            <div className="text-zinc-600 italic">Initializing secure log connection...</div>
                        ) : logs.length === 0 ? (
                            <div className="text-zinc-600 italic">No system logs available for this instance.</div>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {logs.map((log) => (
                                    <div key={log.id} className={`p-2.5 rounded text-zinc-300 ${getLogLevelStyle(log.level)} flex flex-col gap-1`}>
                                        <div className="flex items-center gap-2 opacity-70 mb-0.5">
                                            {getLogIcon(log.level)}
                                            <span className="text-xs text-zinc-500">
                                                [{new Date(log.created_at).toLocaleString('en-CA', { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' }).split(', ')[1]}]
                                            </span>
                                            {log.stream_id && (
                                                <span className="text-xs bg-white/10 px-1.5 rounded text-white/70">
                                                    Stream: {log.stream_id}
                                                </span>
                                            )}
                                        </div>
                                        <div className="pl-6 break-words whitespace-pre-wrap">
                                            {log.message}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
