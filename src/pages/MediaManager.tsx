import React, { useState, useCallback } from 'react';
import { apiFetch } from '../api';
import VideoCompressor from '../components/VideoCompressor';
import './MediaManager.css';

interface Video {
    id: string;
    title: string;
    filepath: string;
    thumbnail_path?: string;
}

const STEPS = [
    { num: 1, title: 'Upload', icon: '📤' },
    { num: 2, title: 'Playlist', icon: '💿' },
    { num: 3, title: 'Live Now', icon: '🚀' },
    { num: 4, title: 'Schedule', icon: '📅' }
];

export default function MediaManager() {
    const [currentStep, setCurrentStep] = useState(1);
    const [playlist, setPlaylist] = useState<Video[]>([]);
    const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'success'|'error'}[]>([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [autoCompress, setAutoCompress] = useState(true);
    const [compressingFile, setCompressingFile] = useState<File | null>(null);

    const log = (msg: string, type: 'info'|'success'|'error' = 'info') => {
        const time = new Date().toLocaleTimeString('id-ID');
        setLogs(prev => [{ time, msg, type }, ...prev.slice(0, 19)]);
    };

    // ── STEP 1: UPLOAD ──
    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        setCurrentStep(1);
        log(`Memulai upload ${files.length} file...`, 'info');

        if (autoCompress) {
            setCompressingFile(files[0]); // For now, compress one at a time for demo/UI simplicity
            return;
        }

        const formData = new FormData();
        Array.from(files).forEach(f => formData.append('videos', f));

        try {
            const data = await apiFetch('/api/media/videos/upload', {
                method: 'POST',
                body: formData
            });

            if (data.results) {
                const successful = data.results.filter((r: any) => r.success);
                log(`Berhasil mengunggah ${successful.length} video.`, 'success');
                
                // Load actual video objects
                const allVideos = await apiFetch('/api/media/videos');
                const uploadedIds = successful.map((s: any) => s.id);
                const newVideos = allVideos.filter((v: any) => uploadedIds.includes(v.id));
                
                setPlaylist(prev => [...prev, ...newVideos]);
                setCurrentStep(2);
            }
        } catch (err: any) {
            log(`Gagal mengunggah: ${err.message}`, 'error');
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

    const onCompressionComplete = async (compressedFile: File, stats: { original: number, compressed: number }) => {
        setCompressingFile(null);
        setUploading(true);
        log(`Kompresi selesai! Hemat ${( (stats.original - stats.compressed) / 1024 / 1024 ).toFixed(2)} MB. Memulai upload...`, 'success');

        const formData = new FormData();
        formData.append('videos', compressedFile);

        try {
            const data = await apiFetch('/api/media/videos/upload', {
                method: 'POST',
                body: formData
            });

            if (data.results) {
                const successful = data.results.filter((r: any) => r.success);
                log(`Hasil kompresi berhasil diunggah.`, 'success');
                
                const allVideos = await apiFetch('/api/media/videos');
                const uploadedIds = successful.map((s: any) => s.id);
                const newVideos = allVideos.filter((v: any) => uploadedIds.includes(v.id));
                
                setPlaylist(prev => [...prev, ...newVideos]);
                setCurrentStep(2);
            }
        } catch (err: any) {
             log(`Gagal mengunggah file hasil kompresi: ${err.message}`, 'error');
        } finally {
            setUploading(false);
        }
    };

    // ── STEP 2: PLAYLIST ──
    const createPlaylist = async () => {
        if (playlist.length === 0) return alert('Pilih video terlebih dahulu!');
        log('Menghasilkan playlist otomatis...', 'info');
        try {
            const res = await apiFetch('/api/media/playlists', {
                method: 'POST',
                body: JSON.stringify({
                    name: `Auto Pipeline - ${new Date().toLocaleDateString()}`,
                    clips: playlist
                })
            });
            log(`Playlist "${res.id}" berhasil dibuat.`, 'success');
            setCurrentStep(3);
        } catch (err: any) {
            log(`Gagal membuat playlist: ${err.message}`, 'error');
        }
    };

    // ── STEP 3: AUTO LIVE ──
    const launchInstantLive = async () => {
        if (playlist.length === 0) return;
        log('Mencari VPS terbaik untuk siaran...', 'info');
        
        try {
            // 1. Create Stream Object
            const stream = await apiFetch('/api/streams', {
                method: 'POST',
                body: JSON.stringify({
                    title: `🔴 LIVE: Pipeline-${Date.now().toString().slice(-4)}`,
                    playlist_path: playlist.map(p => p.filepath).join(','), // Simple concat for demo
                    status: 'SCHEDULED'
                })
            });

            // 2. Start it on best node
            await apiFetch(`/api/streams/${stream.id}/start`, { method: 'POST' });
            
            log(`🚀 SIARAN DIMULAI! Aktif di node terdistribusi.`, 'success');
            setCurrentStep(4);
        } catch (err: any) {
            log(`Gagal memulai siaran: ${err.message}`, 'error');
        }
    };

    // ── STEP 4: AUTO SCHEDULE ──
    const setupAutoSchedules = async () => {
        log('Menyiapkan jadwal siaran ulang otomatis...', 'info');
        const now = new Date();
        const start = new Date(now.getTime() + 60 * 60000); // +1 jam
        const end = new Date(start.getTime() + 120 * 60000); // 2 jam

        try {
            await apiFetch('/api/schedules', {
                method: 'POST',
                body: JSON.stringify({
                    name: `Rerun: ${playlist[0]?.title || 'Auto Pipeline'}`,
                    start: start.toISOString(),
                    end: end.toISOString(),
                    status: 'SCHEDULED',
                    playlist_path: playlist.map(p => p.filepath).join(',')
                })
            });
            log('📅 Jadwal reruns berhasil dikonfigurasi.', 'success');
        } catch (err: any) {
            log(`Gagal menjadwalkan: ${err.message}`, 'error');
        }
    };

    return (
        <div className="pipeline-container">
            <div className="pipeline-header">
                <h1>🤖 Auto-Pipeline System</h1>
                <p>Otomatisasi alur produksi: Upload ➔ Playlist ➔ Live ➔ Schedule.</p>
            </div>

            {/* PROGRESS STEPPER */}
            <div className="stepper-box">
                {STEPS.map(s => (
                    <div key={s.num} className={`step-item ${currentStep === s.num ? 'active' : ''} ${currentStep > s.num ? 'done' : ''}`}>
                        <div className="step-circ">{currentStep > s.num ? '✓' : s.num}</div>
                        <div className="step-info">
                            <span className="step-icon">{s.icon}</span>
                            <span className="step-title">{s.title}</span>
                        </div>
                        {s.num < 4 && <div className="step-line" />}
                    </div>
                ))}
            </div>

            <div className="pipeline-workspace">
                {/* LEFT COLUMN: ACTIONS */}
                <div className="workspace-actions">
                    
                    {/* STEP 1 AREA */}
                    <div className={`action-card ${currentStep === 1 ? 'focus' : ''}`}>
                        <h3>1. Media Ingestion</h3>
                        <div className={`upload-zone ${uploading ? 'uploading' : ''}`}>
                            <input type="file" multiple onChange={(e) => handleFiles(e.target.files)} id="file-up" />
                            <label htmlFor="file-up">
                                <div className="up-icon">☁️</div>
                                <span>{uploading ? 'Sedang Mengunggah...' : 'Klik atau Seret file Video ke sini'}</span>
                                <small>Maksimal 10 file sekaligus</small>
                            </label>
                            {uploading && <div className="upload-loader-bar" />}
                            
                            <div className="compress-toggle">
                                <label className="fancy-toggle">
                                    <input type="checkbox" checked={autoCompress} onChange={() => setAutoCompress(!autoCompress)} />
                                    <span className="slider" />
                                </label>
                                <span>Auto-Compress (Local)</span>
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

                    {/* STEP 2 AREA */}
                    <div className={`action-card ${currentStep === 2 ? 'focus' : (currentStep < 2 ? 'locked' : '')}`}>
                        <h3>2. Playlist Generator</h3>
                        <p>Total media di antrean: <strong>{playlist.length} video</strong></p>
                        <button className="btn-pipeline" onClick={createPlaylist} disabled={playlist.length === 0}>
                            💾 Generate Master Playlist
                        </button>
                    </div>

                    {/* STEP 3 AREA */}
                    <div className={`action-card ${currentStep === 3 ? 'focus' : (currentStep < 3 ? 'locked' : '')}`}>
                        <h3>3. Distribution (Go Live)</h3>
                        <p>Kirim konten ke infrastruktur VPS distribusi.</p>
                        <button className="btn-pipeline pulse" onClick={launchInstantLive} disabled={currentStep < 3}>
                            🚀 Launch Instant Live
                        </button>
                    </div>

                    {/* STEP 4 AREA */}
                    <div className={`action-card ${currentStep === 4 ? 'focus' : (currentStep < 4 ? 'locked' : '')}`}>
                        <h3>4. Automation (Set Reruns)</h3>
                        <p>Jadwalkan pemutaran ulang otomatis.</p>
                        <button className="btn-pipeline secondary" onClick={setupAutoSchedules} disabled={currentStep < 4}>
                            📅 Config Weekly Reruns
                        </button>
                    </div>

                    <button className="btn-reset" onClick={() => { setPlaylist([]); setCurrentStep(1); setLogs([]); }}>
                        Reset Pipeline
                    </button>
                </div>

                {/* RIGHT COLUMN: PREVIEW & LOGS */}
                <div className="workspace-monitor">
                    <div className="monitor-card preview">
                        <h3>📋 Queue Preview</h3>
                        <div className="queue-list">
                            {playlist.length === 0 ? <p className="empty-msg">Belum ada video di antrean.</p> : 
                            playlist.map((p, i) => (
                                <div key={i} className="queue-item">
                                    <span className="q-num">{i+1}</span>
                                    <span className="q-title">{p.title}</span>
                                    <button className="q-del" onClick={() => setPlaylist(prev => prev.filter((_, idx)=>idx!==i))}>×</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="monitor-card logs">
                        <h3>📡 Execution Logs</h3>
                        <div className="pipeline-logs">
                            {logs.length === 0 ? <p className="empty-msg">Sistem siap menerima instruksi.</p> : 
                            logs.map((l, i) => (
                                <div key={i} className={`log-entry ${l.type}`}>
                                    <span className="l-time">[{l.time}]</span>
                                    <span className="l-msg">{l.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
