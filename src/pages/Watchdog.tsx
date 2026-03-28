import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { apiFetch } from '../api';
import './ModuleCommon.css';

const SOCKET_URL = window.location.origin.replace('5173', '3001'); // Handle Vite proxy mismatch

export default function Watchdog() {
    const [logs, setLogs] = useState<any[]>([]);
    const [levelFilter, setLevelFilter] = useState('ALL');
    const [status, setStatus] = useState<any>({ connection: 'Connected', uptime: 0, activeProcesses: 0, ffmpegStatus: 'CHECKING', dbStatus: 'CHECKING' });
    const logContainerRef = useRef<HTMLDivElement>(null);

    const filteredLogs = logs.filter(l => levelFilter === 'ALL' || (l.level || '').toUpperCase() === levelFilter);

    useEffect(() => {
        const socket = io(SOCKET_URL);
        
        socket.on('streamLog', (data: any) => {
            setLogs(prev => [{
                time: data.timestamp || new Date().toLocaleTimeString(),
                level: data.level || 'info',
                msg: data.message || data.msg || 'Log event'
            }, ...prev].slice(0, 200));
        });

        const fetchStatus = async () => {
            try {
                const sys = await apiFetch('/api/streams/metrics');
                setStatus((prev: any) => ({ ...prev, ...sys }));
            } catch {}
        };

        fetchStatus();
        const tid = setInterval(fetchStatus, 5000);

        return () => {
            socket.disconnect();
            clearInterval(tid);
        };
    }, []);

    const clearLogs = () => setLogs([]);

    return (
        <div className="watchdog-container">
            <div className="header-row">
                <h2>📡 LIVE WATCHDOG</h2>
                <div className="status-indicators">
                    <span className="ind-item"><span className="dot pulse green"></span> Status: <strong>{status.connection}</strong></span>
                    <button className="btn-clear-logs" onClick={clearLogs}>CLEAR TERMINAL</button>
                    <button className="btn-restart-server">AUTO RESTART: ENABLED</button>
                </div>
            </div>

            <div className="watchdog-grid">
                <div className="log-panel card">
                    <div className="log-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3>Realtime Logs</h3>
                        <div className="filters" style={{ display: 'flex', gap: '8px' }}>
                            {['ALL', 'INFO', 'WARN', 'ERROR'].map(f => (
                                <button 
                                    key={f} 
                                    className={`btn-tab ${levelFilter === f ? 'active' : ''}`}
                                    onClick={() => setLevelFilter(f)}
                                    style={{ padding: '4px 12px', fontSize: '11px', height: 'auto' }}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="terminal-monitor" ref={logContainerRef}>
                        {filteredLogs.length === 0 ? (
                            <div className="log-line system">Belum ada log {levelFilter !== 'ALL' ? `berlevel ${levelFilter}` : ''}...</div>
                        ) : filteredLogs.map((l, i) => (
                            <div key={i} className={`log-line level-${l.level.toLowerCase()}`}>
                                <span className="time">[{l.time}]</span>
                                <span className="level">[{l.level.toUpperCase()}]</span>
                                <span className="msg">{l.msg}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sidebar-metrics card">
                    <h3>Connection Status</h3>
                    <div className="stat-row">
                        <span>Database</span>
                        <span className={`status-pill ${status.dbStatus === 'OK' ? 'live' : 'stop'}`} style={{ fontSize: '10px' }}>
                            {status.dbStatus || 'UNKNOWN'}
                        </span>
                    </div>
                    <div className="stat-row">
                        <span>FFmpeg Path</span>
                        <span className={`status-pill ${status.ffmpegStatus === 'OK' ? 'live' : 'stop'}`} style={{ fontSize: '10px' }}>
                            {status.ffmpegStatus || 'CHECKING'}
                        </span>
                    </div>
                    <div className="stat-row">
                        <span>Active Stream Processes</span>
                        <span className="status-val" style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{status.activeProcesses}</span>
                    </div>
                    <div className="stat-row">
                        <span>Server Uptime</span>
                        <span style={{ fontSize: '12px' }}>{Math.floor(status.uptime / 3600)}h {Math.floor((status.uptime % 3600) / 60)}m</span>
                    </div>

                    <div className="auto-restart-card">
                        <h4>Auto Restart Engine</h4>
                        <p>Sistem otomatis menjalankan ulang stream yang mati akibat error FFmpeg atau koneksi putus.</p>
                        <button className="btn-trigger-manual">🔄 RESTART ALL WORKERS</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
