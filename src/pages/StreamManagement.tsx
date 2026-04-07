import React, { useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { type Socket } from 'socket.io-client';

import { apiFetch, BASE_URL } from '../api';
import './StreamManagement.css';
import { NodeGrid } from '../components/stream-management/NodeGrid';
import { StreamList } from '../components/stream-management/StreamList';
import { AddStreamModal } from '../components/stream-management/AddStreamModal';
import { LogViewer } from '../components/stream-management/LogViewer';
import { Node, Stream, LogEntry, Schedule } from '../types';

export default function StreamManagement() {
    const [streams, setStreams] = useState<Stream[]>([]);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [allVideos, setAllVideos] = useState<any[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [newStream, setNewStream] = useState({
        id: '', // Added for editing
        title: '',
        platform: 'YOUTUBE',
        rtmp_url: 'rtmp://a.rtmp.youtube.com/live2',
        stream_key: '',
        playlist_path: '',
        description: '',
        tags: '',
        auto_restart: true,
        ai_tone: 'viral',
        destinations: [] as any[]
    });

    const socketRef = useRef<any>(null);

    // ── DATA FETCHING ──
    const loadAll = async () => {
        try {
            setLoading(true);
            setErrorMsg(null);
            const [s, n, v] = await Promise.all([
                apiFetch('/api/streams', { skipCache: true }),
                apiFetch('/api/nodes', { skipCache: true }),
                apiFetch('/api/media/videos', { cacheTTL: 600000 })
            ]);
            setStreams(s);
            setNodes(n);
            setAllVideos(v);
        } catch (err: any) {
            setErrorMsg('Gagal memuat data: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
        
        // Setup Socket.io connection
        const socket = io(BASE_URL || window.location.origin);
        socketRef.current = socket;

        socket.on('connect', () => addLog('Connected to Real-time Engine', 'success'));
        socket.on('disconnect', () => addLog('Disconnected from Real-time Engine', 'warn'));

        socket.on('stream_status_change', (data: { id: string, status: string }) => {
            setStreams(prev => prev.map(s => s.id === data.id ? { ...s, status: data.status === 'MULAI' || data.status === 'LIVE' ? 'RUNNING' : 'OFFLINE' } : s));
            addLog(`Stream ${data.id} status changed to ${data.status}`, 'info');
        });

        socket.on('DASHBOARD_UPDATE', (payload: any) => {
            if (payload.streams) {
                setStreams(prev => prev.map(s => {
                    const metric = payload.streams.find((m: any) => m.id === s.id);
                    if (metric) {
                        return { ...s, bitrate: metric.bitrate + ' kbps', viewer_count: metric.viewers || s.viewer_count };
                    }
                    return s;
                }));
            }
            if (payload.metrics) {
                setNodes(prev => prev.map(n => n.id === 'node-1' ? { ...n, load: payload.metrics.cpu } : n));
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [loadAll]);

    // ── LOGIC ──
    const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
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
        
        const url = targetNode ? `${targetNode.url}/api/streams/${id}/${action}` : `/api/streams/${id}/${action}`;
        
        try {
            setLoading(true);
            addLog(`${action.toUpperCase()} request sent for ${id} to ${targetNode?.name || 'Local'}`, 'info');
            await apiFetch(url, { method: 'POST' });
            loadAll();
        } catch (err: any) {
            addLog(`Error ${action}: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleMasterStop = async () => {
        if (!window.confirm('🚨 PERINGATAN KRITIKAL: Anda akan mematikan SELURUH stream di SEMUA node. Lanjutkan?')) return;
        try {
            setLoading(true);
            await apiFetch('/api/streams/emergency-stop', { method: 'POST' });
            addLog('MASTER STOP: Seluruh stream telah dihentikan!', 'error');
            loadAll();
        } catch (err: any) {
            alert('Gagal Master Stop: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteStream = async (id: string) => {
        if (!window.confirm('Hapus channel ini permanen? Tindakan ini tidak bisa dibatalkan.')) return;
        try {
            setLoading(true);
            await apiFetch(`/api/streams/${id}`, { method: 'DELETE' });
            addLog(`Stream berhasil dihapus`, 'success');
            loadAll();
        } catch (err: any) {
            alert('Gagal menghapus stream: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditStream = async (stream: Stream) => {
        try {
            setLoading(true);
            // Fetch latest destinations for this stream
            const destinations = await apiFetch(`/api/streams/${stream.id}/destinations`);
            
            setNewStream({
                id: stream.id,
                title: stream.title,
                platform: (stream as any).platform || 'YOUTUBE',
                rtmp_url: (stream as any).rtmp_url || '',
                stream_key: (stream as any).stream_key || '',
                playlist_path: (stream as any).playlist_path || '',
                description: (stream as any).description || '',
                tags: (stream as any).tags || '',
                auto_restart: (stream as any).auto_restart !== 0,
                ai_tone: (stream as any).ai_tone || 'viral',
                destinations: destinations || []
            });
            setShowAddModal(true);
        } catch (err: any) {
            alert('Gagal memuat data edit: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const resetNewStream = () => {
        setNewStream({ id: '', title: '', platform: 'YOUTUBE', rtmp_url: 'rtmp://a.rtmp.youtube.com/live2', stream_key: '', playlist_path: '', description: '', tags: '', auto_restart: true, ai_tone: 'viral', destinations: [] });
    };

    const handleToggleRestart = async (id: string, enabled: boolean) => {
        try {
            await apiFetch(`/api/streams/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ auto_restart: enabled })
            });
            setStreams(prev => prev.map(s => s.id === id ? { ...s, auto_restart: enabled ? 1 : 0 } as any : s));
            addLog(`Watchdog ${enabled ? 'ON' : 'OFF'} for ${id}`, enabled ? 'success' : 'warn');
        } catch (err: any) {
            alert('Gagal update restart setting: ' + err.message);
        }
    };

    const handleCreateStream = async () => {
        if (!newStream.title || !newStream.playlist_path) return alert('Judul dan Media wajib diisi!');
        
        try {
            setLoading(true);
            const method = newStream.id ? 'PUT' : 'POST';
            const url = newStream.id ? `/api/streams/${newStream.id}` : '/api/streams';
            
            const res = await apiFetch(url, {
                method,
                body: JSON.stringify(newStream)
            });

            const streamId = newStream.id || res.id;

            // Simple destination update (could be optimized on backend)
            if (newStream.destinations.length > 0) {
                 // For simplicity in this demo, we'll just add new ones
                 // In production, we should handle sync properly
                for (const dest of newStream.destinations) {
                    if (!dest.id) { // Only add new ones
                         await apiFetch(`/api/streams/${streamId}/destinations`, {
                            method: 'POST',
                            body: JSON.stringify(dest)
                        });
                    }
                }
            }

            setShowAddModal(false);
            resetNewStream();
            loadAll();
            addLog(`Stream "${newStream.title}" berhasil disimpan`, 'success');
        } catch (err: any) {
            alert('Gagal menyimpan stream: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const generateAIMetadata = async (tone: string = 'viral') => {
        if (!newStream.title) return alert('Masukkan judul dasar terlebih dahulu!');
        try {
            setAiLoading(true);
            const res = await apiFetch('/api/automation/ai-metadata', {
                method: 'POST',
                body: JSON.stringify({ title: newStream.title, tone })
            });
            setNewStream({ 
                ...newStream, 
                title: res.title,
                description: res.description,
                tags: res.tags,
                ai_tone: tone
            });
            addLog('AI Magic Wand: Konten berhasil dioptimasi!', 'success');
        } catch (e: any) {
            alert('AI Error: ' + e.message);
        } finally {
            setAiLoading(false);
        }
    };

    // ── UI HELPERS ──
    return (
        <div className="stream-mgmt-container">
            {/* Inline Error Banner */}
            {errorMsg && (
                <div style={{
                    background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
                    borderRadius: '12px', padding: '12px 20px', marginBottom: '20px',
                    color: '#f43f5e', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <span>⚠️ {errorMsg}</span>
                    <button onClick={() => { setErrorMsg(null); loadAll(); }} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontWeight: 700 }}>↺ Retry</button>
                </div>
            )}
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
                    <button className="btn-panic" onClick={handleMasterStop}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                        Panic Stop
                    </button>
                    <button className="btn-refresh" onClick={loadAll} disabled={loading}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                        Sync Data
                    </button>
                </div>
            </div>

            <div className="mgmt-main-grid">
                <section className="vps-section-wrapper">
                    <NodeGrid nodes={nodes} />
                    <LogViewer logs={logs} onClear={() => setLogs([])} />
                </section>

                <section className="streams-section-wrapper">
                    <StreamList 
                        streams={streams} 
                        nodes={nodes} 
                        onAction={handleAction} 
                        onDelete={handleDeleteStream}
                        onEdit={handleEditStream} 
                        onToggleRestart={handleToggleRestart}
                    />
                    
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

            <AddStreamModal 
                show={showAddModal}
                onClose={() => { setShowAddModal(false); resetNewStream(); }}
                onSubmit={handleCreateStream}
                newStream={newStream}
                setNewStream={setNewStream}
                allVideos={allVideos}
                aiLoading={aiLoading}
                onGenerateAI={generateAIMetadata}
                onAddDest={() => setNewStream({ ...newStream, destinations: [...newStream.destinations, { name: 'New Platform', platform: 'OTHER', rtmp_url: '', stream_key: '' }]})}
                onUpdateDest={(idx, field, val) => {
                    const next = [...newStream.destinations];
                    next[idx] = { ...next[idx], [field]: val };
                    setNewStream({ ...newStream, destinations: next });
                }}
                onRemoveDest={(idx) => setNewStream({ ...newStream, destinations: newStream.destinations.filter((_, i) => i !== idx) })}
                loading={loading}
            />
        </div>
    );
}
