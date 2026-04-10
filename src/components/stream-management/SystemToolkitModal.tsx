import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api';

interface SystemToolkitModalProps {
    show: boolean;
    onClose: () => void;
}

interface SystemHealth {
    cpu: number;
    ram: number;
    activeStreams: number;
    uptime: number;
    platform: string;
    arch: string;
}

export const SystemToolkitModal: React.FC<SystemToolkitModalProps> = ({ show, onClose }) => {
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const loadHealth = async () => {
        try {
            const data = await apiFetch('/api/system/health', { cacheTTL: 3000 });
            setHealth(data);
        } catch (err) {
            console.error('Failed to load system health', err);
        }
    };

    useEffect(() => {
        if (show) {
            loadHealth();
            const interval = setInterval(loadHealth, 3000);
            return () => clearInterval(interval);
        }
    }, [show]);

    const handleAction = async (action: string) => {
        setLoading(true);
        setMessage(null);
        try {
            let endpoint = '/api/system/maintenance';
            if (action === 'fix') endpoint = '/api/system/fix-ports';
            if (action === 'deploy') endpoint = '/api/system/deploy';

            const res = await apiFetch(endpoint, { method: 'POST' });
            setMessage({ type: 'success', text: res.message || 'Action executed successfully' });
            if (action === 'deploy') {
                setTimeout(() => window.location.reload(), 5000);
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Action failed' });
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="modal-content toolkit-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>🪄 Magic System Toolkit</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="toolkit-body">
                    <div className="performance-grid">
                        <div className="health-card">
                            <span className="h-label">CPU LOAD</span>
                            <div className="h-val-row">
                                <span className={`h-val ${health && health.cpu > 80 ? 'danger' : ''}`}>{health?.cpu || 0}%</span>
                                <div className="mini-chart-bg"><div className="mini-chart-fill" style={{ width: `${health?.cpu || 0}%` }} /></div>
                            </div>
                        </div>
                        <div className="health-card">
                            <span className="h-label">RAM USAGE</span>
                            <div className="h-val-row">
                                <span className={`h-val ${health && health.ram > 85 ? 'danger' : ''}`}>{health?.ram || 0}%</span>
                                <div className="mini-chart-bg"><div className="mini-chart-fill" style={{ width: `${health?.ram || 0}%` }} /></div>
                            </div>
                        </div>
                        <div className="health-card wide">
                            <div className="h-sub-grid">
                                <div><span className="h-label">ACTIVE STREAMS</span><p className="h-sub-val">{health?.activeStreams || 0}</p></div>
                                <div><span className="h-label">SYSTEM UPTIME</span><p className="h-sub-val">{health ? formatUptime(health.uptime) : '0s'}</p></div>
                            </div>
                        </div>
                    </div>

                    <div className="magic-actions-list">
                        <div className="magic-action-item">
                            <div className="action-info">
                                <h4>🧹 Optimize Engine</h4>
                                <p>Database Vacuum + FFmpeg Zombie Reap. Improves system stability.</p>
                            </div>
                            <button className="btn-magic-action" onClick={() => handleAction('maintenance')} disabled={loading}>
                                {loading ? 'Processing...' : 'Execute'}
                            </button>
                        </div>

                        <div className="magic-action-item">
                            <div className="action-info">
                                <h4>🛠️ Fix Blocked Ports</h4>
                                <p>Emergency clearance of Port 3001. Use if server fails to start.</p>
                            </div>
                            <button className="btn-magic-action warning" onClick={() => handleAction('fix')} disabled={loading}>
                                Fix Now
                            </button>
                        </div>

                        <div className="magic-action-item">
                            <div className="action-info">
                                <h4>🚀 Full Platform Update</h4>
                                <p>Pull latest code from GitHub, rebuild UI, and restart engine. (~60s downtime)</p>
                            </div>
                            <button className="btn-magic-action danger" onClick={() => handleAction('deploy')} disabled={loading}>
                                Update Now
                            </button>
                        </div>
                    </div>

                    {message && (
                        <div className={`toolkit-message ${message.type}`}>
                            {message.type === 'success' ? '✅' : '❌'} {message.text}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <p className="footer-note">Running on {health?.platform || 'linux'} {health?.arch || 'x64'}</p>
                </div>
            </div>
        </div>
    );
};
