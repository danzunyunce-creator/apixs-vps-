import React, { useState, useCallback } from 'react';
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

export default function YTAutomation() {
    const [jobs, setJobs] = useState<PipelineJob[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const addLog = (jobId: string, msg: string, type: 'info'|'success'|'error' = 'info') => {
        // Logika log per-job bisa ditambahkan jika perlu
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

        // Process each file in parallel (but controlled)
        for (let i = 0; i < files.length; i++) {
            processJob(newJobs[i].id, files[i]);
        }
    };

    const processJob = async (jobId: string, file: File) => {
        const update = (patch: Partial<PipelineJob>) => {
            setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...patch } : j));
        };

        try {
            // STEP 1: UPLOAD
            update({ stage: 'UPLOAD', progress: 10 });
            const formData = new FormData();
            formData.append('videos', file);
            const uploadRes = await apiFetch('/api/media/videos/upload', { method: 'POST', body: formData });
            
            const videoId = uploadRes.results[0].id;
            const videoPath = uploadRes.results[0].filepath; // Backend needs to return this or we fetch
            update({ stage: 'SEO', progress: 30, results: { videoId } });

            // STEP 2: AI SEO
            const seoRes = await apiFetch('/api/automation/seo', {
                method: 'POST',
                body: JSON.stringify({ videoId })
            });
            update({ stage: 'THUMB', progress: 50, results: { ...seoRes, videoId } });

            // STEP 3: THUMBNAIL
            await apiFetch('/api/automation/thumbnail', {
                method: 'POST',
                body: JSON.stringify({ videoId })
            });
            update({ stage: 'DEPLOY', progress: 70 });

            // STEP 4: CREATE STREAM
            const stream = await apiFetch('/api/streams', {
                method: 'POST',
                body: JSON.stringify({
                    title: seoRes.title,
                    playlist_path: videoId, // In this model, videoId is the path or we resolve it
                    platform: 'YOUTUBE'
                })
            });
            update({ stage: 'LIVE', progress: 85 });

            // STEP 5: START STREAM (Local logic)
            await apiFetch(`/api/streams/${stream.id}/start`, { method: 'POST' });
            update({ stage: 'SCHED', progress: 95 });

            // STEP 6: SCHEDULE RERUN
            const start = new Date(Date.now() + 24 * 3600000); // Besok
            const end = new Date(start.getTime() + 7200000); // 2 jam
            await apiFetch('/api/schedules', {
                method: 'POST',
                body: JSON.stringify({
                    name: `Rerun: ${file.name}`,
                    start: start.toISOString(),
                    end: end.toISOString(),
                    status: 'SCHEDULED'
                })
            });

            update({ stage: 'COMPLETE', progress: 100 });
        } catch (err: any) {
            update({ stage: 'ERROR', error: err.message, progress: 0 });
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
                    <h1>🤖 Full-Auto YT Pipeline</h1>
                    <p className="subtitle">Pusat Kendali Otomatisasi Video: Dari PC ke Live YouTube dalam satu tarikan.</p>
                </div>
                <div className="pipeline-stats">
                    <div className="ps-item">
                        <span>Active Jobs</span>
                        <strong>{jobs.filter(j => j.stage !== 'COMPLETE' && j.stage !== 'ERROR').length}</strong>
                    </div>
                </div>
            </div>

            {/* MAIN CONTROL PANEL */}
            <div className="mission-control-panel">
                <div className="drop-zone-premium">
                    <input type="file" multiple id="auto-up" onChange={(e) => runFullPipeline(e.target.files)} hidden />
                    <label htmlFor="auto-up">
                        <div className="dz-content">
                            <span className="dz-icon">⚡</span>
                            <h2>Launch Full Pipeline</h2>
                            <p>Seret folder video atau pilih file untuk memulai otomasi massal</p>
                        </div>
                    </label>
                </div>

                <div className="active-pipeline-list">
                    <div className="list-header">
                        <h3>📋 Mission Queue</h3>
                        <button className="btn-clear-all" onClick={() => setJobs([])}>Clear History</button>
                    </div>

                    <div className="jobs-scroll-area">
                        {jobs.length === 0 ? (
                            <div className="empty-pipeline">
                                <p>Belum ada siaran dalam antrean otomasi.</p>
                            </div>
                        ) : (
                            jobs.map(job => (
                                <div key={job.id} className={`pipeline-job-card ${job.stage.toLowerCase()}`}>
                                    <div className="job-meta">
                                        <span className="job-icon">{getStageIcon(job.stage)}</span>
                                        <div className="job-details">
                                            <span className="job-name">{job.filename}</span>
                                            <span className="job-stage-text">
                                                {job.stage === 'ERROR' ? `Failed: ${job.error}` : `Processing: ${job.stage}...`}
                                            </span>
                                        </div>
                                        <div className="job-percent">{job.progress}%</div>
                                    </div>
                                    
                                    <div className="job-progress-track">
                                        <div className="job-progress-fill" style={{ width: `${job.progress}%` }} />
                                    </div>

                                    <div className="job-pipeline-steps">
                                        {['UPLOAD', 'SEO', 'THUMB', 'DEPLOY', 'LIVE', 'SCHED'].map((st: any) => (
                                            <div key={st} className={`mini-step ${job.stage === st ? 'active' : ''} ${job.progress > 0 && ['UPLOAD', 'SEO', 'THUMB', 'DEPLOY', 'LIVE', 'SCHED'].indexOf(job.stage) > ['UPLOAD', 'SEO', 'THUMB', 'DEPLOY', 'LIVE', 'SCHED'].indexOf(st) ? 'done' : ''}`}>
                                                {st.slice(0,1)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
