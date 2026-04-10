import React, { useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { apiFetch, BASE_URL } from '../api';
import toast, { Toaster } from 'react-hot-toast';
import './StreamManagement.css';
import { StreamList } from '../components/stream-management/StreamList';
import { AddStreamModal } from '../components/stream-management/AddStreamModal';
import { LogViewer } from '../components/stream-management/LogViewer';
import { Node, Stream, LogEntry, Schedule } from '../types';

interface StreamManagementProps {
    onChatOpen?: (id: string) => void;
}

export default function StreamManagement({ onChatOpen }: StreamManagementProps) {
    const [streams, setStreams] = useState<Stream[]>([]);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [allVideos, setAllVideos] = useState<any[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);
    const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
    
    const [newStream, setNewStream] = useState({
        id: '',
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

    const loadAll = useCallback(async () => {
        try {
            setLoading(true);
            setErrorMsg(null);
            const [s, n, v, sch] = await Promise.all([
                apiFetch('/api/streams', { skipCache: true }),
                apiFetch('/api/nodes', { skipCache: true }),
                apiFetch('/api/media/videos', { cacheTTL: 600000 }),
                apiFetch('/api/schedules', { skipCache: true })
            ]);
            setStreams(s);
            setNodes(n);
            setAllVideos(v || []);
            setSchedules(sch || []);
        } catch (err: any) {
            setErrorMsg('Gagal memuat data: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    useEffect(() => {
        const socket = io(BASE_URL || window.location.origin, {
            reconnectionAttempts: 10,
            reconnectionDelay: 2000
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            loadAll();
        });

        socket.on('disconnect', (reason) => {
            if (reason === 'io server disconnect') socket.connect();
        });

        socket.on('stream_status_change', (data: { id: string, status: string }) => {
            setStreams(prev => prev.map(s => {
                if (s.id === data.id) {
                    const mappedStatus = (data.status === 'MULAI' || data.status === 'LIVE' || data.status === 'RUNNING') ? 'RUNNING' : 'OFFLINE';
                    return { ...s, status: mappedStatus };
                }
                return s;
            }));
        });

        return () => {
            socket.disconnect();
        };
    }, [loadAll]);

    const handleAction = async (id: string, action: 'start' | 'stop') => {
        const stream = streams.find(s => s.id === id);
        const node = nodes.find(n => n.id === stream?.node) || nodes[0];
        const url = node ? `${node.url}/api/system/streams/${id}/${action}` : `/api/system/streams/${id}/${action}`;
        
        try {
            setLoading(true);
            await apiFetch(url, { method: 'POST' });
            loadAll();
        } catch (err: any) {
            toast.error(`Error ${action}: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSelect = (id: string) => {
        setSelectedStreams(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSelectAll = (checked: boolean) => {
        setSelectedStreams(checked ? streams.map(s => s.id) : []);
    };

    const handleBulkAction = async (action: 'start' | 'stop' | 'delete' | 'queue') => {
        if (selectedStreams.length === 0) return;
        if (!confirm(`Yakin ingin melakukan action ${action.toUpperCase()} pada ${selectedStreams.length} stream?`)) return;
        
        try {
            setLoading(true);
            await apiFetch('/api/streams/bulk-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ids: selectedStreams })
            });
            if (action === 'delete') {
                setSelectedStreams([]);
            }
            loadAll();
        } catch (err: any) {
            toast.error('Bulk Action Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };


    const handleGenerateAI = async () => {
        if (!newStream.title) return toast.error('Inputkan Judul!');
        try {
            setAiLoading(true);
            const data = await apiFetch('/api/ai/generate-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: newStream.title,
                    tone: newStream.ai_tone
                })
            });
            setNewStream(prev => ({ 
                ...prev, 
                description: data.description || prev.description,
                tags: data.tags || prev.tags 
            }));
        } catch (err: any) {
            toast.error('AI Gagal: ' + err.message);
        } finally {
            setAiLoading(false);
        }
    };

    const handleCreateStream = async () => {
        try {
            setLoading(true);
            const isEdit = streams.some(s => s.id === newStream.id);
            const method = isEdit ? 'PUT' : 'POST';
            const url = isEdit ? `/api/streams/${newStream.id}` : '/api/streams';
            
            await apiFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newStream)
            });
            setShowAddModal(false);
            loadAll();
        } catch (err: any) {
            toast.error('Gagal simpan stream: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (s: Stream) => {
        setNewStream({
            id: s.id,
            title: s.title || '',
            platform: s.platform || 'YOUTUBE',
            rtmp_url: s.rtmp_url || 'rtmp://a.rtmp.youtube.com/live2',
            stream_key: s.stream_key || '',
            playlist_path: s.playlist_path || '',
            description: s.description || '',
            tags: s.tags || '',
            auto_restart: s.auto_restart ?? true,
            ai_tone: s.ai_tone || 'viral',
            destinations: s.destinations || []
        });
        setShowAddModal(true);
    };

    const manageDestination = {
        add: () => setNewStream(prev => ({ 
            ...prev, 
            destinations: [...prev.destinations, { platform: 'CUSTOM', rtmp_url: '', stream_key: '', active: true }] 
        })),
        update: (index: number, field: string, val: any) => setNewStream(prev => {
            const copy = [...prev.destinations];
            copy[index] = { ...copy[index], [field]: val };
            return { ...prev, destinations: copy };
        }),
        remove: (index: number) => setNewStream(prev => ({
            ...prev, 
            destinations: prev.destinations.filter((_, i) => i !== index)
        }))
    };

    return (
        <div className="stream-management-page animate-fade-in">
            <Toaster position="top-right" />
            <div className="mgmt-header">
                <div className="header-info">
                    <h1>📡 Stream Management</h1>
                    <p className="subtitle">Operational Command Console v4.0.1</p>
                </div>
                

                <div className="header-actions">
                    <button className="btn-add-stream" onClick={() => {
                        setNewStream({ id: '', title: '', platform: 'YOUTUBE', rtmp_url: 'rtmp://a.rtmp.youtube.com/live2', stream_key: '', playlist_path: '', description: '', tags: '', auto_restart: true, ai_tone: 'viral', destinations: [] });
                        setShowAddModal(true);
                    }}>
                         ➕ New Stream
                    </button>
                    <button className="btn-log-toggle" onClick={() => setIsLogDrawerOpen(true)}>
                         Logs
                    </button>
                    <button className="btn-refresh-circle" onClick={loadAll} disabled={loading}>
                        Sync
                    </button>
                </div>
            </div>

            <div className="mgmt-workspace">
                <div className="bulk-action-bar" style={{ display: 'flex', gap: '8px', padding: '10px 15px', background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid var(--glass-border)', alignItems: 'center' }}>
                    <button className="sys-btn gray-btn" onClick={() => handleSelectAll(true)}>Centang All</button>
                    <button className="sys-btn gray-btn" onClick={() => handleSelectAll(false)}>Uncheck All</button>
                    <button className="sys-btn success-btn" onClick={() => handleBulkAction('start')}>Start Yang Dipilih</button>
                    <button className="sys-btn warning-btn" onClick={() => handleBulkAction('stop')}>Stop Yang Dipilih</button>
                    <button className="sys-btn brand-btn" onClick={() => handleBulkAction('queue')}>Pindahkan ke Antrean</button>
                    <button className="sys-btn danger-btn" onClick={() => handleBulkAction('delete')}>Hapus Yang Dipilih</button>
                    <span style={{marginLeft: 'auto', fontWeight: 'bold'}} className="selected-count">Dipilih: {selectedStreams.length}</span>
                </div>
                
                <main className="streams-view table-mode">
                    {errorMsg && <div className="error-banner">{errorMsg}</div>}
                    <StreamList 
                        streams={streams} 
                        nodes={nodes}
                        onAction={handleAction}
                        onEdit={handleEdit}
                        onDelete={async (id) => { if(confirm('Hapus Channel ini?')) { await apiFetch(`/api/streams/${id}`, { method: 'DELETE' }); loadAll(); } } } 
                        selectedStreams={selectedStreams}
                        onToggleSelect={handleToggleSelect}
                        onSelectAll={handleSelectAll}
                        onChatOpen={onChatOpen}
                    />
                </main>
            </div>

            <AddStreamModal 
                show={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSubmit={handleCreateStream}
                newStream={newStream}
                setNewStream={setNewStream}
                allVideos={allVideos}
                loading={loading}
                aiLoading={aiLoading}
                onGenerateAI={handleGenerateAI}
                onAddDest={manageDestination.add}
                onUpdateDest={manageDestination.update}
                onRemoveDest={manageDestination.remove}
            />

            <div className={`log-drawer-overlay ${isLogDrawerOpen ? 'open' : ''}`} onClick={() => setIsLogDrawerOpen(false)}>
                <div className="log-drawer-content" onClick={e => e.stopPropagation()}>
                    {/* STICKY HEADER — selalu terlihat */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 20px',
                        background: '#060b14',
                        borderBottom: '1px solid #1e293b',
                        flexShrink: 0,
                        position: 'sticky',
                        top: 0,
                        zIndex: 10
                    }}>
                        <span style={{ color: '#818cf8', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📡 Live Logs
                            <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px' }}>
                                {logs.length}
                            </span>
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setLogs([])}
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                            >🗑 Clear</button>
                            <button
                                onClick={() => setIsLogDrawerOpen(false)}
                                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', width: '34px', height: '34px', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Tutup"
                            >✕</button>
                        </div>
                    </div>
                    <LogViewer logs={logs} onClear={() => setLogs([])} onClose={() => setIsLogDrawerOpen(false)} />
                </div>
            </div>
        </div>
    );
}
