import { useState, useEffect, useCallback } from 'react';
import './JadwalkanLive.css';

// helper: parse "HH:MM:SS" or "MM:SS" → total seconds
const parseTime = (str) => {
    const p = str.split(':').map(Number);
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    return p[0] * 60 + p[1];
};

// helper: format seconds → "HH:MM:SS"
const fmtTime = (s) => {
    if (s <= 0) return '00:00:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
};

const INIT_STREAMS = [
    { id: 1, namaFile: 'Looping Video Live 1.mp4', kunciStream: '..........7s3S', durasi: '11h 55m', jadwalkanUlang: 'Setiap Hari', status: 'SCHEDULED', countdownLabel: 'START IN', initialCountdown: parseTime('10:55:39'), jadwalMulai: '09/12/2025 20:10', jadwalBerhenti: '10/12/2025 08:05' },
    { id: 2, namaFile: 'Looping Video Live 2.mp4', kunciStream: '..........5z1z', durasi: '11h 55m', jadwalkanUlang: 'Setiap Hari', status: 'SCHEDULED', countdownLabel: 'START IN', initialCountdown: parseTime('11:25:39'), jadwalMulai: '09/12/2025 20:40', jadwalBerhenti: '10/12/2025 08:35' },
    { id: 3, namaFile: 'Looping Video Live 3.mp4', kunciStream: '..........9C23', durasi: '11h 55m', jadwalkanUlang: 'Setiap Hari', status: 'SCHEDULED', countdownLabel: 'START IN', initialCountdown: parseTime('11:55:39'), jadwalMulai: '09/12/2025 21:10', jadwalBerhenti: '10/12/2025 09:05' },
    { id: 4, namaFile: 'Looping Video Live 4.mp4', kunciStream: '..........83yw', durasi: '11h 55m', jadwalkanUlang: 'Setiap Hari', status: 'RUNNING', countdownLabel: 'ENDS IN', initialCountdown: parseTime('00:20:48'), jadwalMulai: '08/12/2025 21:40', jadwalBerhenti: '09/12/2025 09:35' },
];

const StatCard = ({ icon, value, label, color }) => (
    <div className="stat-card-jl" style={{ borderColor: color + '33' }}>
        <div className="stat-icon-jl" style={{ color }}>{icon}</div>
        <div className="stat-value-jl" style={{ color }}>{value}</div>
        <div className="stat-label-jl">{label}</div>
    </div>
);

export default function JadwalkanLive() {
    const [streams, setStreams] = useState(() =>
        INIT_STREAMS.map((s) => ({ ...s, countdown: s.initialCountdown }))
    );
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectAll, setSelectAll] = useState(false);

    // ── Live countdown ticker ────────────────────────────────────────────────
    useEffect(() => {
        const id = setInterval(() => {
            setStreams((prev) =>
                prev.map((s) => {
                    if (s.status !== 'SCHEDULED' && s.status !== 'RUNNING') return s;
                    const next = Math.max(0, s.countdown - 1);
                    return { ...s, countdown: next };
                })
            );
        }, 1000);
        return () => clearInterval(id);
    }, []);

    // ── Selection helpers ───────────────────────────────────────────────────
    const toggleSelectAll = () => {
        if (selectAll) setSelectedIds([]);
        else setSelectedIds(streams.map((s) => s.id));
        setSelectAll(!selectAll);
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    // ── Bulk actions ────────────────────────────────────────────────────────
    const mulaiTerpilih = () => {
        setStreams((prev) =>
            prev.map((s) =>
                selectedIds.includes(s.id)
                    ? { ...s, status: 'RUNNING', countdownLabel: 'ENDS IN', countdown: s.initialCountdown }
                    : s
            )
        );
    };

    const stopTerpilih = () => {
        setStreams((prev) =>
            prev.map((s) =>
                selectedIds.includes(s.id)
                    ? { ...s, status: 'SCHEDULED', countdownLabel: 'START IN', countdown: s.initialCountdown }
                    : s
            )
        );
    };

    const hapusTerpilih = () => {
        setStreams((prev) => prev.filter((s) => !selectedIds.includes(s.id)));
        setSelectedIds([]);
        setSelectAll(false);
    };

    // ── Toggle individual row ───────────────────────────────────────────────
    const toggleRowStatus = (id) => {
        setStreams((prev) =>
            prev.map((s) => {
                if (s.id !== id) return s;
                const isRunning = s.status === 'RUNNING';
                return {
                    ...s,
                    status: isRunning ? 'SCHEDULED' : 'RUNNING',
                    countdownLabel: isRunning ? 'START IN' : 'ENDS IN',
                    countdown: s.initialCountdown,
                };
            })
        );
    };

    const runningCount = streams.filter((s) => s.status === 'RUNNING').length;
    const scheduledCount = streams.filter((s) => s.status === 'SCHEDULED').length;

    return (
        <div className="jl-page">
            {/* Status Summary */}
            <div className="jl-summary-section">
                <div className="jl-summary-left">
                    <div className="jl-section-heading">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00b87c" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        RINGKASAN STATUS SIARAN
                    </div>
                    <div className="stats-row">
                        <StatCard icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>} value="3" label="CHANNEL AKTIF" color="#22d3ee" />
                        <StatCard icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>} value={streams.length} label="JUMLAH LIVE" color="#22d3ee" />
                        <StatCard icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>} value={runningCount} label="LIVE AKTIF" color="#f97316" />
                        <StatCard icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>} value={runningCount} label="AKTUAL LIVE" color="#8b5cf6" />
                        <StatCard icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>} value={scheduledCount} label="TERJADWAL" color="#f59e0b" />
                        <StatCard icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>} value="0" label="BLM TERJADWAL" color="#6b7280" />
                        <StatCard icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>} value="2" label="LIVE MATI" color="#ef4444" />
                    </div>
                </div>

                <div className="jl-summary-right">
                    <div className="jl-section-heading">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00b87c" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        GLOBAL METRICS
                    </div>
                    <div className="metrics-list">
                        <div className="metric-row"><div className="metric-dot red-dot"></div><span className="metric-label">SIARAN TERJADWAL</span><span className="metric-value">46</span></div>
                        <div className="metric-row"><div className="metric-dot orange-dot"></div><span className="metric-label">PENONTON SAAT INI</span><span className="metric-value">92</span></div>
                        <div className="metric-row"><div className="metric-dot green-dot"></div><span className="metric-label">KUNCI STREAM AKTIF</span><span className="metric-value">4</span></div>
                    </div>
                </div>
            </div>

            {/* Bulk Action Buttons */}
            <div className="jl-action-row">
                <button className="jl-action-btn btn-mulai-all" onClick={mulaiTerpilih} disabled={selectedIds.length === 0}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    Mulai Semua Terpilih {selectedIds.length > 0 && `(${selectedIds.length})`}
                </button>
                <button className="jl-action-btn btn-stop-all" onClick={stopTerpilih} disabled={selectedIds.length === 0}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><rect x="9" y="9" width="6" height="6"></rect></svg>
                    Stop Semua Terpilih {selectedIds.length > 0 && `(${selectedIds.length})`}
                </button>
                <button className="jl-action-btn btn-hapus-all" onClick={hapusTerpilih} disabled={selectedIds.length === 0}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Hapus Semua Terpilih {selectedIds.length > 0 && `(${selectedIds.length})`}
                </button>
            </div>

            {/* Table */}
            <div className="jl-table-container">
                <table className="jl-table">
                    <thead>
                        <tr>
                            <th width="40"><input type="checkbox" className="custom-checkbox" checked={selectAll} onChange={toggleSelectAll} /></th>
                            <th>Nama File</th>
                            <th>Kunci Stream</th>
                            <th>Durasi</th>
                            <th>Jadwalkan Ulang</th>
                            <th>Status</th>
                            <th>Countdown</th>
                            <th>Jadwal Mulai</th>
                            <th>Jadwal Berhenti</th>
                        </tr>
                    </thead>
                    <tbody>
                        {streams.map((s) => (
                            <tr key={s.id} className={selectedIds.includes(s.id) ? 'row-selected' : ''}>
                                <td><input type="checkbox" className="custom-checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                                <td>
                                    <button className="jl-td-filename-btn" onClick={() => toggleRowStatus(s.id)} title="Klik untuk toggle status">
                                        {s.namaFile}
                                    </button>
                                </td>
                                <td className="jl-td-key">{s.kunciStream}</td>
                                <td>{s.durasi}</td>
                                <td>{s.jadwalkanUlang}</td>
                                <td>
                                    <span className={`jl-status-badge ${s.status === 'RUNNING' ? 'badge-running' : 'badge-scheduled'}`} style={{ cursor: 'pointer' }} onClick={() => toggleRowStatus(s.id)}>
                                        {s.status}
                                    </span>
                                </td>
                                <td>
                                    <div className="jl-countdown">
                                        <div className="countdown-label">{s.countdownLabel}</div>
                                        <div className={`countdown-timer ${s.status === 'RUNNING' ? 'timer-running' : 'timer-scheduled'}`}>
                                            {fmtTime(s.countdown)}
                                        </div>
                                    </div>
                                </td>
                                <td className="jl-td-date">{s.jadwalMulai}</td>
                                <td className="jl-td-date">{s.jadwalBerhenti}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
