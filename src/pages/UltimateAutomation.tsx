import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../api';
import io from 'socket.io-client';
import { BASE_URL } from '../api';

const SOCKET_URL = BASE_URL || window.location.origin.replace('5173', '3001');

export default function UltimateAutomation() {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [videos, setVideos] = useState<any[]>([]);
    const [logs, setLogs] = useState<{message: string, type: 'info' | 'success' | 'error'}[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const socketRef = useRef<any>(null);

    const log = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
        setLogs(prev => [{ message: `[${new Date().toLocaleTimeString()}] ${message}`, type }, ...prev].slice(0, 200));
    }, []);

    useEffect(() => {
        loadData();
        
        const socket = io(SOCKET_URL);
        socketRef.current = socket;

        socket.on('streamLog', (data: any) => {
            if (data.level === 'error') log(data.message || data.msg, 'error');
            else if (data.level === 'warn') log(data.message || data.msg, 'info');
            else log(data.message || data.msg, 'info');
        });

        return () => {
            socket.disconnect();
        };
    }, [log]);

    const loadData = async () => {
        try {
            const [accData, vidData] = await Promise.all([
                apiFetch('/api/automation/youtube/channels'),
                apiFetch('/api/media/videos')
            ]);
            setAccounts(accData || []);
            setVideos(vidData || []);
        } catch (err) {
            log('Gagal memuat data awal', 'error');
        }
    };

    const runMasterAutomation = async () => {
        if (accounts.length === 0) return alert('Hubungkan minimal satu akun YouTube dulu!');
        if (videos.length === 0) return alert('Unggah video ke Media Manager dulu!');

        setIsRunning(true);
        log('🚀 MEMULAI ULTIMATE MASS DEPLOYMENT...', 'success');

        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            try {
                const acc = accounts[Math.floor(Math.random() * accounts.length)];
                log(`🎯 Misi #${i+1}: Channel [${acc.channel_name}]`, 'info');

                log(`🤖 Menyiapkan AI SEO & Thumb untuk ${video.title}...`);
                await apiFetch('/api/automation/seo', { method: 'POST', body: JSON.stringify({ videoId: video.id }) });
                await apiFetch('/api/automation/thumbnail', { method: 'POST', body: JSON.stringify({ videoId: video.id }) });

                const stream = await apiFetch('/api/streams', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: `🔥 AUTO-LIVE: ${video.title}`,
                        playlist_path: video.id,
                        youtube_account_id: acc.id,
                        platform: 'YOUTUBE'
                    })
                });

                const nodes = await apiFetch('/api/nodes');
                const bestNode = nodes.sort((a: any, b: any) => a.load - b.load)[0];
                
                log(`🚀 Deploying ke Node: ${bestNode.name}...`);
                await apiFetch(`${bestNode.url}/api/streams/${stream.id}/start`, { method: 'POST' });

                log(`✅ BERHASIL: ${video.title} LIVE di ${acc.channel_name}`, 'success');

                const delayMs = Math.floor(Math.random() * 60000) + 30000;
                log(`⏳ Proteksi Anti-Ban: Menunggu ${Math.floor(delayMs/1000)} detik...`);
                await new Promise(r => setTimeout(r, delayMs));

            } catch (err: any) {
                log(`❌ GAGAL: ${video.title} - ${err.message}`, 'error');
            }
        }

        setIsRunning(false);
        log('🏁 SEMUA MISI SELESAI.', 'success');
    };

    return (
        <div className="ultimate-container">
            <div className="ultimate-header">
                <div>
                    <h1>🚀 Ultimate Automation</h1>
                    <div className="subtitle">Auto stream • rotation • failover</div>
                </div>

                <button
                    className={`btn-master-launch ${isRunning ? 'running' : ''}`}
                    onClick={runMasterAutomation}
                    disabled={isRunning}
                >
                    {isRunning ? '🛑 STOP SYSTEM' : '🚀 START SYSTEM'}
                </button>
            </div>

            <div className="ultimate-stats-row">
                <Stat label="CHANNELS" value={accounts.length} color="blue" />
                <Stat label="VIDEOS" value={videos.length} color="green" />
                <Stat label="STATUS" value={isRunning ? 'RUNNING' : 'IDLE'} color={isRunning ? 'green' : 'red'} />
            </div>

            <div className="ultimate-main-grid">
                <div className="u-config-panel">
                    <div className="u-panel-header">
                        <h3>📺 Channels</h3>
                        <button className="btn-refresh" onClick={loadData}>⟳</button>
                    </div>

                    <div className="u-scroll-list">
                        {accounts.map(acc => (
                            <div key={acc.id} className="u-item-card acc">
                                <img src={acc.channel_thumbnail} className="u-acc-thumb" alt="thumb" />
                                <div className="u-item-title">{acc.channel_name}</div>
                                <div className={`u-item-tag active`}>
                                    ACTIVE
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="u-panel-header" style={{ marginTop: 20 }}>
                        <h3>🎬 Playlist Pool</h3>
                    </div>

                    <div className="u-scroll-list">
                        {videos.map(v => (
                            <div key={v.id} className="u-item-card">
                                <div className="u-item-dot"></div>
                                <div className="u-item-title">{v.title}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="u-log-panel">
                    <div className="u-panel-header">
                        <h3>📡 System Logs</h3>
                        <button className="btn-refresh" onClick={() => setLogs([])}>⟳</button>
                    </div>

                    <div className="u-log-screen">
                        {logs.length === 0 ? (
                            <div className="u-empty-logs">No activity yet...</div>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className={`u-log-line ${log.type}`}>
                                    {log.message}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const Stat = ({ label, value, color }: any) => (
    <div className={`u-stat-card ${color}`}>
        <span className="label">{label}</span>
        <div className="value">{value}</div>
    </div>
);
