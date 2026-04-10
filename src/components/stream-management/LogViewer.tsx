import React from 'react';
import { LogEntry } from '../../types';

interface LogViewerProps {
    logs: LogEntry[];
    onClear: () => void;
    onClose?: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, onClear, onClose }) => {
    return (
        <div className="logs-area" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
            <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid #1e293b', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                background: '#0a0f1e',
                flexShrink: 0
            }}>
                <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📡 <span>Active Logs</span>
                    <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                        {logs.length}
                    </span>
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                        onClick={onClear} 
                        style={{ 
                            background: 'rgba(255,255,255,0.07)', 
                            padding: '6px 14px', 
                            borderRadius: '8px', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            color: '#94a3b8', 
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 700
                        }}
                    >
                        🗑 Clear
                    </button>
                    {onClose && (
                        <button 
                            onClick={onClose} 
                            style={{ 
                                cursor: 'pointer', 
                                background: 'rgba(239,68,68,0.15)', 
                                border: '1px solid rgba(239,68,68,0.3)', 
                                color: '#f87171', 
                                fontSize: '1.1rem', 
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px', 
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                flexShrink: 0
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.color = 'white'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
                            title="Tutup Log"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>
            <div className="log-list" style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.4 }}>📋</div>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>Menunggu aktivitas sistem...</p>
                    </div>
                ) : (
                    logs.map((l, i) => (
                        <div key={i} className={`log-item ${l.type}`} style={{
                            display: 'flex',
                            gap: '10px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: l.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                            borderLeft: `3px solid ${l.type === 'error' ? '#ef4444' : l.type === 'warn' ? '#f59e0b' : '#6366f1'}`
                        }}>
                            <span className="log-time" style={{ color: '#475569', fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}>[{l.time}]</span>
                            <span className="log-msg" style={{ color: l.type === 'error' ? '#f87171' : l.type === 'warn' ? '#fbbf24' : '#94a3b8', fontSize: '0.82rem', wordBreak: 'break-all' }}>{l.msg}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
