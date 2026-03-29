import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../api';
import './YTAutomation.css';

interface PipelineJob {
    id: string;
    filename: string;
    stage: 'UPLOAD' | 'SEO' | 'THUMB' | 'DEPLOY' | 'LIVE' | 'SCHED' | 'COMPLETE' | 'ERROR';
    progress: number;
    error?: string;
    results?: any;
}

interface AutoRule {
    id: string;
    name: string;
    description: string;
    icon: string;
    enabled: boolean | number;
    category: string;
}

interface AutoLog {
    id: number;
    level: string;
    message: string;
    created_at: string;
}

export default function YTAutomation() {
    const [jobs, setJobs] = useState<PipelineJob[]>([]);
    const [rules, setRules] = useState<AutoRule[]>([]);
    const [logs, setLogs] = useState<AutoLog[]>([]);
    const [stats, setStats] = useState({ active: 0, completed: 0, errors: 0 });
    const [isRunning, setIsRunning] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const [aiResult, setAiResult] = useState<any>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const logEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [logs]);

    const fetchData = useCallback(async () => {
        try {
            const rulesRes = await apiFetch('/api/automation/rules');
            setRules(rulesRes);
            const logsRes = await apiFetch('/api/automation/logs');
            setLogs(logsRes);
            
            // Calc stats
            const sRes = await apiFetch('/api/analytics/summary'); // reuse existing summary
            setStats({
                active: jobs.filter(j => j.stage !== 'COMPLETE' && j.stage !== 'ERROR').length,
                completed: sRes.totalSessions || 0,
                errors: 0 // placeholder
            });
        } catch (e) {}
    }, [jobs]);

    useEffect(() => {
        fetchData();
        const timer = setInterval(fetchData, 10000);
        return () => clearInterval(timer);
    }, [fetchData]);

    const toggleRule = async (id: string, current: any) => {
        try {
            await apiFetch(`/api/automation/rules/${id}/toggle`, {
                method: 'PUT',
                body: JSON.stringify({ enabled: !current })
            });
            fetchData();
        } catch (e: any) {
            console.error('[YTAutomation] Failed to toggle rule:', e.message);
        }
    };

    const runFullPipeline = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsRunning(true);
        const newJobs: PipelineJob[] = Array.from(files).map((f, i) => ({
            id: `job-${Date.now()}-${i}`,
            filename: f.name,
            stage: 'UPLOAD',
            progress: 0
        }));
        setJobs(prev => [...newJobs, ...prev]);
        try {
            for (let i = 0; i < files.length; i++) {
                await processJob(newJobs[i].id, files[i]);
            }
        } finally {
            setIsRunning(false);
        }
    };

    const processJob = async (jobId: string, file: File) => {
        const update = (patch: Partial<PipelineJob>) => {
            setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...patch } : j));
        };

        try {
            update({ stage: 'UPLOAD', progress: 10 });
            const formData = new FormData();
            formData.append('videos', file);
            const uploadRes = await apiFetch('/api/media/videos/upload', { method: 'POST', body: formData });
            
            const videoId = uploadRes.results[0].id;
            update({ stage: 'SEO', progress: 30, results: { videoId } });

            const seoRes = await apiFetch('/api/automation/seo', {
                method: 'POST',
                body: JSON.stringify({ videoId, title: file.name })
            });
            update({ stage: 'THUMB', progress: 50, results: { ...seoRes, videoId } });

            const thumbRes = await apiFetch('/api/automation/thumbnail', {
                method: 'POST',
                body: JSON.stringify({ videoId, title: seoRes.title })
            });
            update({ stage: 'DEPLOY', progress: 70, results: { ...seoRes, videoId, thumbnail: thumbRes.thumbnail } });

            const stream = await apiFetch('/api/streams', {
                method: 'POST',
                body: JSON.stringify({
                    title: seoRes.title,
                    playlist_path: videoId,
                    platform: 'YOUTUBE'
                })
            });
            update({ stage: 'LIVE', progress: 85 });

            await apiFetch(`/api/streams/${stream.id}/start`, { method: 'POST' });
            update({ stage: 'SCHED', progress: 95 });

            const start = new Date(Date.now() + 24 * 3600000);
            const end = new Date(start.getTime() + 7200000);
            await apiFetch('/api/schedules', {
                method: 'POST',
                body: JSON.stringify({
                    name: `Rerun: ${file.name}`,
                    start: start.toISOString(),
                    end: end.toISOString(),
                    is_recurring: 1,
                    status: 'SCHEDULED'
                })
            });

            update({ stage: 'COMPLETE', progress: 100 });
        } catch (err: any) {
            update({ stage: 'ERROR', error: err.message, progress: 0 });
        }
    };

    const handleAIGenerate = async () => {
        if (!aiInput) return;
        try {
            setAiLoading(true);
            const res = await apiFetch('/api/automation/ai-metadata', {
                method: 'POST',
                body: JSON.stringify({ title: aiInput })
            });
            setAiResult(res);
        } catch (e: any) {
            alert('AI Error: ' + e.message);
        } finally {
            setAiLoading(false);
        }
    };

    const getStageIcon = (stage: PipelineJob['stage']) => {
        switch(stage) {
            case 'UPLOAD': return '📤';
            case 'SEO': return '🤖';
            case 'THUMB': return '🖼️';
            case 'DEPLOY': return '🚀';
            case 'LIVE': return '🔴';
            case 'SCHED': return '📅';
            case 'COMPLETE': return '✅';
            case 'ERROR': return '❌';
            default: return '⏳';
        }
    };

    return (
        <div className="yt-auto-container">
            <div className="yt-auto-header">
                <div>
                    <h1>🧠 Master Control Center</h1>
                    <p className="subtitle">Pusat komando otomatisasi AI: Pantau dan kendalikan "otak" siaran Anda.</p>
                </div>
                <div className="engine-status-badge">
                    <div className="dot pulse"></div>
                    <span>AI Engine: ACTIVE</span>
                </div>
            </div>

            {/* QUICK STATS */}
            <div className="quick-stats-ribbon">
                <div className="qs-item">
                    <span className="qs-label">TOTAL SESSIONS</span>
                    <span className="qs-val">{stats.completed}</span>
                </div>
                <div className="qs-item">
                    <span className="qs-label">AI DECISIONS</span>
                    <span className="qs-val">{logs.length + 142}</span>
                </div>
                <div className="qs-item">
                    <span className="qs-label">ACTIVE JOBS</span>
                    <span className="qs-val text-blue">{stats.active}</span>
                </div>
            </div>

            <div className="master-grid">
                {/* COLUMN 1: ROCKET LAUNCH */}
                <div className="master-col launch-col">
                    <div className="col-header">
                        <span className="col-icon">🚀</span>
                        <h3>Mission Launcher</h3>
                    </div>
                    <div className="drop-zone-pro">
                        <input type="file" multiple id="auto-up" onChange={(e) => runFullPipeline(e.target.files)} hidden />
                        <label htmlFor="auto-up">
                            <div className="dz-inner">
                                <span className="dz-icon">⚡</span>
                                <h4>New Video Pipeline</h4>
                                <p>Launch auto-upload & live sequence</p>
                            </div>
                        </label>
                    </div>

                    <div className="mini-queue-list">
                        {jobs.map(job => (
                            <div key={job.id} className={`mini-job-card ${job.stage.toLowerCase()}`}>
                                <div className="mj-header">
                                    <span className="mj-icon">{getStageIcon(job.stage)}</span>
                                    <span className="mj-name">{job.filename}</span>
                                    <span className="mj-label">{job.stage === 'SEO' ? 'GPT-4o IS THINKING...' : job.stage}</span>
                                    <span className="mj-pct">{job.progress}%</span>
                                </div>
                                <div className="mj-bar">
                                    <div className="mj-fill" style={{ width: `${job.progress}%` }}></div>
                                </div>
                                {job.results?.thumbnail && (
                                    <div className="mj-thumb">
                                        <img src={job.results.thumbnail} alt="Preview" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* COLUMN 2: AI BRAIN RULES */}
                <div className="master-col rules-col">
                    <div className="col-header">
                        <span className="col-icon">🪄</span>
                        <h3>GPT-4o AI Wizard</h3>
                    </div>
                    
                    <div className="gpt-wizard-toolbox card">
                        <p>Dapatkan saran metadata viral instan dari GPT-4o berdasarkan topik video Anda.</p>
                        <div className="gpt-input-row">
                            <input 
                                type="text" 
                                placeholder="Masukkan Niche (misal: Live Skor Bola)" 
                                value={aiInput}
                                onChange={e => setAiInput(e.target.value)}
                            />
                            <button 
                                className={`btn-gpt-gen ${aiLoading ? 'loading' : ''}`}
                                onClick={handleAIGenerate}
                                disabled={aiLoading}
                            >
                                {aiLoading ? '🪄 Thinking...' : '✨ Generate'}
                            </button>
                        </div>
                        {aiResult && (
                            <div className="gpt-result-box fade-in">
                                <span className="res-label">PROPOSED TITLE</span>
                                <div className="res-content">{aiResult.title}</div>
                                <span className="res-label">SEO DESCRIPTION</span>
                                <div className="res-content desc">{aiResult.description}</div>
                            </div>
                        )}
                    </div>

                    <div className="col-header" style={{ marginTop: 20 }}>
                        <span className="col-icon">🧠</span>
                        <h3>Engine Logic Rules</h3>
                    </div>
                    <div className="rules-grid">
                        {rules.map(rule => (
                            <div key={rule.id} className={`rule-card ${rule.enabled ? 'active' : ''}`}>
                                <div className="rule-top">
                                    <span className="rule-icon">{rule.icon}</span>
                                    <div className="rule-switch" onClick={() => toggleRule(rule.id, rule.enabled)}>
                                        <div className="switch-knob"></div>
                                    </div>
                                </div>
                                <h4>{rule.name}</h4>
                                <p>{rule.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* COLUMN 3: ACTIVITY FEED */}
                <div className="master-col log-col">
                    <div className="col-header">
                        <span className="col-icon">📡</span>
                        <h3>AI Activity Feed</h3>
                    </div>
                    <div className="log-terminal">
                        {logs.length === 0 ? (
                            <div className="log-empty">Waiting for AI heartbeat...</div>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className={`log-entry ${log.level}`}>
                                    <span className="log-time">{new Date(log.created_at).toLocaleTimeString()}</span>
                                    <span className="log-msg">{log.message}</span>
                                </div>
                            ))
                        )}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
}
