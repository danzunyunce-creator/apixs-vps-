import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import { apiFetch, BASE_URL } from '../api';
import './MediaManager.css';

interface Video {
    id: string;
    title: string;
    filepath: string;
    thumbnail_path?: string;
    duration?: number;
    file_size?: number;
    upload_date?: string;
    description?: string;
    tags?: string;
}

export default function MediaManager() {
    const [videos, setVideos] = useState<Video[]>([]);
    const [uploading, setUploading] = useState(false);
    const [search, setSearch] = useState('');
    const [bulkPath, setBulkPath] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);
    const [processingIds, setProcessingIds] = useState<Map<string, number>>(new Map()); // id -> percentage

    const loadVideos = useCallback(async () => {
        try {
            const data = await apiFetch('/api/media/videos');
            setVideos(data || []);
        } catch (err) {
            console.error('Failed to load videos:', err);
        }
    }, []);

    useEffect(() => {
        loadVideos();

        // Socket setup for real-time progress
        const socket = io(BASE_URL || window.location.origin);

        socket.on('compressionStarted', ({ videoId }) => {
            setProcessingIds(prev => new Map(prev).set(videoId, 0));
        });

        socket.on('compressionProgress', ({ videoId, percent }) => {
            setProcessingIds(prev => new Map(prev).set(videoId, percent));
        });

        socket.on('compressionFinished', ({ videoId }) => {
            setProcessingIds(prev => {
                const next = new Map(prev);
                next.delete(videoId);
                return next;
            });
            loadVideos(); // Refresh to show "Optimized" tag
        });

        socket.on('compressionError', ({ videoId, message }) => {
            alert(`Optimization Error (${videoId}): ${message}`);
            setProcessingIds(prev => {
                const next = new Map(prev);
                next.delete(videoId);
                return next;
            });
        });

        return () => {
            socket.disconnect();
        };
    }, [loadVideos]);

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        const formData = new FormData();
        Array.from(files).forEach(f => formData.append('videos', f));

        try {
            await apiFetch('/api/media/videos/upload', {
                method: 'POST',
                body: formData
            });
            await loadVideos();
        } catch (err: any) {
            alert(`Gagal mengunggah: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleOptimize = async (id: string) => {
        try {
            setProcessingIds(prev => new Map(prev).set(id, 0));
            await apiFetch(`/api/media/videos/${id}/process`, {
                method: 'POST',
                body: JSON.stringify({ targetRes: 720 })
            });
        } catch (err: any) {
            alert('Gagal memulai optimasi: ' + err.message);
            setProcessingIds(prev => {
                const next = new Map(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus video ini secara permanen?')) return;
        try {
            await apiFetch(`/api/media/videos/${id}`, { method: 'DELETE' });
            setVideos(prev => prev.filter(v => v.id !== id));
        } catch (err: any) {
            alert(`Gagal menghapus: ${err.message}`);
        }
    };

    const handleBulkIngest = async () => {
        if (!bulkPath) return alert('Masukkan path folder server!');
        try {
            setBulkLoading(true);
            const res = await apiFetch('/api/automation/bulk-ingest', {
                method: 'POST',
                body: JSON.stringify({ folderPath: bulkPath })
            });
            alert(`✅ Sukses! ${res.count} video berhasil di-ingest dengan AI Metadata.`);
            setBulkPath('');
            loadVideos();
        } catch (err: any) {
            alert('Bulk Error: ' + err.message);
        } finally {
            setBulkLoading(false);
        }
    };

    const formatSize = (bytes: number = 0) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const filteredVideos = videos.filter(v => 
        v.title.toLowerCase().includes(search.toLowerCase()) || 
        v.id.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="pipeline-container">
            <div className="pipeline-header" style={{ marginBottom: 20 }}>
                <h1>🎬 Master Video Library</h1>
                <p>Unggah dan kelola aset Master Video Anda sebelum masuk ke Jadwal Tayang.</p>
            </div>

            <div className="pipeline-workspace" style={{ gridTemplateColumns: 'minmax(300px, 350px) 1fr' }}>
                {/* LEFT COLUMN: UPLOADER */}
                <div className="workspace-actions">
                    <div className="action-card focus">
                        <h3>📤 Upload Master Video</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 20 }}>Video yang diunggah akan otomatis dimunculkan pada dropdown di menu Scheduler.</p>
                        
                        <div className={`upload-zone ${uploading ? 'uploading' : ''}`}>
                            <input type="file" onChange={(e) => handleFiles(e.target.files)} id="file-up" accept="video/mp4,video/mkv,video/avi" />
                            <label htmlFor="file-up">
                                <div className="up-icon">☁️</div>
                                <span>{uploading ? 'Sedang Mengunggah & Memproses...' : 'Klik atau Seret file Video ke sini'}</span>
                            </label>
                            {uploading && <div className="upload-loader-bar" />}
                        </div>
                    </div>

                    <div className="action-card" style={{ marginTop: 20 }}>
                        <h3>🪄 Bulk AI Processor</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 15 }}>Impor folder masif dari server & otomatiskan metadata dengan GPT-4o.</p>
                        <div className="bulk-form">
                            <input 
                                type="text" 
                                placeholder="Server Path (ex: D:/Videos/Viral)" 
                                value={bulkPath}
                                onChange={e => setBulkPath(e.target.value)}
                                className="bulk-input"
                            />
                            <button 
                                className={`btn-bulk ${bulkLoading ? 'loading' : ''}`}
                                onClick={handleBulkIngest}
                                disabled={bulkLoading}
                            >
                                {bulkLoading ? 'Processing...' : 'Start Bulk AI Ingest'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: VIDEO GALLERY */}
                <div className="workspace-monitor">
                    <div className="monitor-card preview" style={{ height: 'calc(100vh - 200px)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3>📚 Koleksi Video Tersedia ({filteredVideos.length})</h3>
                            <div className="search-box" style={{ position: 'relative' }}>
                                <input 
                                    type="text" 
                                    placeholder="Search videos..." 
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ 
                                        padding: '8px 12px', 
                                        background: 'rgba(255,255,255,0.05)', 
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontSize: '0.85rem',
                                        width: '200px'
                                    }}
                                />
                            </div>
                        </div>
                        <div className="queue-list" style={{ maxHeight: 'calc(100% - 60px)' }}>
                            {filteredVideos.length === 0 ? (
                                <p className="empty-msg">{search ? `No results for "${search}"` : 'Belum ada video master. Silakan upload terlebih dahulu.'}</p>
                            ) : (
                                filteredVideos.map((v) => (
                                    <div key={v.id} className="queue-item" style={{ alignItems: 'center' }}>
                                        <div className="q-num" style={{ background: v.filepath.includes('_proc_') ? '#10b981' : '#3b82f6', color: 'white' }}>
                                            {v.filepath.includes('_proc_') ? '✨' : '📼'}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div className="q-title" style={{ fontWeight: 600, fontSize: '1rem', color: '#f8fafc' }}>{v.title}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                                {formatSize(v.file_size)} • {v.filepath.includes('_proc_') ? 'Optimized' : 'Raw'}
                                            </div>
                                        </div>
                                        <div className="item-actions" style={{ display: 'flex', gap: '8px' }}>
                                            {!v.filepath.includes('_proc_') && (
                                                <button 
                                                    className={`btn-optimize ${processingIds.has(v.id) ? 'loading' : ''}`}
                                                    onClick={() => handleOptimize(v.id)}
                                                    disabled={processingIds.has(v.id)}
                                                    title="Optimize for Live"
                                                    style={{ 
                                                        background: processingIds.has(v.id) ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                                                        color: processingIds.has(v.id) ? '#3b82f6' : '#10b981', 
                                                        border: '1px solid rgba(16, 185, 129, 0.2)', 
                                                        padding: '4px 12px', 
                                                        borderRadius: '8px', 
                                                        cursor: 'pointer',
                                                        minWidth: '100px'
                                                    }}
                                                >
                                                    {processingIds.has(v.id) ? `⌛ ${processingIds.get(v.id)}%` : '🪄 Optimize'}
                                                </button>
                                            )}
                                            <button className="q-del" onClick={() => handleDelete(v.id)} title="Hapus Permanen">×</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
