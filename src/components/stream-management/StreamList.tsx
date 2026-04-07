import React from 'react';
import { Stream, Node } from '../../types';

interface StreamListProps {
    streams: Stream[];
    nodes: Node[];
    onAction: (id: string, action: 'start' | 'stop') => void;
    onDelete?: (id: string) => void;
    onEdit?: (stream: Stream) => void;
    onToggleRestart?: (id: string, enabled: boolean) => void;
}

export const StreamList: React.FC<StreamListProps> = ({ streams, nodes, onAction, onDelete, onEdit, onToggleRestart }) => {
    return (
        <section className="streams-section">
            <div className="section-title">
                <h3>🎥 Stream Channels</h3>
                <div className="filter-pills">
                    <span className="pill active">All</span>
                    <span className="pill">Live</span>
                    <span className="pill">Offline</span>
                </div>
            </div>
            
            <div className="streams-list-container">
                {streams.length === 0 ? (
                    <p className="empty">Tidak ada channel siaran.</p>
                ) : (
                    streams.map(s => (
                        <div key={s.id} className="stream-flat-card">
                            <div className="s-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={s.status === 'RUNNING' ? '#22c55e' : '#64748b'} strokeWidth="2">
                                    <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                                </svg>
                            </div>
                            <div className="s-info">
                                <h4>{s.title}</h4>
                                <div className="s-meta">
                                    <span className={`s-status ${s.status.toLowerCase()}`}>{s.status}</span>
                                    {s.node && (
                                        <span className="s-node">
                                            VPS: {nodes.find(n => n.id === s.node)?.name || s.node}
                                        </span>
                                    )}
                                    {s.status === 'RUNNING' && (
                                        <>
                                            <span className="s-metric">⚡ {(s as any).bitrate || '0 kbps'}</span>
                                            <span className="s-metric">⏱️ {(s as any).uptime || '00:00:00'}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="s-viewers">
                                {s.status === 'RUNNING' && (
                                    <span className="viewer-count">
                                        <span className="pulse-red" /> {s.viewer_count || 0}
                                    </span>
                                )}
                            </div>
                            <div className="s-actions">
                                <button 
                                    className={`btn-action restart-toggle ${(s as any).auto_restart === 0 ? 'off' : 'on'}`} 
                                    title={`Auto-Restart: ${(s as any).auto_restart === 0 ? 'OFF' : 'ON'}`}
                                    onClick={() => onToggleRestart && onToggleRestart(s.id, (s as any).auto_restart === 0)}
                                >
                                    🐕
                                </button>

                                {onEdit && (
                                    <button className="btn-action edit" title="Edit Channel" onClick={() => onEdit(s)}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                                    </button>
                                )}
                                
                                {s.status === 'RUNNING' ? (
                                    <button className="btn-action stop" title="Stop Stream" onClick={() => onAction(s.id, 'stop')}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <rect x="6" y="6" width="12" height="12"/>
                                        </svg>
                                    </button>
                                ) : (
                                    <button className="btn-action start" title="Start Stream" onClick={() => onAction(s.id, 'start')}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polygon points="5 3 19 12 5 21 5 3"/>
                                        </svg>
                                    </button>
                                )}

                                {onDelete && (
                                    <button className="btn-action delete" title="Delete Channel" onClick={() => onDelete(s.id)}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
};
