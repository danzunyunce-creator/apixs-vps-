import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, Play, Square, Edit3, Trash2, 
  RotateCw, Search, Plus, Filter, Globe, Key, Copy
} from 'lucide-react';
import { apiFetch } from '../api';
import './ModuleCommon.css';
import './Scheduler.css';

interface Schedule {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    status: string;
    stream_key?: string;
    playlist_path?: string;
    youtube_account_id?: string;
    is_recurring?: number;
    platform?: string;
    privacy?: string;
    category?: string;
    is_upload?: number;
}

export default function Scheduler() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [showForm, setShowForm] = useState(false);
    const [channels, setChannels] = useState<any[]>([]);
    const [videos, setVideos] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        start: '',
        end: '',
        stream_key: '',
        playlist_path: '',
        youtube_account_id: '',
        is_recurring: false,
        privacy: 'public',
        category: 'Entertainment',
        is_upload: true,
        start: new Date(Date.now() + 3600000).toISOString().slice(0, 16)
    });

    const loadData = useCallback(async () => {
        try {
            const [scheds, chans, vids] = await Promise.all([
                apiFetch('/api/schedules', { skipCache: true }),
                apiFetch('/api/automation/youtube/channels'),
                apiFetch('/api/media/videos')
            ]);
            setSchedules(scheds || []);
            setChannels(chans || []);
            setVideos(vids || []);
        } catch (err) {
            console.error('Scheduler Load Error:', err);
        }
    }, []);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, [loadData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                is_recurring: formData.is_recurring ? 1 : 0,
                is_upload: formData.is_upload ? 1 : 0
            };
            if (editingId) {
                await apiFetch(`/api/schedules/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                await apiFetch('/api/schedules', { method: 'POST', body: JSON.stringify(payload) });
            }
            setShowForm(false);
            setEditingId(null);
            loadData();
        } catch (err: any) {
            alert('Gagal simpan: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus jadwal ini?')) return;
        await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
        loadData();
    };

    const toggleStatus = async (id: string, currentStatus: string) => {
        const nextStatus = currentStatus === 'RUNNING' ? 'COMPLETED' : 'RUNNING';
        await apiFetch(`/api/schedules/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: nextStatus }) });
        loadData();
    };

    const handleDuplicate = (s: Schedule) => {
        setFormData({
            name: `${s.name} (Copy)`,
            start: s.start_time.slice(0, 16),
            end: s.end_time ? s.end_time.slice(0, 16) : '',
            youtube_account_id: s.youtube_account_id || '',
            playlist_path: s.playlist_path || '',
            stream_key: s.stream_key || '',
            is_recurring: !!s.is_recurring,
            privacy: s.privacy || 'public',
            category: s.category || 'Entertainment',
            is_upload: !!s.is_upload
        });
        setEditingId(null);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast.success('Manifest copied to creator.');
    };

    const filtered = useMemo(() => {
        return schedules.filter(s => {
            const matchStatus = filter === 'ALL' || s.status === filter;
            const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
            return matchStatus && matchSearch;
        });
    }, [schedules, filter, search]);

    return (
        <motion.div 
            className="scheduler-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}
        >
            {/* ELITE HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <Calendar size={36} color="#6366f1" /> Scheduling Center
                    </h1>
                    <div className="sub-header">Plan, Automate, and Stream 24/7 with zero downtime.</div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="neon-btn"
                        onClick={() => { setEditingId(null); setShowForm(!showForm); }}
                    >
                        <Plus size={18} /> {showForm ? 'Close Engine' : 'Configure Schedule'}
                    </motion.button>
                </div>
            </div>

            {/* QUICK TIMELINE VISUALIZER (BETA) */}
            <div className="timeline-scroll-resp">
                <TimelineOverview schedules={schedules} />
            </div>

            <div className="responsive-grid-stack" style={{ display: 'grid', gridTemplateColumns: showForm ? '450px 1fr' : '1fr', gap: '30px', transition: 'all 0.3s' }}>
                <AnimatePresence>
                    {showForm && (
                        <motion.div 
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="glass-card-pro"
                        >
                            <h3>{editingId ? 'Edit Manifest' : 'New Broadcast Manifest'}</h3>
                            <form onSubmit={handleSave} style={{ marginTop: '20px' }}>
                                <div className="form-group-premium">
                                    <label className="premium-label">JUDUL VIDEO</label>
                                    <input 
                                        className="premium-input" 
                                        value={formData.name} 
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        placeholder="Looped Video" 
                                        required 
                                    />
                                </div>

                                <div className="form-group-premium">
                                    <label className="premium-label">YOUTUBE CHANNEL *</label>
                                    <select className="premium-input" value={formData.youtube_account_id} onChange={e => setFormData({...formData, youtube_account_id: e.target.value})} required>
                                        <option value="">Pilih channel...</option>
                                        {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.channel_name}</option>)}
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <div className="form-group-premium">
                                        <label className="premium-label">PRIVACY</label>
                                        <select className="premium-input" value={formData.privacy} onChange={e => setFormData({...formData, privacy: e.target.value})}>
                                            <option value="public">Public</option>
                                            <option value="private">Private</option>
                                            <option value="unlisted">Unlisted</option>
                                        </select>
                                    </div>
                                    <div className="form-group-premium">
                                        <label className="premium-label">CATEGORY</label>
                                        <select className="premium-input" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                            <option value="Entertainment">Entertainment</option>
                                            <option value="Music">Music</option>
                                            <option value="Gaming">Gaming</option>
                                            <option value="Education">Education</option>
                                            <option value="News">News</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="premium-switch-group">
                                    <div className="switch-label-row">
                                        <Calendar size={18} color="#6366f1" />
                                        <span>Jadwalkan Upload</span>
                                    </div>
                                    <div 
                                        onClick={() => setFormData({...formData, is_upload: !formData.is_upload})}
                                        style={{ 
                                            width: '50px', height: '26px', background: formData.is_upload ? '#22c55e' : '#334155', 
                                            borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s' 
                                        }}
                                    >
                                        <motion.div 
                                            animate={{ x: formData.is_upload ? 26 : 4 }}
                                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                            style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', top: '4px' }}
                                        />
                                    </div>
                                </div>

                                {formData.is_upload && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ overflow: 'hidden', marginTop: '15px' }}>
                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ marginBottom: '15px' }}>
                                                <label className="premium-label">TANGGAL</label>
                                                <input type="date" className="premium-input" value={formData.start?.split('T')[0]} onChange={e => setFormData({...formData, start: `${e.target.value}T${formData.start?.split('T')[1] || '12:00'}`})} />
                                            </div>
                                            <div>
                                                <label className="premium-label">JAM (WIB - JAKARTA)</label>
                                                <input type="time" className="premium-input" value={formData.start?.split('T')[1]} onChange={e => setFormData({...formData, start: `${formData.start?.split('T')[0]}T${e.target.value}`})} />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                <div className="policy-warning-note">
                                    <div className="warning-icon"><Clock size={18} /></div>
                                    <div className="warning-text">
                                        Privacy otomatis diset ke <strong>Private</strong> (syarat YouTube). Video akan dipublish otomatis pada waktu yang dijadwalkan.
                                        <div className="warning-footer">Minimal 30 menit dari sekarang. Timezone: WIB (UTC+7).</div>
                                    </div>
                                </div>

                                <div className="form-group-premium" style={{ marginTop: '20px' }}>
                                    <label className="premium-label">MASTER VIDEO</label>
                                    <select className="premium-input" value={formData.playlist_path} onChange={e => setFormData({...formData, playlist_path: e.target.value})} required>
                                        <option value="">Select source video...</option>
                                        {videos.map(v => <option key={v.id} value={v.filepath}>{v.title}</option>)}
                                    </select>
                                </div>

                                <button type="submit" disabled={loading} className="neon-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                                    {loading ? 'DEPLOYING...' : 'SAVE SCHEDULE'}
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="pro-grid">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ position: 'relative', width: '300px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b' }} />
                            <input 
                                className="pro-input" 
                                style={{ paddingLeft: '40px' }} 
                                placeholder="Filter manifest..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="responsive-flex" style={{ display: 'flex', gap: '10px' }}>
                            {['ALL', 'SCHEDULED', 'RUNNING'].map(f => (
                                <button 
                                    key={f} 
                                    onClick={() => setFilter(f)}
                                    style={{ 
                                        background: filter === f ? '#6366f1' : 'rgba(255,255,255,0.05)',
                                        color: filter === f ? 'white' : '#64748b',
                                        border: 'none', padding: '5px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem'
                                    }}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                        <AnimatePresence>
                            {filtered.map((s, i) => (
                                <motion.div 
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: i * 0.05 }}
                                    key={s.id} 
                                    className="glass-card-pro"
                                    style={{ position: 'relative', overflow: 'hidden' }}
                                >
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: s.status === 'RUNNING' ? '#10b981' : '#6366f1' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                        <PlatformIcon channelId={s.youtube_account_id} />
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>#{s.id.slice(-4)}</div>
                                    </div>
                                    <h4 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>{s.name}</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '15px' }}>
                                        <Clock size={14} /> {new Date(s.start_time).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                    </div>
                                    
                                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '10px', marginBottom: '20px' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '4px' }}>MASTER SOURCE</div>
                                        <div style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.playlist_path?.split('/').pop()}</div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <ActionButton icon={<Edit3 size={14}/>} onClick={() => { setEditingId(s.id); setFormData({
                                                name: s.name,
                                                start: s.start_time.slice(0, 16),
                                                end: s.end_time?.slice(0, 16) || '',
                                                youtube_account_id: s.youtube_account_id || '',
                                                playlist_path: s.playlist_path || '',
                                                stream_key: s.stream_key || '',
                                                is_recurring: !!s.is_recurring
                                            }); setShowForm(true); }} />
                                            <ActionButton icon={<Copy size={14}/>} onClick={() => handleDuplicate(s)} />
                                            <ActionButton icon={<Trash2 size={14}/>} onClick={() => handleDelete(s.id)} danger />
                                        </div>
                                        <button 
                                            onClick={() => toggleStatus(s.id, s.status)}
                                            style={{ 
                                                background: s.status === 'RUNNING' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                color: s.status === 'RUNNING' ? '#ef4444' : '#10b981',
                                                border: 'none', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
                                                display: 'flex', alignItems: 'center', gap: '6px'
                                            }}
                                        >
                                            {s.status === 'RUNNING' ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                            {s.status === 'RUNNING' ? 'STOP' : 'START'}
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

const TimelineOverview = ({ schedules }: { schedules: Schedule[] }) => {
    // Basic daily timeline visualizer
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const now = new Date();
    const currentHourPercent = ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100;

    return (
        <div className="glass-card-pro" style={{ marginBottom: '30px', padding: '15px 25px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', letterSpacing: '1px' }}>24H OPERATIONS TIMELINE</div>
            <div style={{ position: 'relative', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginBottom: '8px' }}>
                {schedules && schedules.length > 0 && schedules.filter(s => s.status !== 'COMPLETED').map(s => {
                    const start = new Date(s.start_time);
                    // Check if it's today
                    const isToday = start.getFullYear() === now.getFullYear() && 
                                    start.getMonth() === now.getMonth() && 
                                    start.getDate() === now.getDate();
                    
                    if (!isToday) return null;
                    
                    const left = ((start.getHours() * 60 + start.getMinutes()) / (24 * 60)) * 100;
                    const durationPercent = 2; // Fixed width for blocks for now
                    
                    return (
                        <motion.div 
                            key={s.id} 
                            initial={{ opacity: 0, scaleY: 0 }}
                            animate={{ opacity: 1, scaleY: 1 }}
                            style={{ 
                                position: 'absolute', left: `${left}%`, top: 0, width: `${durationPercent}%`, height: '100%', 
                                background: s.status === 'RUNNING' ? '#10b981' : '#6366f1',
                                borderRadius: '10px', 
                                boxShadow: s.status === 'RUNNING' ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
                                zIndex: s.status === 'RUNNING' ? 2 : 1
                            }} 
                            title={`${s.name} (${new Date(s.start_time).toLocaleTimeString()})`}
                        />
                    );
                })}
                <motion.div 
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    style={{ position: 'absolute', left: `${currentHourPercent}%`, top: '-4px', height: '20px', width: '2px', background: '#f43f5e', zIndex: 3, boxShadow: '0 0 8px #f43f5e' }} 
                />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#475569', fontWeight: 600 }}>
                {hours.filter(h => h % 3 === 0).map(h => <span key={h}>{h}:00</span>)}
            </div>
        </div>
    );
};

const ActionButton = ({ icon, onClick, danger }: any) => (
    <motion.button 
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        style={{ 
            background: 'rgba(255,255,255,0.05)', 
            border: 'none', color: danger ? '#ef4444' : '#64748b', 
            padding: '8px', borderRadius: '8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
    >
        {icon}
    </motion.button>
);

const PlatformIcon = ({ channelId }: { channelId?: string }) => {
    if (channelId) return <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 800 }}><Play size={16} /> YOUTUBE</div>;
    return <div style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 800 }}><Globe size={16} /> RTMP CUSTOM</div>;
};
