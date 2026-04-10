import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../api';
import toast, { Toaster } from 'react-hot-toast';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Rocket, Brain, Terminal, Shield, Globe, Lock, 
    Layers, Zap, RefreshCw, FolderPlus, MessageSquare, 
    CheckCircle2, AlertCircle, PlayCircle
} from 'lucide-react';
import './YTAutomation.css';

const SOCKET_URL = window.location.origin;

interface PipelineJob {
    id: string;
    filename: string;
    stage: 'UPLOAD' | 'SEO' | 'THUMB' | 'DEPLOY' | 'LIVE' | 'SCHED' | 'COMPLETE' | 'ERROR';
    progress: number;
    error?: string;
    results?: any;
    streamId?: string;
}

interface AutoRule {
    id: string;
    name: string;
    description: string;
    icon: string;
    enabled: boolean | number;
    category: string;
}

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
}

export default function YTAutomation() {
    const [activeTab, setActiveTab] = useState<'launcher' | 'bulk'>('launcher');
    const [jobs, setJobs] = useState<PipelineJob[]>([]);
    const [rules, setRules] = useState<AutoRule[]>([]);
    const [socketLogs, setSocketLogs] = useState<LogEntry[]>([]);
    const [stats, setStats] = useState({ active: 0, completed: 0, aiDecisions: 1242 });
    
    // Config State
    const [privacy, setPrivacy] = useState<'public' | 'private' | 'unlisted'>('public');
    const [category, setCategory] = useState('Entertainment');
    const [isUltimateRunning, setIsUltimateRunning] = useState(false);
    
    // Bulk Ingest State
    const [bulkPath, setBulkPath] = useState('');
    const [isIngesting, setIsIngesting] = useState(false);

    const logEndRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<any>(null);

    const scrollToBottom = () => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [socketLogs]);

    // FETCH INITIAL DATA
    const fetchData = useCallback(async () => {
        try {
            const rulesRes = await apiFetch('/api/automation/rules');
            setRules(rulesRes);
            const sRes = await apiFetch('/api/streams/analytics/summary');
            setStats(prev => ({
                ...prev,
                completed: sRes.totalSessions || 0
            }));
        } catch (e) {}
    }, []);

    useEffect(() => {
        fetchData();
        
        // SOCKET.IO INTEGRATION
        const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('streamLog', (data: any) => {
            setSocketLogs(prev => [...prev.slice(-100), {
                timestamp: new Date().toLocaleTimeString(),
                level: data.level || 'info',
                message: data.message || data.msg
            }]);
        });

        return () => {
            socket.disconnect();
        };
    }, [fetchData]);

    const toggleRule = async (id: string, current: any) => {
        try {
            await apiFetch(`/api/automation/rules/${id}/toggle`, {
                method: 'PUT',
                body: JSON.stringify({ enabled: !current })
            });
            fetchData();
        } catch (e: any) {
            toast.error('Failed to update rule');
        }
    };

    // MISSION LAUNCHER LOGIC
    const runFullPipeline = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        
        const newJobs: PipelineJob[] = Array.from(files).map((f, i) => ({
            id: `job-${Date.now()}-${i}`,
            filename: f.name,
            stage: 'UPLOAD',
            progress: 0
        }));
        
        setJobs(prev => [...newJobs, ...prev]);
        setStats(prev => ({ ...prev, active: prev.active + files.length }));

        for (let i = 0; i < files.length; i++) {
            processJob(newJobs[i].id, files[i]);
        }
    };

    const processJob = async (jobId: string, file: File) => {
        const update = (patch: Partial<PipelineJob>) => {
            setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...patch } : j));
        };

        try {
            // 1. UPLOAD
            update({ stage: 'UPLOAD', progress: 10 });
            const formData = new FormData();
            formData.append('videos', file);
            const uploadRes = await apiFetch('/api/media/videos/upload', { method: 'POST', body: formData });
            const videoId = uploadRes.results[0].id;
            
            // 2. AI SEO
            update({ stage: 'SEO', progress: 30 });
            const seoRes = await apiFetch('/api/automation/seo', {
                method: 'POST',
                body: JSON.stringify({ videoId, title: file.name })
            });
            
            // 3. SMART THUMB
            update({ stage: 'THUMB', progress: 50 });
            const thumbRes = await apiFetch('/api/automation/thumbnail', {
                method: 'POST',
                body: JSON.stringify({ videoId, title: seoRes.title })
            });

            // 4. DEPLOY
            update({ stage: 'DEPLOY', progress: 70 });
            const stream = await apiFetch('/api/streams', {
                method: 'POST',
                body: JSON.stringify({
                    title: seoRes.title,
                    playlist_path: videoId,
                    platform: 'YOUTUBE',
                    privacy,
                    category
                })
            });
            update({ streamId: stream.id });

            // 5. LIVE
            update({ stage: 'LIVE', progress: 85 });
            await apiFetch(`/api/streams/${stream.id}/start`, { method: 'POST' });

            // 6. SCHED (Auto Rotation Logic)
            update({ stage: 'SCHED', progress: 95 });
            const tomorrow = new Date(Date.now() + 86400000).toISOString();
            await apiFetch('/api/schedules', {
                method: 'POST',
                body: JSON.stringify({
                    name: `Auto-Rerun: ${seoRes.title}`,
                    start: tomorrow,
                    is_recurring: 1,
                    status: 'SCHEDULED',
                    playlist_path: videoId,
                    privacy,
                    category
                })
            });

            update({ stage: 'COMPLETE', progress: 100 });
            setStats(prev => ({ ...prev, active: Math.max(0, prev.active - 1) }));
            toast.success(`Pipeline complete for ${file.name}`);
        } catch (err: any) {
            update({ stage: 'ERROR', error: err.message, progress: 0 });
            setStats(prev => ({ ...prev, active: Math.max(0, prev.active - 1) }));
            toast.error(`Job failed: ${err.message}`);
        }
    };

    // BULK INGEST LOGIC
    const handleBulkIngest = async () => {
        if (!bulkPath) return toast.error('Path folder tidak boleh kosong');
        setIsIngesting(true);
        try {
            const res = await apiFetch('/api/automation/bulk-ingest', {
                method: 'POST',
                body: JSON.stringify({ folderPath: bulkPath, privacy, category })
            });
            toast.success(`Berhasil! ${res.count} video masuk ke pipeline antrean.`);
            setBulkPath('');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsIngesting(false);
        }
    };

    return (
        <motion.div 
            className="yt-auto-container"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <Toaster position="top-right" />
            
            <header className="yt-auto-header">
                <div>
                    <h1>YT-AUTOMATION <span className="blink" style={{ color: '#818cf8', fontSize: '1rem' }}>ELITE</span></h1>
                    <p className="subtitle">Real-time command center for YouTube AI operations.</p>
                </div>
                <div className="engine-status-badge">
                    <Zap size={14} fill="currentColor" />
                    <span>AI ENGINE: ONLINE</span>
                </div>
            </header>

            {/* QUICK STATS */}
            <div className="quick-stats-ribbon">
                <StatItem label="Active Jobs" value={stats.active} color="#6366f1" />
                <StatItem label="Total Streams" value={stats.completed} color="#10b981" />
                <StatItem label="AI Decisions" value={stats.aiDecisions.toLocaleString()} color="#f59e0b" />
            </div>

            <div className="master-grid">
                {/* COLUMN 1: MISSION CONTROL */}
                <div className="master-col">
                    <div className="col-header">
                        <Rocket size={18} className="col-icon" />
                        <h3>Mission Control</h3>
                    </div>

                    <div className="tabs-mini" style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                        <button className={`btn-tab ${activeTab === 'launcher' ? 'active' : ''}`} onClick={() => setActiveTab('launcher')}>Launcher</button>
                        <button className={`btn-tab ${activeTab === 'bulk' ? 'active' : ''}`} onClick={() => setActiveTab('bulk')}>Bulk Ingest</button>
                    </div>

                    {activeTab === 'launcher' ? (
                        <div className="drop-zone-pro" onClick={() => document.getElementById('file-up')?.click()}>
                            <input type="file" multiple id="file-up" onChange={(e) => runFullPipeline(e.target.files)} hidden />
                            <div className="dz-inner">
                                <Zap size={32} color="#6366f1" />
                                <h4>Deploy New Assets</h4>
                                <p>Drag & drop or click to launch pipeline</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bulk-ingest-panel">
                            <input 
                                type="text" 
                                className="elite-input" 
                                placeholder="Absolute path: /root/videos/folder" 
                                value={bulkPath}
                                onChange={e => setBulkPath(e.target.value)}
                            />
                            <button 
                                className="btn-elite-action" 
                                onClick={handleBulkIngest}
                                disabled={isIngesting}
                            >
                                {isIngesting ? <RefreshCw className="spin" size={16} /> : <FolderPlus size={16} />} 
                                {isIngesting ? ' PROCESSING...' : ' START BULK INGEST'}
                            </button>
                        </div>
                    )}

                    <div className="launcher-controls">
                        <div className="ctrl-group">
                            <label><Globe size={12} /> Privacy</label>
                            <select className="elite-select" value={privacy} onChange={e => setPrivacy(e.target.value as any)}>
                                <option value="public">Public</option>
                                <option value="unlisted">Unlisted</option>
                                <option value="private">Private</option>
                            </select>
                        </div>
                        <div className="ctrl-group">
                            <label><Layers size={12} /> Category</label>
                            <select className="elite-select" value={category} onChange={e => setCategory(e.target.value)}>
                                <option value="Entertainment">Entertainment</option>
                                <option value="Gaming">Gaming</option>
                                <option value="Music">Music</option>
                                <option value="News & Politics">News</option>
                            </select>
                        </div>
                    </div>

                    <div className="mini-queue-list">
                        <AnimatePresence>
                            {jobs.map(job => (
                                <motion.div 
                                    key={job.id} 
                                    className={`mini-job-card ${job.stage.toLowerCase()}`}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <div className="mj-header">
                                        <Zap size={14} color="#6366f1" />
                                        <span className="mj-name">{job.filename}</span>
                                        <span className="mj-pct">{job.progress}%</span>
                                    </div>
                                    <div className="mj-bar">
                                        <motion.div className="mj-fill" initial={{ width: 0 }} animate={{ width: `${job.progress}%` }} />
                                    </div>
                                    <div className="mj-footer" style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8' }}>{job.stage}</span>
                                        {job.stage === 'LIVE' && (
                                            <button className="btn-mini-link" onClick={() => window.open(`#/live-chat/${job.streamId}`)}>
                                                <MessageSquare size={12} /> CHAT
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                {/* COLUMN 2: AI BRAIN */}
                <div className="master-col">
                    <div className="col-header">
                        <Brain size={18} className="col-icon" />
                        <h3>Engine Logic</h3>
                    </div>

                    <div className="rules-grid-elite">
                        {rules.map(rule => (
                            <div key={rule.id} className={`rule-card ${rule.enabled ? 'active' : ''}`}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '1.2rem' }}>{rule.icon}</span>
                                    <div className="switch-elite" onClick={() => toggleRule(rule.id, rule.enabled)}>
                                        <div className={`knob-elite ${rule.enabled ? 'active' : ''}`} />
                                    </div>
                                </div>
                                <h4>{rule.name}</h4>
                                <p>{rule.description}</p>
                            </div>
                        ))}
                    </div>

                    <div className="col-header" style={{ marginTop: '20px' }}>
                        <PlayCircle size={18} className="col-icon" />
                        <h3>Autonomous Tasks</h3>
                    </div>
                    
                    <button className="btn-glass-wide" onClick={() => apiFetch('/api/automation/trigger-seo', { method: 'POST' })}>
                        <Zap size={14} /> FORCE SEO RE-ROTATION
                    </button>
                </div>

                {/* COLUMN 3: TERMINAL */}
                <div className="master-col">
                    <div className="col-header">
                        <Terminal size={18} className="col-icon" />
                        <h3>AI Activity Sentinel</h3>
                    </div>

                    <div className="log-terminal">
                        {socketLogs.length === 0 ? (
                            <div style={{ textAlign: 'center', opacity: 0.2, marginTop: '200px' }}>
                                <Shield size={40} style={{ marginBottom: '10px' }} />
                                <p>Watching for signals...</p>
                            </div>
                        ) : (
                            socketLogs.map((log, i) => (
                                <div key={i} className={`log-entry ${log.level}`}>
                                    <span className="log-time">{log.timestamp}</span>
                                    <span className="log-msg">{log.message}</span>
                                </div>
                            ))
                        )}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>

            <style>{`
                .btn-tab { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); color: #94a3b8; padding: 6px 15px; border-radius: 8px; cursor: pointer; font-size: 0.75rem; font-weight: 700; transition: 0.2s; }
                .btn-tab.active { background: rgba(99, 102, 241, 0.1); border-color: #6366f1; color: white; }
                .elite-select { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); color: white; padding: 8px; border-radius: 8px; font-size: 0.8rem; width: 100%; outline: none; }
                .ctrl-group { display: flex; flex-direction: column; gap: 5px; }
                .ctrl-group label { font-size: 0.65rem; color: #64748b; font-weight: 800; text-transform: uppercase; display: flex; alignItems: center; gap: 4px; }
                .switch-elite { width: 34px; height: 18px; background: rgba(0,0,0,0.3); border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); padding: 2px; cursor: pointer; transition: 0.3s; }
                .knob-elite { width: 12px; height: 12px; background: #475569; border-radius: 50%; transition: 0.3s; }
                .knob-elite.active { transform: translateX(16px); background: #22c55e; box-shadow: 0 0 10px rgba(34, 197, 94, 0.5); }
                .btn-mini-link { background: #6366f1; border: none; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.6rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px; }
                .btn-glass-wide { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); color: #818cf8; width: 100%; padding: 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; gap: 10px; }
                .btn-glass-wide:hover { background: rgba(99, 102, 241, 0.2); border-color: #6366f1; }
                .log-terminal.error .log-msg { color: #f87171; }
                .log-terminal.warn .log-msg { color: #facc15; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .rules-grid-elite { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            `}</style>
        </motion.div>
    );
}

const StatItem = ({ label, value, color }: any) => (
    <div className="qs-item" style={{ borderLeft: `3px solid ${color}` }}>
        <span className="qs-label">{label}</span>
        <span className="qs-val">{value}</span>
    </div>
);
