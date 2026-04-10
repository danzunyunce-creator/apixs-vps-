import { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { apiFetch } from '../api';
import './AuditTrail.css';

interface AuditLog {
    id: number;
    user_id: string;
    username: string;
    action: string;
    target_type: string;
    target_id: string;
    details: string;
    created_at: string;
}

export default function AuditTrail() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchAuditLogs = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`/api/system/audit?limit=200`, { skipCache: true });
            setLogs(res);
        } catch (error) {
            console.error('Error fetching audit logs', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuditLogs();
        const interval = setInterval(fetchAuditLogs, 30000);
        return () => clearInterval(interval);
    }, []);

    const filteredLogs = logs.filter(log => 
        log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.target_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getActionColor = (action: string) => {
        const a = action.toLowerCase();
        if (a.includes('delete') || a.includes('stop') || a.includes('remove')) return 'text-red-400 bg-red-400/10';
        if (a.includes('create') || a.includes('start') || a.includes('add')) return 'text-emerald-400 bg-emerald-400/10';
        if (a.includes('update') || a.includes('edit')) return 'text-amber-400 bg-amber-400/10';
        if (a.includes('login') || a.includes('auth')) return 'text-blue-400 bg-blue-400/10';
        return 'text-zinc-400 bg-zinc-800';
    };

    return (
        <div className="module-container audit-trail" style={{ padding: '0 0 2rem 0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div className="module-header glass-panel" style={{ margin: '1.5rem', marginBottom: '1rem' }}>
                <div>
                    <h1 className="module-title">
                        <ShieldCheck className="text-emerald-400" size={28} />
                        Security Audit Trail
                    </h1>
                    <p className="module-subtitle">Enterprise compliance log: Monitor all administrative actions in real-time.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchAuditLogs} className="btn btn-secondary" disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <button className="btn btn-primary" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                        <Filter size={18} /> Export CSV
                    </button>
                </div>
            </div>

            <div className="glass-panel" style={{ margin: '0 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="control-bar" style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem' }}>
                    <div className="search-box glass-input" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                        <Search size={18} className="text-zinc-400" />
                        <input 
                            type="text" 
                            placeholder="Search by user, action, target..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
                        />
                    </div>
                </div>

                <div className="table-responsive" style={{ flex: 1, overflowY: 'auto' }}>
                    <table className="data-table w-full">
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1, borderBottom: '1px solid var(--border-color)' }}>
                            <tr>
                                <th className="text-left py-4 px-6 text-zinc-400 font-medium whitespace-nowrap">Timestamp</th>
                                <th className="text-left py-4 px-6 text-zinc-400 font-medium">User</th>
                                <th className="text-left py-4 px-6 text-zinc-400 font-medium">Action</th>
                                <th className="text-left py-4 px-6 text-zinc-400 font-medium">Target</th>
                                <th className="text-left py-4 px-6 text-zinc-400 font-medium">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-zinc-400">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-3" />
                                        Loading audit history...
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-zinc-400">
                                        <AlertCircle size={24} className="mx-auto mb-3 opacity-50" />
                                        No audit records found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/5 transition-colors">
                                        <td className="py-3 px-6 whitespace-nowrap text-zinc-400 text-sm flex items-center gap-2">
                                            <Clock size={14} />
                                            {new Date(log.created_at).toLocaleString('en-CA', { hour12: false }).replace(',', '')}
                                        </td>
                                        <td className="py-3 px-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-emerald-400 border border-emerald-400/20">
                                                    {log.username.substring(0, 1).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-zinc-200">{log.username}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-6">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getActionColor(log.action)}`}>
                                                {log.action.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-3 px-6">
                                            <div className="text-sm">
                                                <span className="text-zinc-400 text-xs uppercase tracking-wider">{log.target_type}</span>
                                                <div className="text-zinc-200 font-mono text-xs mt-0.5">{log.target_id || '-'}</div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-6 text-zinc-400 text-sm max-w-xs truncate" title={log.details}>
                                            {log.details || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
