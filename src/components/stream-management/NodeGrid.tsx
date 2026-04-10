import React from 'react';
import { Node } from '../../types';

interface NodeGridProps {
    nodes: Node[];
    compact?: boolean;
}

export const NodeGrid: React.FC<NodeGridProps> = ({ nodes, compact }) => {
    const getLoadColor = (load: number) => {
        if (load < 50) return '#22c55e';
        if (load < 80) return '#f59e0b';
        return '#ef4444';
    };

    if (compact) {
        return (
            <div className="nodes-pills-container" style={{ display: 'flex', gap: '12px' }}>
                {nodes.map(n => (
                    <div key={n.id} className={`node-pill ${n.status.toLowerCase()}`} style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '12px',
                        padding: '6px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '0.8rem',
                        minWidth: '150px'
                    }}>
                        <div className="status-indicator" style={{ 
                            width: '8px', height: '8px', borderRadius: '50%', 
                            background: n.status === 'ONLINE' ? '#22c55e' : '#ef4444',
                            boxShadow: n.status === 'ONLINE' ? '0 0 8px #22c55e' : 'none'
                        }} />
                        <span style={{ fontWeight: 700, color: '#f8fafc' }}>{n.name}</span>
                        <span style={{ color: getLoadColor(n.load), fontWeight: 800 }}>{n.load}%</span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <section className="vps-section">
            <div className="section-title">
                <h3>🖥️ VPS Infrastructure</h3>
                <span className="badge">{nodes.length} Nodes</span>
            </div>
            <div className="nodes-grid">
                {/* ... existing card rendering ... */}
                {nodes.map(n => (
                    <div key={n.id} className={`node-glass-card ${n.status.toLowerCase()}`}>
                        <div className="node-info">
                            <span className="node-name">{n.name}</span>
                            <span className={`node-status-chip ${n.status.toLowerCase()}`}>{n.status}</span>
                        </div>
                        <div className="load-metric">
                            <div className="load-label">
                                <span>CPU Load</span>
                                <strong>{n.load}%</strong>
                            </div>
                            <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${n.load}%`, backgroundColor: getLoadColor(n.load) }} />
                            </div>
                        </div>
                        <div className="node-footer">
                            <small>URL: {n.url}</small>
                            {n.last_seen && <small style={{ display: 'block', opacity: 0.6 }}>Last seen: {new Date(n.last_seen).toLocaleString('id-ID')}</small>}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};
