import React from 'react';
import { Node } from '../../types';

interface NodeGridProps {
    nodes: Node[];
}

export const NodeGrid: React.FC<NodeGridProps> = ({ nodes }) => {
    const getLoadColor = (load: number) => {
        if (load < 50) return '#22c55e';
        if (load < 80) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <section className="vps-section">
            <div className="section-title">
                <h3>🖥️ VPS Infrastructure</h3>
                <span className="badge">{nodes.length} Nodes</span>
            </div>
            <div className="nodes-grid">
                {nodes.length === 0 ? (
                    <p className="empty">Belum ada VPS yang terdaftar.</p>
                ) : (
                    nodes.map(n => (
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
                    ))
                )}
            </div>
        </section>
    );
};
