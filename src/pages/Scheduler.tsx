import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '../api';
import './Scheduler.css';

interface Schedule {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    status: string;
    stream_key?: string;
    playlist_path?: string;
    is_recurring?: number;
    stream_id?: string;
}

/* ═══════════════════════════════════════════════
   SUB-COMPONENT: COUNTDOWN TIMER
   ════════════════════════════════════════    */
const CountdownTimer = ({ targetDate, status }: { targetDate: string, status: string }) => {
    const [timeLeft, setTimeLeft] = useState('');

    const calculate = useCallback(() => {
        const diff = new Date(targetDate).getTime() - Date.now();
        if (status === 'RUNNING') return 'LIVING NOW';
        if (status === 'COMPLETED') return 'FINISHED';
        if (diff <= 0) return 'DUE';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / 1000 / 60) % 60);
        const secs = Math.floor((diff / 1000) % 60);

        let str = '';
        if (days > 0) str += `${days}d `;
        if (hours > 0 || days > 0) str += `${hours}h `;
        str += `${mins}m ${secs}s`;
        return str;
    }, [targetDate, status]);

    useEffect(() => {
        setTimeLeft(calculate());
        const timer = setInterval(() => setTimeLeft(calculate()), 1000);
        return () => clearInterval(timer);
    }, [calculate]);

    return <span className={`countdown-val ${status.toLowerCase()}`}>{timeLeft}</span>;
};

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════    */
export default function Scheduler() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [showForm, setShowForm] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        start: '',
        end: '',
        stream_key: '',
        playlist_path: '',
        is_recurring: false
    });

    // ── LOAD ──
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiFetch('/api/schedules');
            setSchedules(data);
        } catch (err) {
            console.error('Failed to load schedules', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const i = setInterval(load, 15000);
        return () => clearInterval(i);
    }, [load]);

    // ── ACTIONS ──
    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.start) return alert('Nama dan Waktu Mulai wajib diisi!');

        setLoading(true);
        const payload = {
            ...formData,
            start: new Date(formData.start).toISOString(),
            end: formData.end ? new Date(formData.end).toISOString() : null,
            is_recurring: formData.is_recurring ? 1 : 0
        };

        try {
            if (editingId) {
                await apiFetch(`/api/schedules/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                await apiFetch('/api/schedules', { method: 'POST', body: JSON.stringify(payload) });
            }
            resetForm();
            load();
            setShowForm(false);
        } catch (err: any) {
            alert(err.message || 'Gagal menyimpan jadwal');
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: string, status: string) => {
        try {
            await apiFetch(`/api/schedules/${id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            load();
        } catch (err: any) {
            alert(err.message || 'Gagal update status');
        }
    };

    const remove = async (id: string) => {
        if (!confirm('Hapus jadwal ini?')) return;
        try {
            await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
            load();
        } catch (err) { alert('Gagal hapus'); }
    };

    const resetForm = () => {
        setFormData({ name: '', start: '', end: '', stream_key: '', playlist_path: '', is_recurring: false });
        setEditingId(null);
    };

    const autoGenerate = () => {
        const now = new Date();
        const start = new Date(now.getTime() + 10 * 60000); // 10 min
        const end = new Date(start.getTime() + 120 * 60000); // 2 hour
        setFormData({
            ...formData,
            name: `AI Generated Stream ${now.getHours()}:${now.getMinutes()}`,
            start: start.toISOString().slice(0, 16),
            end: end.toISOString().slice(0, 16),
            is_recurring: false
        });
        setShowForm(true);
    };

    // ── FILTER ──
    const filteredSchedules = useMemo(() => {
        return schedules.filter(s => {
            const matchStatus = filter === 'ALL' || s.status === filter;
            const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
            return matchStatus && matchSearch;
        });
    }, [schedules, filter, search]);

    return (
        <div className="scheduler-page">
            <div className="scheduler-header">
                <div>
                    <h1>📅 Scheduler AI Engine</h1>
                    <p className="subtitle">Atur jadwal penyiaran otomatis 24/7 dengan presisi tinggi.</p>
                </div>
                <div className="header-actions">
                    <button className="btn-secondary" onClick={autoGenerate}>🤖 Auto AI</button>
                    <button className="btn-primary" onClick={() => { resetForm(); setShowForm(!showForm); }}>
                        {showForm ? 'Close Form' : '+ Buat Jadwal'}
                    </button>
                </div>
            </div>

            {/* QUICK STATS */}
            <div className="stats-mini-grid">
                <div className="stat-card">
                    <span className="sc-label">Total Jadwal</span>
                    <span className="sc-val">{schedules.length}</span>
                </div>
                <div className="stat-card running">
                    <span className="sc-label">Sedang Live</span>
                    <span className="sc-val">{schedules.filter(s => s.status === 'RUNNING').length}</span>
                </div>
                <div className="stat-card upcoming">
                    <span className="sc-label">Akan Datang</span>
                    <span className="sc-val">{schedules.filter(s => s.status === 'SCHEDULED').length}</span>
                </div>
            </div>

            {/* FORM TOGGLE */}
            {showForm && (
                <div className="form-card animate-slide-down">
                    <h3>{editingId ? 'Edit Jadwal' : 'Buat Jadwal Baru'}</h3>
                    <form onSubmit={save} className="sched-form-grid">
                        <div className="form-item full">
                            <label>Nama Acara / Judul Konten</label>
                            <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Contoh: Live Musik 24 Jam" required />
                        </div>
                        <div className="form-item">
                            <label>Waktu Mulai</label>
                            <input type="datetime-local" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} required />
                        </div>
                        <div className="form-item">
                            <label>Waktu Berakhir (Opsional)</label>
                            <input type="datetime-local" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} />
                        </div>
                        <div className="form-item">
                            <label>Stream Key (YouTube/FB)</label>
                            <input value={formData.stream_key} onChange={e => setFormData({...formData, stream_key: e.target.value})} placeholder="Tinggalkan kosong jika otomatis" />
                        </div>
                        <div className="form-item">
                            <label>Playlist/Video Path</label>
                            <input value={formData.playlist_path} onChange={e => setFormData({...formData, playlist_path: e.target.value})} placeholder="/path/to/video.mp4" />
                        </div>
                        <div className="form-footer full">
                            <label className="checkbox-label">
                                <input type="checkbox" checked={formData.is_recurring} onChange={e => setFormData({...formData, is_recurring: e.target.checked})} />
                                <span>Ulangi Jadwal (Recurring)</span>
                            </label>
                            <div className="form-btns">
                                <button type="button" className="btn-cancel" onClick={() => { resetForm(); setShowForm(false); }}>Batal</button>
                                <button type="submit" className="btn-save" disabled={loading}>{loading ? 'Memproses...' : (editingId ? 'Update' : 'Simpan Jadwal')}</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* TOOLBAR */}
            <div className="sched-toolbar">
                <div className="search-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input placeholder="Cari jadwal..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="filter-tabs">
                    {['ALL', 'SCHEDULED', 'RUNNING', 'COMPLETED'].map(f => (
                        <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
                    ))}
                </div>
            </div>

            {/* GRID OF SCHEDULE CARDS */}
            <div className="schedules-grid">
                {filteredSchedules.length === 0 ? (
                    <div className="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <p>Tidak ada jadwal ditemukan.</p>
                    </div>
                ) : (
                    filteredSchedules.map(s => (
                        <div key={s.id} className={`schedule-card ${s.status.toLowerCase()}`}>
                            <div className="card-header">
                                <div className={`status-dot ${s.status.toLowerCase()}`} />
                                <span className="status-label">{s.status}</span>
                                <div className="card-actions">
                                    <button onClick={() => {
                                        setEditingId(s.id);
                                        setFormData({
                                            name: s.name,
                                            start: s.start_time.slice(0, 16),
                                            end: s.end_time ? s.end_time.slice(0, 16) : '',
                                            stream_key: s.stream_key || '',
                                            playlist_path: s.playlist_path || '',
                                            is_recurring: !!s.is_recurring
                                        });
                                        setShowForm(true);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }} title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                    <button onClick={() => remove(s.id)} title="Hapus"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                                </div>
                            </div>
                            <div className="card-body">
                                <h3>{s.name}</h3>
                                <div className="time-info">
                                    <div className="time-row">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                        <span>{new Date(s.start_time).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="countdown-row">
                                        <CountdownTimer targetDate={s.start_time} status={s.status} />
                                    </div>
                                </div>
                                {s.playlist_path && (
                                    <div className="source-info">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                        <span title={s.playlist_path}>{s.playlist_path.split('/').pop()}</span>
                                    </div>
                                )}
                            </div>
                            <div className="card-footer">
                                {s.status === 'RUNNING' ? (
                                    <button className="btn-stop" onClick={() => updateStatus(s.id, 'COMPLETED')}>STOP STREAM</button>
                                ) : (
                                    <button className="btn-start" onClick={() => updateStatus(s.id, 'RUNNING')}>START NOW</button>
                                ) }
                                {s.is_recurring ? <span className="recurring-tag">RECURRING</span> : null}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
