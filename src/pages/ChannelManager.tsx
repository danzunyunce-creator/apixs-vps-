import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import toast, { Toaster } from 'react-hot-toast';
import './ChannelManager.css';

interface YTChannel {
    id: string;
    channel_name: string;
    channel_thumbnail: string;
    subscriber_count: string;
    status: string;
    last_used?: string;
}

export default function ChannelManager() {
    const [channels, setChannels] = useState<YTChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [isConfigured, setIsConfigured] = useState(true);

    useEffect(() => {
        loadChannels();
        const interval = setInterval(loadChannels, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadChannels = async () => {
        try {
            const [chData, cfgData] = await Promise.all([
                apiFetch('/api/automation/youtube/channels'),
                apiFetch('/api/config')
            ]);
            setChannels(chData);
            
            if (!cfgData.yt_client_id || !cfgData.yt_client_secret) {
                setIsConfigured(false);
            } else {
                setIsConfigured(true);
            }
        } catch (err) {
            console.error('Failed to load data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddAccount = async () => {
        try {
            const { url } = await apiFetch('/api/automation/youtube/auth-url');
            // Open popup
            const width = 600, height = 700;
            const left = (window.innerWidth / 2) - (width / 2);
            const top = (window.innerHeight / 2) - (height / 2);
            const popup = window.open(url, 'YouTubeAuth', `width=${width},height=${height},left=${left},top=${top}`);
            
            // Check for popup close
            const checkPopup = setInterval(() => {
                if (popup?.closed) {
                    clearInterval(checkPopup);
                    loadChannels();
                }
            }, 1000);
        } catch (err: any) {
            toast.error(err.message || 'Gagal mengambil URL Autentikasi');
        }
    };

    const deleteChannel = async (id: string) => {
        if (!confirm('Hapus koneksi channel ini?')) return;
        try {
            await apiFetch(`/api/automation/youtube/channels/${id}`, { method: 'DELETE' });
            loadChannels();
        } catch (err: any) {
            toast.error('Gagal menghapus channel: ' + err.message);
        }
    };

    return (
        <div className="channel-manager-container">
            <div className="cm-header">
                <div>
                    <h1>📺 YouTube Channels</h1>
                    <p className="subtitle">Kelola akun YouTube Anda untuk rotasi otomasi dan mass deployment.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <button className="btn-add-account" onClick={handleAddAccount}>
                        <span className="icon">➕</span> Hubungkan Akun Baru
                    </button>
                    {!isConfigured && (
                        <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(248,113,113,0.2)' }}>
                            ⚠️ API Client ID/Secret belum diatur di Pengaturan
                        </span>
                    )}
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <span className="sc-label">Total Channel</span>
                    <strong className="sc-value">{channels.length}</strong>
                </div>
                <div className="stat-card">
                    <span className="sc-label">Total Subs</span>
                    <strong className="sc-value">
                        {channels.reduce((sum, ch) => sum + parseInt(ch.subscriber_count.replace(/[^0-9]/g, '') || '0'), 0).toLocaleString()}
                    </strong>
                </div>
            </div>

            <div className="channel-grid">
                {loading ? (
                    <div className="cm-loader">Memuat daftar channel...</div>
                ) : channels.length === 0 ? (
                    <div className="empty-state">
                        <div className="es-icon">📽️</div>
                        <h3>Belum ada channel terhubung</h3>
                        <p>Klik tombol di atas untuk menghubungkan akun YouTube pertama Anda melalui Google OAuth.</p>
                    </div>
                ) : (
                    channels.map(ch => (
                        <div key={ch.id} className="channel-card">
                            <div className="cc-header">
                                <img src={ch.channel_thumbnail || 'https://via.placeholder.com/60'} alt={ch.channel_name} className="cc-thumb" />
                                <div className="cc-info">
                                    <h3 title={ch.channel_name}>{ch.channel_name}</h3>
                                    <span className="cc-subs">{parseInt(ch.subscriber_count).toLocaleString()} Subscribers</span>
                                </div>
                                <div className={`cc-status ${ch.status?.toLowerCase() || 'online'}`}>
                                    {ch.status || 'CONNECTED'}
                                </div>
                            </div>
                            <div className="cc-footer">
                                <div className="cc-meta">
                                    <span>Last used: {ch.last_used ? new Date(ch.last_used).toLocaleDateString() : 'Never'}</span>
                                </div>
                                <button className="btn-delete-ch" onClick={() => deleteChannel(ch.id)} title="Hapus Akun">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <Toaster position="bottom-right" />
        </div>
    );
}
