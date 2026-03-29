import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '../api';
import './StreamManagement.css';

interface Stream {
    id: string;
    title: string;
    status: string;
    node?: string;
    viewer_count?: number;
}

interface Node {
    id: string;
    name: string;
    url: string;
    load: number;
    status: string;
    last_seen?: string;
}

interface Schedule {
    id: string;
    stream_id: string;
    start_time: string;
    end_time: string;
    status: string;
}

export default function StreamManagement() {
    const [streams, setStreams] = useState<Stream[]>([]);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'warn'|'error'|'success'}[]>([]);
    const [loading, setLoading] = useState(false);
    const [allVideos, setAllVideos] = useState<any[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [newStream, setNewStream] = useState({
        title: '',
        platform: 'YOUTUBE',
        rtmp_url: 'rtmp://a.rtmp.youtube.com/live2',
        stream_key: '',
        playlist_path: '',
        destinations: [] as any[]
    });

    // ── DATA FETCHING ──
    const loadAll = useCallback(async () => {
        try {
            const [s, n, sch, vids] = await Promise.all([
                apiFetch('/api/streams'),
                apiFetch('/api/nodes'),
                apiFetch('/api/schedules'),
                apiFetch('/api/media/videos')
            ]);
            setStreams(s || []);
            setNodes(n || []);
            setSchedules(sch || []);
            setAllVideos(vids || []);
        } catch (err) {
            addLog('Gagal memuat data sistem', 'error');
        }
    }, []);

    useEffect(() => {
        loadAll();
        const timer = setInterval(() => {
            loadAll();
            // Catatan: Logika AutoScheduler sebaiknya dipindah ke backend AutomationEngine
        }, 30000); // Polling lebih santai (30s) karena ada Socket.io nantinya
        return () => clearInterval(timer);
    }, [loadAll]);

    // ── LOGIC ──
    const addLog = (msg: string, type: 'info'|'warn'|'error'|'success' = 'info') => {
        const time = new Date().toLocaleTimeString('id-ID');
        setLogs(prev => [{ time, msg, type }, ...prev.slice(0, 29)]);
    };

    const pickBestNode = () => {
        const onlineNodes = nodes.filter(n => n.status === 'ONLINE');
        if (!onlineNodes.length) return null;
        return [...onlineNodes].sort((a, b) => a.load - b.load)[0];
    };

    const handleAction = async (id: string, action: 'start' | 'stop') => {
        const node = pickBestNode();
        if (!node && action === 'start') return alert('Tidak ada VPS Online yang tersedia!');
        
        const stream = streams.find(s => s.id === id);
        const targetNode = action === 'start' ? node : nodes.find(n => n.id === stream?.node);
        
        if (!targetNode && action === 'stop') {
             // Fallback to main if no node specified
             addLog(`Berhenti manual via server utama: ${id}`, 'warn');
        }

        const url = targetNode ? `${targetNode.url}/api/streams/${id}/${action}` : `/api/streams/${id}/${action}`;
        
        try {
            addLog(`${action.toUpperCase()} request sent for ${id} to ${targetNode?.name || 'Local'}`, 'info');
            await apiFetch(url, { method: 'POST' });
            loadAll();
        } catch (err: any) {
            addLog(`Error ${action}: ${err.message}`, 'error');
        }
    };

    const handleCreateStream = async () => {
        if (!newStream.title || !newStream.playlist_path) return alert('Judul dan Media wajib diisi!');
        
        try {
            setLoading(true);
            const res = await apiFetch('/api/streams', {
                method: 'POST',
                body: JSON.stringify({
                    ...newStream,
                    rtmp_url: newStream.rtmp_url,
                    stream_key: newStream.stream_key
                })
            });

            // If we have multi-destinations, save them
            if (newStream.destinations.length > 0) {
                for (const dest of newStream.destinations) {
                    await apiFetch(`/api/streams/${res.id}/destinations`, {
                        method: 'POST',
                        body: JSON.stringify(dest)
                    });
                }
            }

            setShowAddModal(false);
            setNewStream({ title: '', platform: 'YOUTUBE', rtmp_url: 'rtmp://a.rtmp.youtube.com/live2', stream_key: '', playlist_path: '', destinations: [] });
            loadAll();
            addLog(`Stream "${newStream.title}" berhasil dibuat`, 'success');
        } catch (err: any) {
            alert('Gagal membuat stream: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const generateAIMetadata = async () => {
        if (!newStream.title) return alert('Masukkan judul dasar terlebih dahulu!');
        try {
            setAiLoading(true);
            const res = await apiFetch('/api/automation/ai-metadata', {
                method: 'POST',
                body: JSON.stringify({ title: newStream.title })
            });
            setNewStream({ ...newStream, title: res.title });
            // In a more advanced UI, we'd also set auto_description
            addLog('AI Magic Wand: Konten berhasil dioptimasi!', 'success');
        } catch (e: any) {
            alert('AI Error: ' + e.message);
        } finally {
            setAiLoading(false);
        }
    };

    const addDestination = () => {
        setNewStream({
            ...newStream,
            destinations: [...newStream.destinations, { name: 'New Platform', platform: 'OTHER', rtmp_url: '', stream_key: '' }]
        });
    };

    const updateDest = (index: number, field: string, val: string) => {
        const next = [...newStream.destinations];
        next[index] = { ...next[index], [field]: val };
        setNewStream({ ...newStream, destinations: next });
    };

    const removeDest = (index: number) => {
        setNewStream({
            ...newStream,
            destinations: newStream.destinations.filter((_, i) => i !== index)
        });
    };

    // ── UI HELPERS ──
    const getLoadColor = (load: number) => {
        if (load < 50) return '#22c55e';
        if (load < 80) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className="stream-mgmt-container">
            <div className="mgmt-header">
                <div>
                    <h1>🌐 Multi-Node Controller</h1>
                    <p className="subtitle">Manajemen distribusi siaran di seluruh infrastruktur VPS.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-add-stream" onClick={() => setShowAddModal(true)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        New Stream
                    </button>
                    <button className="btn-refresh" onClick={loadAll} disabled={loading}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                        Sync Data
                    </button>
                </div>
            </div>

            <div className="mgmt-main-grid">
                
                {/* LEFT: VPS NODES DASHBOARD */}
                <section className="vps-section">
                    <div className="section-title">
                        <h3>🖥️ VPS Infrastructure</h3>
                        <span className="badge">{nodes.length} Nodes</span>
                    </div>
                    <div className="nodes-grid">
                        {nodes.length === 0 ? <p className="empty">Belum ada VPS yang terdaftar.</p> : 
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
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* RECENT LOGS AREA */}
                    <div className="logs-area">
                         <div className="section-title">
                            <h3>📡 Active Logs</h3>
                            <button className="btn-clear" onClick={() => setLogs([])}>Clear</button>
                        </div>
                        <div className="log-list">
                            {logs.length === 0 ? <p className="empty-logs">Menunggu aktivitas sistem...</p> : 
                            logs.map((l, i) => (
                                <div key={i} className={`log-item ${l.type}`}>
                                    <span className="log-time">[{l.time}]</span>
                                    <span className="log-msg">{l.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* RIGHT: ACTIVE STREAMS & SCHEDULER MONITOR */}
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
                        {streams.length === 0 ? <p className="empty">Tidak ada channel siaran.</p> : 
                        streams.map(s => (
                            <div key={s.id} className="stream-flat-card">
                                <div className="s-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={s.status === 'RUNNING' ? '#22c55e' : '#64748b'} strokeWidth="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                                </div>
                                <div className="s-info">
                                    <h4>{s.title}</h4>
                                    <div className="s-meta">
                                        <span className={`s-status ${s.status.toLowerCase()}`}>{s.status}</span>
                                        {s.node && <span className="s-node">VPS: {nodes.find(n => n.id === s.node)?.name || s.node}</span>}
                                    </div>
                                </div>
                                <div className="s-viewers">
                                    {s.status === 'RUNNING' && (
                                        <span className="viewer-count"><span className="pulse-red" /> {s.viewer_count || 0}</span>
                                    )}
                                </div>
                                <div className="s-actions">
                                    {s.status === 'RUNNING' ? (
                                        <button className="btn-action stop" title="Stop Stream" onClick={() => handleAction(s.id, 'stop')}>
                                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="6" y="6" width="12" height="12"/></svg>
                                        </button>
                                    ) : (
                                        <button className="btn-action start" title="Start Stream" onClick={() => handleAction(s.id, 'start')}>
                                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* SMALL SCHEDULE PREVIEW */}
                    <div className="mini-schedule-area">
                         <div className="section-title"><h3>📅 Upcoming Schedules</h3></div>
                         <div className="mini-sched-table-wrapper">
                             <table className="mini-table">
                                 <thead>
                                     <tr>
                                         <th>Title</th>
                                         <th>Start At</th>
                                         <th>Status</th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     {schedules.slice(0, 5).map(sch => (
                                         <tr key={sch.id}>
                                             <td><strong>{streams.find(st => st.id === sch.stream_id)?.title || sch.stream_id}</strong></td>
                                             <td>{new Date(sch.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                                             <td><span className={`status-tag ${sch.status.toLowerCase()}`}>{sch.status}</span></td>
                                         </tr>
                                     ))}
                                     {schedules.length === 0 && <tr><td colSpan={3} className="empty-td">Tidak ada jadwal tertunda.</td></tr>}
                                 </tbody>
                             </table>
                         </div>
                    </div>
                </section>

            </div>

            {/* NEW STREAM MODAL */}
            {showAddModal && (
                <div className="glass-modal-overlay">
                    <div className="glass-modal">
                        <div className="modal-header">
                            <h2>➕ Create New Stream</h2>
                            <button className="btn-close" onClick={() => setShowAddModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    Stream Title
                                    <button 
                                        className={`btn-ai-magic ${aiLoading ? 'loading' : ''}`}
                                        onClick={generateAIMetadata}
                                        disabled={aiLoading}
                                    >
                                        {aiLoading ? '🪄 Thinking...' : '🪄 AI Magic Wand'}
                                    </button>
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="Contoh: Live Streaming 24 Jam" 
                                    value={newStream.title}
                                    onChange={e => setNewStream({...newStream, title: e.target.value})}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Platform</label>
                                    <select 
                                        value={newStream.platform}
                                        onChange={e => {
                                            const p = e.target.value;
                                            let url = '';
                                            if (p === 'YOUTUBE') url = 'rtmp://a.rtmp.youtube.com/live2';
                                            else if (p === 'FACEBOOK') url = 'rtmps://live-api-s.facebook.com:443/rtmp/';
                                            else if (p === 'TIKTOK') url = 'rtmp://open-rtmp.tiktok.com/stage/';
                                            setNewStream({...newStream, platform: p, rtmp_url: url});
                                        }}
                                    >
                                        <option value="YOUTUBE">YouTube</option>
                                        <option value="FACEBOOK">Facebook Pro</option>
                                        <option value="TIKTOK">TikTok</option>
                                        <option value="CUSTOM">Custom RTMP</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Video Source</label>
                                    <select 
                                        value={newStream.playlist_path}
                                        onChange={e => setNewStream({...newStream, playlist_path: e.target.value})}
                                    >
                                        <option value="">-- Pilih Video --</option>
                                        {allVideos.map(v => (
                                            <option key={v.id} value={v.filepath}>{v.title}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Server RTMP URL</label>
                                <input 
                                    type="text" 
                                    placeholder="rtmp://..." 
                                    value={newStream.rtmp_url}
                                    onChange={e => setNewStream({...newStream, rtmp_url: e.target.value})}
                                />
                            </div>

                            <div className="form-group">
                                <label>Primary Stream Key</label>
                                <input 
                                    type="password" 
                                    placeholder="Pasi kunci siaran di sini..." 
                                    value={newStream.stream_key}
                                    onChange={e => setNewStream({...newStream, stream_key: e.target.value})}
                                />
                            </div>

                            <hr className="modal-divider" />

                            <div className="destinations-manager">
                                <div className="dest-header">
                                    <h3>🚀 Multi-Platform Simulcast</h3>
                                    <button className="btn-add-dest" onClick={addDestination}>+ Add Platform</button>
                                </div>
                                
                                {newStream.destinations.map((d, i) => (
                                    <div key={i} className="dest-item-row">
                                        <div className="dest-inputs">
                                            <input 
                                                type="text" 
                                                placeholder="Nama (Misal: TikTok Admin)" 
                                                value={d.name} 
                                                onChange={e => updateDest(i, 'name', e.target.value)} 
                                            />
                                            <input 
                                                type="text" 
                                                placeholder="RTMP URL" 
                                                value={d.rtmp_url} 
                                                onChange={e => updateDest(i, 'rtmp_url', e.target.value)} 
                                            />
                                            <input 
                                                type="password" 
                                                placeholder="Stream Key" 
                                                value={d.stream_key} 
                                                onChange={e => updateDest(i, 'stream_key', e.target.value)} 
                                            />
                                        </div>
                                        <button className="btn-remove-dest" onClick={() => removeDest(i)}>×</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setShowAddModal(false)}>Batal</button>
                            <button className="btn-submit" onClick={handleCreateStream} disabled={loading}>
                                {loading ? 'Saving...' : 'Create & Save Channel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
