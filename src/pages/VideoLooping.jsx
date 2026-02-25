import { useState, useEffect, useRef, useCallback } from 'react';
import './VideoLooping.css';

/* ─── Helpers ──────────────────────────────────────────────────────────── */
const fmtTime = (s) => {
    s = Math.floor(Math.max(0, s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
    return [m, sec].map((n) => String(n).padStart(2, '0')).join(':');
};

const fmtFileSize = (bytes) => {
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB';
    return (bytes / 1e3).toFixed(0) + ' KB';
};

const INITIAL_CLIPS = [
    { id: 1, name: 'Intro_Branding_v2.mp4', duration: 15, durationStr: '00:15', size: '125 MB', res: '1080p' },
    { id: 2, name: 'Main_Content_Loop_A.mp4', duration: 2700, durationStr: '45:00', size: '1.2 GB', res: '1080p' },
    { id: 3, name: 'Commercial_Break_01.mp4', duration: 300, durationStr: '05:00', size: '430 MB', res: '1080p' },
    { id: 4, name: 'Outro_Thanks.mp4', duration: 30, durationStr: '00:30', size: '80 MB', res: '1080p' },
    { id: 5, name: 'Waiting_Screen_Anim.mov', duration: 3600, durationStr: '01:00:00', size: '2.5 GB', res: '4K' },
    { id: 6, name: 'Live_Replay_Highlights.mp4', duration: 750, durationStr: '12:30', size: '850 MB', res: '1080p' },
];

const RESOLUTIONS = ['360p', '480p', '720p', '1080p', '1440p', '4K'];
const VIDEO_CODECS = ['H.264 (AVC)', 'H.265 (HEVC)', 'VP9', 'AV1'];
const AUDIO_CODECS = ['AAC', 'MP3', 'Opus'];
const VIDEO_EXTS = ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'flv'];

const VideoIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="20" height="20" rx="2"></rect>
        <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"></polygon>
    </svg>
);

/* ═══════════════════════════════════════════════════════════════════════
   IMPORT VIDEO MODAL
═══════════════════════════════════════════════════════════════════════ */
function ImportVideoModal({ onClose, onImport }) {
    const [isDragging, setIsDragging] = useState(false);
    const [pending, setPending] = useState([]);   // files staged
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const fn = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [onClose]);

    const processFiles = (files) => {
        const valid = Array.from(files).filter((f) => {
            const ext = f.name.split('.').pop().toLowerCase();
            return VIDEO_EXTS.includes(ext);
        });
        const mapped = valid.map((f) => ({
            id: Date.now() + Math.random(),
            name: f.name,
            size: fmtFileSize(f.size),
            sizeBytes: f.size,
            duration: 60,          // placeholder — real apps would use video metadata
            durationStr: '01:00',  // browser can load metadata from a blob URL
            res: '1080p',
            file: f,
        }));
        if (mapped.length > 0) setPending((prev) => [...prev, ...mapped]);
        else alert('Format tidak didukung. Gunakan: ' + VIDEO_EXTS.join(', '));
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        processFiles(e.dataTransfer.files);
    };

    const handleFileInput = (e) => processFiles(e.target.files);

    const removePending = (id) => setPending((prev) => prev.filter((f) => f.id !== id));

    const handleImport = () => {
        if (pending.length === 0) return;
        setImporting(true);
        setTimeout(() => {
            onImport(pending);
            onClose();
        }, 900); // simulate brief loading
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box import-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00b87c" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Import Video ke Rundown
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="import-modal-body">
                    {/* Drop Zone */}
                    <div
                        className={`import-dropzone ${isDragging ? 'drop-active' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept={VIDEO_EXTS.map(e => '.' + e).join(',')}
                            style={{ display: 'none' }}
                            onChange={handleFileInput}
                        />
                        <div className="dropzone-icon">
                            {isDragging
                                ? <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00b87c" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                : <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4a5568" strokeWidth="1.2"><rect x="2" y="2" width="20" height="20" rx="2"></rect><polygon points="10 8 16 12 10 16 10 8" fill="#4a5568" stroke="none"></polygon></svg>
                            }
                        </div>
                        <div className="dropzone-text">
                            {isDragging ? 'Lepaskan file di sini' : 'Seret & lepas video di sini'}
                        </div>
                        <div className="dropzone-sub">
                            atau <span className="dropzone-browse">klik untuk pilih file</span>
                        </div>
                        <div className="dropzone-formats">
                            {VIDEO_EXTS.map(e => e.toUpperCase()).join('  ·  ')}
                        </div>
                    </div>

                    {/* Staged Files */}
                    {pending.length > 0 && (
                        <div className="import-staged">
                            <div className="staged-header">
                                <span>{pending.length} file siap diimport</span>
                                <button className="staged-clear" onClick={() => setPending([])}>Hapus Semua</button>
                            </div>
                            <div className="staged-list">
                                {pending.map((f) => (
                                    <div key={f.id} className="staged-item">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00b87c" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2"></rect><polygon points="10 8 16 12 10 16 10 8" fill="#00b87c" stroke="none"></polygon></svg>
                                        <div className="staged-info">
                                            <div className="staged-name">{f.name}</div>
                                            <div className="staged-meta">{f.size}</div>
                                        </div>
                                        <button className="staged-remove" onClick={() => removePending(f.id)} title="Hapus">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid #212631', paddingTop: '16px' }}>
                    <div className="import-footer-note">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#718096" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        Video akan ditambahkan ke akhir rundown
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="modal-btn-cancel" onClick={onClose}>Batal</button>
                        <button
                            className="modal-btn-submit"
                            onClick={handleImport}
                            disabled={pending.length === 0 || importing}
                            style={{ opacity: pending.length === 0 ? 0.45 : 1 }}
                        >
                            {importing
                                ? <><span className="spin-icon">↻</span> Mengimpor...</>
                                : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Import {pending.length > 0 && `(${pending.length})`}</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════
   CONFIG MODAL
═══════════════════════════════════════════════════════════════════════ */
const DEFAULT_CONFIG = {
    streamKey: '',
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
    resolution: '1080p',
    videoBitrate: '6000',
    audioBitrate: '128',
    fps: '30',
    videoCodec: 'H.264 (AVC)',
    audioCodec: 'AAC',
    loopMode: 'repeat_all',
    autoStart: false,
};

function ConfigModal({ config, onClose, onSave }) {
    const [form, setForm] = useState({ ...config });
    const [tab, setTab] = useState('stream');
    const [saved, setSaved] = useState(false);
    const [showKey, setShowKey] = useState(false);  // local only, not persisted

    useEffect(() => {
        const fn = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [onClose]);

    const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

    const handleSave = () => {
        // strip UI-only state before saving
        const { ...toSave } = form;
        onSave(toSave);
        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            onClose();
        }, 700);
    };

    const ConfigInput = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
        <div className="cfg-field">
            <label className="cfg-label">{label}</label>
            <input className="cfg-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        </div>
    );

    const ConfigSelect = ({ label, value, onChange, options }) => (
        <div className="cfg-field">
            <label className="cfg-label">{label}</label>
            <select className="cfg-input cfg-select" value={value} onChange={(e) => onChange(e.target.value)}>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box config-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2172e5" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        Konfigurasi Stream
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Tab Nav */}
                <div className="cfg-tabs">
                    {[
                        { key: 'stream', label: '📡 Stream', },
                        { key: 'encoder', label: '⚙️ Encoder', },
                        { key: 'playback', label: '🎬 Playback', },
                    ].map(({ key, label }) => (
                        <button key={key} className={`cfg-tab ${tab === key ? 'cfg-tab-active' : ''}`} onClick={() => setTab(key)}>
                            {label}
                        </button>
                    ))}
                </div>

                <div className="cfg-body">
                    {/* ── Stream Tab ── */}
                    {tab === 'stream' && (
                        <>
                            <div className="cfg-field">
                                <label className="cfg-label">RTMP URL</label>
                                <input className="cfg-input" type="text" value={form.rtmpUrl} onChange={(e) => set('rtmpUrl', e.target.value)} placeholder="rtmp://..." />
                            </div>
                            <div className="cfg-field">
                                <label className="cfg-label">Stream Key</label>
                                <div className="cfg-key-wrapper">
                                    <span className="cfg-key-icon">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                    </span>
                                    <input
                                        className="cfg-input cfg-key-input"
                                        type={showKey ? 'text' : 'password'}
                                        value={form.streamKey}
                                        onChange={(e) => set('streamKey', e.target.value)}
                                        placeholder="xxxx-xxxx-xxxx-xxxx"
                                    />
                                    <button type="button" className="cfg-key-toggle" onClick={() => setShowKey(!showKey)} title={showKey ? 'Sembunyikan' : 'Tampilkan'}>
                                        {showKey
                                            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        }
                                    </button>
                                </div>
                                <div className="cfg-hint">YouTube Studio → Go Live → Stream Key</div>
                            </div>
                            <div className="cfg-row">
                                <ConfigSelect label="Resolusi Output" value={form.resolution} onChange={(v) => set('resolution', v)} options={RESOLUTIONS} />
                                <ConfigInput label="Frame Rate (FPS)" value={form.fps} onChange={(v) => set('fps', v)} placeholder="30" />
                            </div>
                        </>
                    )}

                    {/* ── Encoder Tab ── */}
                    {tab === 'encoder' && (
                        <>
                            <div className="cfg-row">
                                <ConfigSelect label="Video Codec" value={form.videoCodec} onChange={(v) => set('videoCodec', v)} options={VIDEO_CODECS} />
                                <ConfigSelect label="Audio Codec" value={form.audioCodec} onChange={(v) => set('audioCodec', v)} options={AUDIO_CODECS} />
                            </div>
                            <div className="cfg-row">
                                <ConfigInput label="Video Bitrate (Kbps)" value={form.videoBitrate} onChange={(v) => set('videoBitrate', v)} placeholder="6000" />
                                <ConfigInput label="Audio Bitrate (Kbps)" value={form.audioBitrate} onChange={(v) => set('audioBitrate', v)} placeholder="128" />
                            </div>
                            <div className="cfg-info-box">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2172e5" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                <span>YouTube merekomendasikan: H.264, AAC, 6000 Kbps untuk 1080p@30fps.</span>
                            </div>
                        </>
                    )}

                    {/* ── Playback Tab ── */}
                    {tab === 'playback' && (
                        <>
                            <div className="cfg-field">
                                <label className="cfg-label">Mode Loop</label>
                                <div className="cfg-radio-group">
                                    {[
                                        { val: 'repeat_all', label: '🔁 Ulangi Semua', desc: 'Putar rundown dari awal setelah selesai' },
                                        { val: 'repeat_one', label: '🔂 Ulangi Satu', desc: 'Ulangi video yang sedang diputar' },
                                        { val: 'shuffle', label: '🔀 Acak', desc: 'Putar video secara acak' },
                                        { val: 'once', label: '▶️ Satu Kali', desc: 'Berhenti setelah semua video selesai' },
                                    ].map(({ val, label, desc }) => (
                                        <label key={val} className={`cfg-radio-card ${form.loopMode === val ? 'radio-active' : ''}`} onClick={() => set('loopMode', val)}>
                                            <span className="cfg-radio-label">{label}</span>
                                            <span className="cfg-radio-desc">{desc}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="cfg-field">
                                <label className="cfg-label">Auto Start</label>
                                <div className="cfg-toggle-row">
                                    <div>
                                        <div className="cfg-toggle-title">Mulai otomatis saat halaman dibuka</div>
                                        <div className="cfg-toggle-sub">Playback dimulai tanpa perlu klik tombol Play</div>
                                    </div>
                                    <button
                                        type="button"
                                        className={`toggle-switch ${form.autoStart ? 'toggle-on' : ''}`}
                                        onClick={() => set('autoStart', !form.autoStart)}
                                    >
                                        <span className="toggle-thumb"></span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid #212631', paddingTop: '16px' }}>
                    <button className="modal-btn-cancel" onClick={onClose}>Batal</button>
                    <button className="modal-btn-submit" onClick={handleSave} style={{ background: saved ? '#00b87c' : '#2172e5' }}>
                        {saved
                            ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Tersimpan!</>
                            : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Simpan Konfigurasi</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function VideoLooping() {
    const [clips, setClips] = useState(INITIAL_CLIPS);
    const [activeIdx, setActiveIdx] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(65);
    const [isShuffle, setIsShuffle] = useState(false);
    const [isRepeat, setIsRepeat] = useState(true);
    const [dragOverId, setDragOverId] = useState(null);
    const [dragId, setDragId] = useState(null);
    const [showImport, setShowImport] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const tickRef = useRef(null);

    const activeClip = clips[activeIdx] || clips[0];

    /* ── Playback ticker ────────────────────────────────────── */
    useEffect(() => {
        clearInterval(tickRef.current);
        if (isPlaying) {
            tickRef.current = setInterval(() => {
                setCurrentTime((prev) => {
                    const next = prev + 1;
                    if (next >= activeClip.duration) {
                        handleNext(true);
                        return 0;
                    }
                    return next;
                });
            }, 1000);
        }
        return () => clearInterval(tickRef.current);
    }, [isPlaying, activeIdx, clips]);

    useEffect(() => { setCurrentTime(0); }, [activeIdx]);

    const handleNext = useCallback(() => {
        setCurrentTime(0);
        setActiveIdx((prev) => {
            if (isShuffle) return Math.floor(Math.random() * clips.length);
            const next = prev + 1;
            if (next >= clips.length) return isRepeat ? 0 : prev;
            return next;
        });
    }, [isShuffle, isRepeat, clips.length]);

    const handlePrev = () => {
        setCurrentTime(0);
        setActiveIdx((prev) => (prev - 1 + clips.length) % clips.length);
    };

    const handleProgressClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        setCurrentTime(Math.floor(ratio * activeClip.duration));
    };

    /* ── Drag reorder ───────────────────────────────────────── */
    const handleDragStart = (id) => setDragId(id);
    const handleDragOver = (e, id) => { e.preventDefault(); setDragOverId(id); };
    const handleDrop = (targetId) => {
        if (dragId === targetId) { setDragOverId(null); return; }
        const from = clips.findIndex((c) => c.id === dragId);
        const to = clips.findIndex((c) => c.id === targetId);
        const next = [...clips];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setClips(next);
        setDragOverId(null);
        setDragId(null);
    };

    /* ── Import handler ─────────────────────────────────────── */
    const handleImport = (files) => {
        setClips((prev) => [
            ...prev,
            ...files.map((f) => ({ ...f, id: Date.now() + Math.random() })),
        ]);
    };

    /* ── Delete clip ────────────────────────────────────────── */
    const deleteClip = (idx, e) => {
        e.stopPropagation();
        setClips((prev) => {
            const next = prev.filter((_, i) => i !== idx);
            return next;
        });
        if (activeIdx >= idx && activeIdx > 0) setActiveIdx((p) => p - 1);
    };

    const progressPct = activeClip.duration > 0 ? (currentTime / activeClip.duration) * 100 : 0;

    return (
        <>
            {showImport && <ImportVideoModal onClose={() => setShowImport(false)} onImport={handleImport} />}
            {showConfig && <ConfigModal config={config} onClose={() => setShowConfig(false)} onSave={setConfig} />}

            <div className="vl-layout">
                {/* ── LEFT: Rundown ────────────────────────────────── */}
                <div className="vl-left">
                    <div className="vl-list-header">
                        <div className="vl-title-row">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b87c" strokeWidth="2.5">
                                <line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line>
                                <line x1="8" y1="18" x2="21" y2="18"></line>
                                <line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line>
                                <line x1="3" y1="18" x2="3.01" y2="18"></line>
                            </svg>
                            <span className="vl-title">RUNDOWN LIST</span>
                            <span className="vl-badge">{clips.length} CLIPS</span>
                            <span className="vl-total">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                Total: {fmtTime(clips.reduce((a, c) => a + c.duration, 0))}
                            </span>
                        </div>
                        <button className="vl-import-btn" onClick={() => setShowImport(true)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            IMPORT VIDEO
                        </button>
                    </div>

                    <div className="vl-clip-list">
                        {clips.length === 0 && (
                            <div className="vl-empty-state" onClick={() => setShowImport(true)}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                <p>Belum ada video</p>
                                <span>Klik Import Video untuk menambahkan</span>
                            </div>
                        )}
                        {clips.map((clip, idx) => (
                            <div
                                key={clip.id}
                                className={`vl-clip-row ${activeIdx === idx ? 'clip-active' : ''} ${dragOverId === clip.id ? 'clip-drag-over' : ''}`}
                                draggable
                                onDragStart={() => handleDragStart(clip.id)}
                                onDragOver={(e) => handleDragOver(e, clip.id)}
                                onDrop={() => handleDrop(clip.id)}
                                onDragEnd={() => { setDragOverId(null); setDragId(null); }}
                                onClick={() => { setActiveIdx(idx); setIsPlaying(false); }}
                            >
                                <div className="clip-drag-handle">⋮⋮</div>
                                <div className="clip-thumb-icon"><VideoIcon /></div>
                                <div className="clip-info">
                                    <div className="clip-name">{clip.name}</div>
                                    <div className="clip-meta">
                                        <span className="clip-duration">{clip.durationStr}</span>
                                        <span className="clip-size">{clip.size}</span>
                                        <span className={`clip-res-badge ${clip.res === '4K' ? 'res-4k' : 'res-1080'}`}>{clip.res}</span>
                                    </div>
                                </div>
                                {activeIdx === idx && (
                                    <span className={`clip-status-badge ${isPlaying ? 'status-playing' : 'status-paused'}`}>
                                        {isPlaying ? 'PLAYING' : 'PAUSED'}
                                    </span>
                                )}
                                <button className="clip-delete-btn" onClick={(e) => deleteClip(idx, e)} title="Hapus dari rundown">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── RIGHT: Preview + Player ──────────────────────── */}
                <div className="vl-right">
                    <div className="vl-preview-panel">
                        <div className="preview-top-badges">
                            <span className={`badge-offline ${isPlaying ? 'badge-online' : ''}`}>
                                {isPlaying ? '● LIVE' : '● OFFLINE'}
                            </span>
                            <span className="badge-res">⬜ {activeClip.res}</span>
                        </div>
                        <div className="preview-screen">
                            {isPlaying ? (
                                <div className="preview-playing">
                                    <div className="playing-bars">
                                        {Array.from({ length: 9 }).map((_, i) => (
                                            <div key={i} className="playing-bar" style={{ animationDelay: `${i * 0.1}s` }}></div>
                                        ))}
                                    </div>
                                    <div className="preview-filename">{activeClip.name}</div>
                                </div>
                            ) : (
                                <div className="signal-standby">
                                    <div className="signal-bars">
                                        {[3, 6, 9, 12, 9, 6, 3].map((h, i) => (
                                            <div key={i} className="signal-bar" style={{ height: `${h * 3 + 4}px`, animationDelay: `${i * 0.12}s` }}></div>
                                        ))}
                                    </div>
                                    <div className="signal-label">SIGNAL STANDBY</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="vl-player-panel">
                        <div className="player-file-name">{activeClip.name}</div>
                        <div className="player-time">
                            <span className="time-current">{fmtTime(currentTime)}</span>
                            <span className="time-sep"> / </span>
                            <span className="time-total">{activeClip.durationStr}</span>
                        </div>

                        <div className="player-progress-bar" onClick={handleProgressClick} title="Klik untuk seek">
                            <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
                            <div className="progress-thumb" style={{ left: `${progressPct}%` }}></div>
                        </div>

                        <div className="player-controls">
                            <button className={`ctrl-btn ${isShuffle ? 'ctrl-active' : ''}`} onClick={() => setIsShuffle(!isShuffle)} title="Shuffle">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line></svg>
                            </button>
                            <button className="ctrl-btn" onClick={handlePrev} title="Previous">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                            </button>
                            <button className="ctrl-btn play-btn" onClick={() => setIsPlaying(!isPlaying)} title={isPlaying ? 'Pause' : 'Play'}>
                                {isPlaying
                                    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                }
                            </button>
                            <button className="ctrl-btn" onClick={() => handleNext(false)} title="Next">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                            </button>
                            <button className={`ctrl-btn ${isRepeat ? 'ctrl-active' : ''}`} onClick={() => setIsRepeat(!isRepeat)} title="Repeat">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                            </button>
                        </div>

                        <div className="player-bottom-row">
                            <div className="volume-row">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                                <input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="volume-slider" style={{ '--vol': `${volume}%` }} />
                                <span className="volume-value">{volume}%</span>
                            </div>
                            <div className="player-divider"></div>
                            <button className="config-btn" onClick={() => setShowConfig(true)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                CONFIG
                            </button>
                        </div>

                        <div className="player-stats-row">
                            <div className="player-stat"><span className="stat-key">BITRATE</span><span className="stat-val green-val">{isPlaying ? (config.videoBitrate + 'K') : '—'}</span></div>
                            <div className="player-stat"><span className="stat-key">CPU</span><span className="stat-val blue-val">{isPlaying ? '12%' : '0%'}</span></div>
                            <div className="player-stat"><span className="stat-key">DROP</span><span className="stat-val">0</span></div>
                            <div className="player-stat"><span className="stat-key">FPS</span><span className="stat-val">{isPlaying ? config.fps : '—'}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
