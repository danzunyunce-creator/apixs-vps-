import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import './ModuleCommon.css';

const StatCard = ({ title, value, icon, color }: any) => (
    <div className="stat-card">
        <div className="stat-icon" style={{ background: `${color}15`, color: color }}>
            {icon}
        </div>
        <div className="stat-info">
            <div className="stat-title">{title}</div>
            <div className="stat-value">{value}</div>
        </div>
    </div>
);

export default function Analytics() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/api/streams/analytics/summary')
            .then(res => setData(res))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const exportCSV = () => {
        const history = data?.history || [];
        if (history.length === 0) return alert('Tidak ada data untuk diekspor.');
        const csvContent = "data:text/csv;charset=utf-8," 
            + "Stream ID,Mulai,Status,Durasi(Sec)\n"
            + history.map((e: any) => `${e.stream_id},${e.start_time},${e.status},${e.total_duration_seconds}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "stream_analytics_report.csv");
        document.body.appendChild(link);
        link.click();
    };

    if (loading) return <div className="loading-state">Memuat data analitik...</div>;

    return (
        <div className="analytics-container">
            <div className="analytics-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                    <h2>📊 ANALYTICS</h2>
                    <p className="subtitle">Data performa dan riwayat siaran langsung Anda.</p>
                </div>
                <button className="btn-save-all" onClick={exportCSV}>📥 EXPORT CSV</button>
            </div>

            <div className="stats-grid">
                <StatCard title="Total Jam Tayang" value={`${data?.totalHours || 0} Jam`} icon="⏱️" color="#38bdf8" />
                <StatCard title="Total Sesi Siaran" value={data?.totalSessions || 0} icon="📡" color="#22c55e" />
                <StatCard title="Peak Viewers (Est)" value="--" icon="📈" color="#f59e0b" />
                <StatCard title="Status Server" value="ONLINE" icon="✅" color="#10b981" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="card" style={{ padding: '12px' }}>
                    <h3 style={{ marginTop: 0, fontSize: '14px' }}>🏆 TOP PERFORMING MEDIA</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        {data?.topVideos?.length > 0 ? data.topVideos.map((v: any, idx: number) => (
                            <div key={v.video_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                                <span><span style={{ color: 'var(--text-muted)' }}>#{idx+1}</span> {v.video_id}</span>
                                <span style={{ color: 'var(--active-blue)' }}>{v.usage} Broadcasts</span>
                            </div>
                        )) : <p style={{ color: 'var(--text-muted)' }}>Analysing metadata...</p>}
                    </div>
                </div>
                <div className="card" style={{ padding: '12px' }}>
                    <h3 style={{ marginTop: 0, fontSize: '14px' }}>📊 PLATFORM DISTRIBUTION</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        {data?.platforms?.length > 0 ? data.platforms.map((p: any) => (
                            <div key={p.platform} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '80px', fontSize: '12px', fontWeight: 'bold' }}>{p.platform}</div>
                                <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${(p.count / data.totalSessions) * 100}%`, background: 'var(--active-blue)' }}></div>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.count}</div>
                            </div>
                        )) : <p style={{ color: 'var(--text-muted)' }}>No platform data recorded.</p>}
                    </div>
                </div>
            </div>

            <div className="analytics-section card">
                <div className="section-title">Riwayat Sesi Terakhir (Stream History)</div>
                <div className="history-table-wrapper">
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>STREAM ID</th>
                                <th>MULAI</th>
                                <th>STATUS</th>
                                <th>DURASI</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.history || []).length === 0 ? (
                                <tr><td colSpan={4} style={{textAlign: 'center', padding: '30px', color: 'var(--text-dim)'}}>Belum ada riwayat sesi tersimpan.</td></tr>
                            ) : data.history.map((s: any) => (
                                <tr key={s.id}>
                                    <td><code className="id-code">{s.stream_id}</code></td>
                                    <td>{new Date(s.start_time).toLocaleString('id-ID')}</td>
                                    <td>
                                        <span className={`status-pill ${s.status.toLowerCase()}`}>
                                            {s.status}
                                        </span>
                                    </td>
                                    <td>{Math.floor(s.total_duration_seconds / 60)} Menit</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
