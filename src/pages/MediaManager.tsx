import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';
import VideoCompressor from '../components/VideoCompressor';
import './MediaManager.css';

interface Video {
    id: string;
    title: string;
    filepath: string;
    thumbnail_path?: string;
    duration?: number;
    file_size?: number;
    upload_date?: string;
}

export default function MediaManager() {
    const [videos, setVideos] = useState<Video[]>([]);
    const [uploading, setUploading] = useState(false);
    const [autoCompress, setAutoCompress] = useState(true);
    const [compressingFile, setCompressingFile] = useState<File | null>(null);

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
    }, [loadVideos]);

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        
        if (autoCompress) {
            setCompressingFile(files[0]); // For now, compress one at a time
            return;
        }

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

    const onCompressionComplete = async (compressedFile: File) => {
        setCompressingFile(null);
        setUploading(true);

        const formData = new FormData();
        formData.append('videos', compressedFile);

        try {
            await apiFetch('/api/media/videos/upload', {
                method: 'POST',
                body: formData
            });
            await loadVideos();
        } catch (err: any) {
            alert(`Gagal mengunggah file hasil kompresi: ${err.message}`);
        } finally {
            setUploading(false);
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

    const formatSize = (bytes: number = 0) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

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
                            
                            <div className="compress-toggle">
                                <label className="fancy-toggle">
                                    <input type="checkbox" checked={autoCompress} onChange={() => setAutoCompress(!autoCompress)} />
                                    <span className="slider" />
                                </label>
                                <span>Auto-Compress (Lokal)</span>
                            </div>
                        </div>
                    </div>

                    {compressingFile && (
                        <VideoCompressor 
                            file={compressingFile} 
                            onComplete={onCompressionComplete} 
                            onCancel={() => setCompressingFile(null)} 
                        />
                    )}
                </div>

                {/* RIGHT COLUMN: VIDEO GALLERY */}
                <div className="workspace-monitor">
                    <div className="monitor-card preview" style={{ height: 'calc(100vh - 200px)' }}>
                        <h3>📚 Koleksi Video Tersedia ({videos.length})</h3>
                        <div className="queue-list" style={{ maxHeight: 'calc(100% - 40px)' }}>
                            {videos.length === 0 ? (
                                <p className="empty-msg">Belum ada video master. Silakan upload terlebih dahulu.</p>
                            ) : (
                                videos.map((v) => (
                                    <div key={v.id} className="queue-item" style={{ alignItems: 'flex-start' }}>
                                        {/* THUMBNAIL PLACEHOLDER (or real thumb via APi static route if available) */}
                                        <div className="q-num" style={{ background: '#3b82f6', color: 'white' }}>📼</div>
                                        <div style={{ flex: 1 }}>
                                            <div className="q-title" style={{ fontWeight: 600, fontSize: '1rem', color: '#f8fafc' }}>{v.title}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                                Size: {formatSize(v.file_size)} • Type: MP4
                                            </div>
                                        </div>
                                        <button className="q-del" onClick={() => handleDelete(v.id)} title="Hapus Permanen">×</button>
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
