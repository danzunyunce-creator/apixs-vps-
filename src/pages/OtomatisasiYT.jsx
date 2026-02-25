import { useState, useEffect, useCallback } from 'react';
import './OtomatisasiYT.css';

/* ─── Mock Data ────────────────────────────────────────────────── */
const AUTOMATION_RULES = [
    { id: 1, name: 'Auto Start Live', desc: 'Mulai live stream otomatis sesuai jadwal', category: 'schedule', enabled: true, icon: '▶', schedule: 'Setiap Hari · 20:00 WIB', lastRun: '24 Feb 2026, 20:00', successRate: 98 },
    { id: 2, name: 'Auto Chat Welcome', desc: 'Kirim pesan selamat datang ke penonton baru', category: 'chatbot', enabled: true, icon: '💬', schedule: 'Saat Live Aktif', lastRun: '24 Feb 2026, 21:30', successRate: 100 },
    { id: 3, name: 'Auto Thumbnail', desc: 'Generate thumbnail otomatis dari frame terbaik', category: 'content', enabled: false, icon: '🖼️', schedule: 'Setiap Video Baru', lastRun: '23 Feb 2026, 14:00', successRate: 85 },
    { id: 4, name: 'Auto Title & Deskripsi', desc: 'Update judul dengan tanggal dan template', category: 'content', enabled: true, icon: '📝', schedule: 'Setiap Live Dimulai', lastRun: '24 Feb 2026, 20:00', successRate: 100 },
    { id: 5, name: 'Auto Replay Upload', desc: 'Upload rekaman live otomatis setelah selesai', category: 'content', enabled: false, icon: '📤', schedule: 'Setelah Live Berakhir', lastRun: '24 Feb 2026, 08:05', successRate: 92 },
    { id: 6, name: 'Notifikasi Telegram', desc: 'Kirim notifikasi ke Telegram saat live mulai/selesai', category: 'notification', enabled: true, icon: '🔔', schedule: 'Realtime Event', lastRun: '24 Feb 2026, 20:00', successRate: 100 },
    { id: 7, name: 'Anti-Spam Chat Filter', desc: 'Filter pesan spam & link mencurigakan di chat', category: 'chatbot', enabled: true, icon: '🛡️', schedule: 'Saat Live Aktif', lastRun: '24 Feb 2026, 22:15', successRate: 97 },
    { id: 8, name: 'Auto End Stream', desc: 'Matikan live otomatis setelah durasi tertentu', category: 'schedule', enabled: true, icon: '⏹️', schedule: 'Setelah 12 jam', lastRun: '25 Feb 2026, 08:00', successRate: 100 },
];

const LOG_ENTRIES = [
    { id: 1, time: '20:00:01', date: '25 Feb', type: 'success', rule: 'Auto Start Live', message: 'Stream dimulai — Channel: Cocina Deliciosa' },
    { id: 2, time: '20:00:02', date: '25 Feb', type: 'success', rule: 'Auto Title & Deskripsi', message: 'Judul diupdate: "Live Cooking 25 Feb 2026"' },
    { id: 3, time: '20:00:03', date: '25 Feb', type: 'info', rule: 'Notifikasi Telegram', message: 'Notifikasi terkirim ke @apixs_bot' },
    { id: 4, time: '20:01:15', date: '25 Feb', type: 'success', rule: 'Auto Chat Welcome', message: 'Pesan welcome dikirim ke 3 penonton baru' },
    { id: 5, time: '20:05:30', date: '25 Feb', type: 'warning', rule: 'Anti-Spam Chat Filter', message: '2 pesan spam diblokir dari user @random123' },
    { id: 6, time: '20:30:00', date: '25 Feb', type: 'success', rule: 'Auto Chat Welcome', message: 'Pesan welcome dikirim ke 8 penonton baru' },
    { id: 7, time: '08:00:00', date: '25 Feb', type: 'success', rule: 'Auto End Stream', message: 'Stream dihentikan otomatis — durasi 12:00:00' },
    { id: 8, time: '08:01:00', date: '25 Feb', type: 'error', rule: 'Auto Replay Upload', message: 'Upload gagal — Kuota API harian tercapai' },
];

const CATEGORIES = [
    { key: 'all', label: 'Semua', icon: '📋' },
    { key: 'schedule', label: 'Jadwal', icon: '📅' },
    { key: 'chatbot', label: 'Chat Bot', icon: '🤖' },
    { key: 'content', label: 'Konten', icon: '🎬' },
    { key: 'notification', label: 'Notifikasi', icon: '🔔' },
];

/* ─── Components ───────────────────────────────────────────────── */
const StatCard = ({ icon, value, label, color, sub }) => (
    <div className="ot-stat-card" style={{ '--stat-color': color }}>
        <div className="ot-stat-icon">{icon}</div>
        <div className="ot-stat-body">
            <div className="ot-stat-value">{value}</div>
            <div className="ot-stat-label">{label}</div>
            {sub && <div className="ot-stat-sub">{sub}</div>}
        </div>
    </div>
);

function AddRuleModal({ onClose, onAdd }) {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [category, setCategory] = useState('schedule');
    const [schedule, setSchedule] = useState('');

    useEffect(() => {
        const fn = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [onClose]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !schedule.trim()) return;
        onAdd({
            id: Date.now(),
            name: name.trim(),
            desc: desc.trim() || 'Rule otomatisasi kustom',
            category,
            enabled: true,
            icon: category === 'schedule' ? '📅' : category === 'chatbot' ? '🤖' : category === 'content' ? '🎬' : '🔔',
            schedule: schedule.trim(),
            lastRun: 'Belum pernah',
            successRate: 0,
        });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box ot-add-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00b87c" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                        Tambah Rule Otomatisasi
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <form className="modal-form" onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
                    <div className="form-group">
                        <label className="form-label">Nama Rule <span className="required">*</span></label>
                        <input className="form-input" type="text" placeholder="cth: Auto Start Malam" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Deskripsi</label>
                        <input className="form-input" type="text" placeholder="cth: Mulai live jam 8 malam" value={desc} onChange={(e) => setDesc(e.target.value)} />
                    </div>
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div className="form-group">
                            <label className="form-label">Kategori</label>
                            <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)} style={{ cursor: 'pointer' }}>
                                <option value="schedule">📅 Jadwal</option>
                                <option value="chatbot">🤖 Chat Bot</option>
                                <option value="content">🎬 Konten</option>
                                <option value="notification">🔔 Notifikasi</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Jadwal <span className="required">*</span></label>
                            <input className="form-input" type="text" placeholder="cth: Setiap Hari · 20:00" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
                        </div>
                    </div>
                    <div className="modal-footer" style={{ borderTop: '1px solid #212631', paddingTop: '16px', marginTop: '8px' }}>
                        <button type="button" className="modal-btn-cancel" onClick={onClose}>Batal</button>
                        <button type="submit" className="modal-btn-submit" disabled={!name.trim() || !schedule.trim()} style={{ opacity: (!name.trim() || !schedule.trim()) ? 0.45 : 1 }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                            Tambah Rule
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Main Component ───────────────────────────────────────────── */
export default function OtomatisasiYT() {
    const [rules, setRules] = useState(AUTOMATION_RULES);
    const [logs] = useState(LOG_ENTRIES);
    const [activeCategory, setActiveCategory] = useState('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [logFilter, setLogFilter] = useState('all'); // all | success | warning | error

    const enabledCount = rules.filter(r => r.enabled).length;
    const avgSuccess = Math.round(rules.reduce((s, r) => s + r.successRate, 0) / rules.length);

    const filtered = rules.filter(r => activeCategory === 'all' || r.category === activeCategory);

    const toggleRule = (id) => {
        setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    };

    const deleteRule = (id) => {
        setRules(prev => prev.filter(r => r.id !== id));
    };

    const filteredLogs = logs.filter(l => logFilter === 'all' || l.type === logFilter);

    return (
        <>
            {showAddModal && <AddRuleModal onClose={() => setShowAddModal(false)} onAdd={(r) => setRules(prev => [...prev, r])} />}

            <div className="ot-page">
                {/* ── Stats ── */}
                <div className="ot-stats-row">
                    <StatCard icon="⚡" value={rules.length} label="TOTAL RULES" color="#22d3ee" />
                    <StatCard icon="✅" value={enabledCount} label="AKTIF" color="#00b87c" sub={`${rules.length - enabledCount} nonaktif`} />
                    <StatCard icon="📊" value={`${avgSuccess}%`} label="SUCCESS RATE" color="#8b5cf6" />
                    <StatCard icon="📅" value={logs.length} label="LOG HARI INI" color="#f59e0b" sub={`${logs.filter(l => l.type === 'error').length} error`} />
                </div>

                <div className="ot-main-grid">
                    {/* ── LEFT: Rules ── */}
                    <div className="ot-rules-panel">
                        <div className="ot-panel-header">
                            <div className="ot-panel-title">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b87c" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                AUTOMATION RULES
                            </div>
                            <button className="ot-add-btn" onClick={() => setShowAddModal(true)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                                TAMBAH RULE
                            </button>
                        </div>

                        {/* Category Filter */}
                        <div className="ot-cat-filter">
                            {CATEGORIES.map(c => (
                                <button key={c.key} className={`ot-cat-btn ${activeCategory === c.key ? 'ot-cat-active' : ''}`} onClick={() => setActiveCategory(c.key)}>
                                    <span>{c.icon}</span> {c.label}
                                    <span className="ot-cat-count">{c.key === 'all' ? rules.length : rules.filter(r => r.category === c.key).length}</span>
                                </button>
                            ))}
                        </div>

                        {/* Rules List */}
                        <div className="ot-rules-list">
                            {filtered.map(rule => (
                                <div key={rule.id} className={`ot-rule-card ${rule.enabled ? '' : 'rule-disabled'}`}>
                                    <div className="rule-icon-box">{rule.icon}</div>
                                    <div className="rule-info">
                                        <div className="rule-name">
                                            {rule.name}
                                            <span className={`rule-badge badge-${rule.category}`}>{rule.category}</span>
                                        </div>
                                        <div className="rule-desc">{rule.desc}</div>
                                        <div className="rule-meta">
                                            <span className="rule-schedule">
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                {rule.schedule}
                                            </span>
                                            <span className="rule-last-run">Terakhir: {rule.lastRun}</span>
                                        </div>
                                    </div>
                                    <div className="rule-right">
                                        <div className="rule-success">
                                            <div className="success-bar-bg">
                                                <div className="success-bar-fill" style={{ width: `${rule.successRate}%`, background: rule.successRate >= 95 ? '#00b87c' : rule.successRate >= 80 ? '#f59e0b' : '#ef4444' }}></div>
                                            </div>
                                            <span className="success-pct">{rule.successRate}%</span>
                                        </div>
                                        <div className="rule-actions">
                                            <button className={`toggle-switch ${rule.enabled ? 'toggle-on' : ''}`} onClick={() => toggleRule(rule.id)} title={rule.enabled ? 'Nonaktifkan' : 'Aktifkan'}>
                                                <span className="toggle-thumb"></span>
                                            </button>
                                            <button className="rule-delete-btn" onClick={() => deleteRule(rule.id)} title="Hapus rule">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filtered.length === 0 && (
                                <div className="ot-empty">Tidak ada rule di kategori ini</div>
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT: Activity Log ── */}
                    <div className="ot-log-panel">
                        <div className="ot-panel-header">
                            <div className="ot-panel-title">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2172e5" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                                ACTIVITY LOG
                            </div>
                            <div className="ot-log-filters">
                                {['all', 'success', 'warning', 'error'].map(f => (
                                    <button key={f} className={`ot-log-filter ${logFilter === f ? 'ot-lf-active' : ''}`} onClick={() => setLogFilter(f)}>
                                        {f === 'all' ? 'Semua' : f === 'success' ? '✅' : f === 'warning' ? '⚠️' : '❌'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="ot-log-list">
                            {filteredLogs.map(log => (
                                <div key={log.id} className={`ot-log-item log-${log.type}`}>
                                    <div className="log-time-col">
                                        <span className="log-time">{log.time}</span>
                                        <span className="log-date">{log.date}</span>
                                    </div>
                                    <div className={`log-dot dot-${log.type}`}></div>
                                    <div className="log-body">
                                        <div className="log-rule">{log.rule}</div>
                                        <div className="log-message">{log.message}</div>
                                    </div>
                                </div>
                            ))}
                            {filteredLogs.length === 0 && <div className="ot-empty">Tidak ada log untuk filter ini</div>}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
