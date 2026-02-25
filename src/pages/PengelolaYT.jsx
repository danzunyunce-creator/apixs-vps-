import { useState, useEffect } from 'react';
import './PengelolaYT.css';

/* ─── Mock Data ──────────────────────────────────────────────── */
const CHANNELS_DATA = [
    { id: 1, name: 'Cocina Deliciosa', avatar: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=80&h=80&fit=crop', subs: 383363, views: 2158670, videos: 245, watchHrs: 12400, revenue: 4520, growth: 12.4 },
    { id: 2, name: 'Tech Insider UK', avatar: 'https://images.unsplash.com/photo-1542393545-10f5cde2c810?w=80&h=80&fit=crop', subs: 497949, views: 12450000, videos: 1024, watchHrs: 45000, revenue: 12800, growth: 8.2 },
    { id: 3, name: 'Musica Italiana', avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80&h=80&fit=crop', subs: 452520, views: 980000, videos: 186, watchHrs: 8000, revenue: 2100, growth: -3.1 },
];

const VIDEOS_LIST = [
    { id: 1, title: 'Live Cooking Pasta Carbonara — 24 Feb 2026', thumb: '🍝', views: 12400, likes: 890, comments: 156, duration: '2:45:00', published: '24 Feb 2026', status: 'public' },
    { id: 2, title: 'Tutorial Dessert Italia — Tiramisu Klasik', thumb: '🍰', views: 8900, likes: 720, comments: 98, duration: '1:30:00', published: '22 Feb 2026', status: 'public' },
    { id: 3, title: 'Live Q&A with Chef Marco', thumb: '👨‍🍳', views: 5600, likes: 445, comments: 210, duration: '3:00:00', published: '20 Feb 2026', status: 'public' },
    { id: 4, title: 'Behind The Scenes — Kitchen Setup Tour', thumb: '🎬', views: 3200, likes: 280, comments: 45, duration: '0:15:30', published: '18 Feb 2026', status: 'unlisted' },
    { id: 5, title: '[DRAFT] Menu Masakan Nusantara Ep.1', thumb: '📝', views: 0, likes: 0, comments: 0, duration: '0:45:00', published: 'Draft', status: 'draft' },
    { id: 6, title: 'Valentine\'s Day Special — Romantic Dinner', thumb: '💝', views: 18500, likes: 1400, comments: 320, duration: '2:00:00', published: '14 Feb 2026', status: 'public' },
];

const COMMENTS_DATA = [
    { id: 1, user: 'Maria Garcia', avatar: '👩', time: '2 jam lalu', text: 'Resepnya luar biasa! Saya sudah coba dan hasilnya sempurna 🎉', likes: 24, video: 'Live Cooking Pasta', status: 'approved' },
    { id: 2, user: 'TrollBot420', avatar: '🤖', time: '3 jam lalu', text: 'Check out my channel for FREE SUBS!!! bit.ly/spam123', likes: 0, video: 'Live Cooking Pasta', status: 'spam' },
    { id: 3, user: 'Chef Andi', avatar: '👨‍🍳', time: '5 jam lalu', text: 'Teknik memasaknya sangat baik, terutama di bagian saus. Kolaborasi yuk!', likes: 15, video: 'Tutorial Dessert', status: 'approved' },
    { id: 4, user: 'FoodLover88', avatar: '🍕', time: '8 jam lalu', text: 'Apakah bisa pakai keju mozzarella biasa?', likes: 8, video: 'Live Q&A', status: 'pending' },
    { id: 5, user: 'Random User', avatar: '😈', time: '12 jam lalu', text: 'This is totally garbage content, worst Ive ever seen', likes: 0, video: 'Valentine Special', status: 'spam' },
    { id: 6, user: 'Nadia S.', avatar: '👩‍🍳', time: '1 hari lalu', text: 'Terima kasih sudah berbagi resep ini! Keluarga saya sangat suka ❤️', likes: 42, video: 'Valentine Special', status: 'approved' },
];

const fmtNum = (n) => {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
};

/* ─── Components ──────────────────────────────────────────────── */
const MetricCard = ({ icon, value, label, change }) => (
    <div className="py-metric-card">
        <div className="py-metric-icon">{icon}</div>
        <div className="py-metric-value">{value}</div>
        <div className="py-metric-label">{label}</div>
        {change !== undefined && (
            <div className={`py-metric-change ${change >= 0 ? 'change-up' : 'change-down'}`}>
                {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
            </div>
        )}
    </div>
);

/* ─── Main Component ──────────────────────────────────────────── */
export default function PengelolaYT() {
    const [activeTab, setActiveTab] = useState('overview');
    const [activeChannel, setActiveChannel] = useState(CHANNELS_DATA[0]);
    const [videos, setVideos] = useState(VIDEOS_LIST);
    const [comments, setComments] = useState(COMMENTS_DATA);
    const [commentFilter, setCommentFilter] = useState('all');
    const [videoFilter, setVideoFilter] = useState('all');
    const [searchVideo, setSearchVideo] = useState('');

    const totalSubs = CHANNELS_DATA.reduce((s, c) => s + c.subs, 0);
    const totalViews = CHANNELS_DATA.reduce((s, c) => s + c.views, 0);
    const totalRevenue = CHANNELS_DATA.reduce((s, c) => s + c.revenue, 0);

    const filteredVideos = videos
        .filter(v => videoFilter === 'all' || v.status === videoFilter)
        .filter(v => v.title.toLowerCase().includes(searchVideo.toLowerCase()));

    const filteredComments = comments.filter(c => commentFilter === 'all' || c.status === commentFilter);

    const approveComment = (id) => setComments(prev => prev.map(c => c.id === id ? { ...c, status: 'approved' } : c));
    const deleteComment = (id) => setComments(prev => prev.filter(c => c.id !== id));
    const deleteVideo = (id) => setVideos(prev => prev.filter(v => v.id !== id));

    const TABS = [
        { key: 'overview', label: '📊 Overview', },
        { key: 'videos', label: '🎬 Video', },
        { key: 'comments', label: '💬 Komentar', },
        { key: 'monetization', label: '💰 Monetisasi', },
    ];

    /* ── Analytics chart bars (simulated) ── */
    const chartData = [
        { day: 'Sen', val: 2400 }, { day: 'Sel', val: 3100 }, { day: 'Rab', val: 2800 },
        { day: 'Kam', val: 4200 }, { day: 'Jum', val: 3800 }, { day: 'Sab', val: 5400 },
        { day: 'Min', val: 4800 },
    ];
    const maxChart = Math.max(...chartData.map(d => d.val));

    return (
        <div className="py-page">
            {/* ── Channel Selector ── */}
            <div className="py-channel-strip">
                {CHANNELS_DATA.map(ch => (
                    <button key={ch.id} className={`py-ch-card ${activeChannel.id === ch.id ? 'ch-selected' : ''}`} onClick={() => setActiveChannel(ch)}>
                        <img src={ch.avatar} alt={ch.name} className="py-ch-avatar" />
                        <div className="py-ch-info">
                            <div className="py-ch-name">{ch.name}</div>
                            <div className="py-ch-subs">{fmtNum(ch.subs)} subscribers</div>
                        </div>
                        <div className={`py-ch-growth ${ch.growth >= 0 ? 'growth-up' : 'growth-down'}`}>
                            {ch.growth >= 0 ? '↑' : '↓'} {Math.abs(ch.growth)}%
                        </div>
                    </button>
                ))}
            </div>

            {/* ── Tab Navigation ── */}
            <div className="py-tab-bar">
                {TABS.map(t => (
                    <button key={t.key} className={`py-tab ${activeTab === t.key ? 'py-tab-active' : ''}`} onClick={() => setActiveTab(t.key)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ════ OVERVIEW ════ */}
            {activeTab === 'overview' && (
                <div className="py-overview">
                    <div className="py-metrics-row">
                        <MetricCard icon="👥" value={fmtNum(activeChannel.subs)} label="Subscriber" change={activeChannel.growth} />
                        <MetricCard icon="👁️" value={fmtNum(activeChannel.views)} label="Total Views" change={5.3} />
                        <MetricCard icon="🎬" value={activeChannel.videos} label="Total Video" />
                        <MetricCard icon="⏱️" value={fmtNum(activeChannel.watchHrs)} label="Watch Hours" change={2.1} />
                        <MetricCard icon="💰" value={`$${fmtNum(activeChannel.revenue)}`} label="Revenue (Est)" change={15.2} />
                    </div>

                    <div className="py-overview-grid">
                        {/* Weekly Views Chart */}
                        <div className="py-chart-card">
                            <div className="py-card-title">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00b87c" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                                Views Mingguan
                            </div>
                            <div className="py-bar-chart">
                                {chartData.map((d, i) => (
                                    <div key={i} className="py-bar-col">
                                        <div className="py-bar-wrapper">
                                            <div className="py-bar" style={{ height: `${(d.val / maxChart) * 100}%` }}>
                                                <span className="py-bar-val">{fmtNum(d.val)}</span>
                                            </div>
                                        </div>
                                        <span className="py-bar-label">{d.day}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Videos */}
                        <div className="py-top-videos-card">
                            <div className="py-card-title">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2172e5" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                                Video Terpopuler
                            </div>
                            <div className="py-top-list">
                                {videos.filter(v => v.status === 'public').sort((a, b) => b.views - a.views).slice(0, 4).map((v, i) => (
                                    <div key={v.id} className="py-top-item">
                                        <span className="py-top-rank">#{i + 1}</span>
                                        <span className="py-top-thumb">{v.thumb}</span>
                                        <div className="py-top-info">
                                            <div className="py-top-title">{v.title}</div>
                                            <div className="py-top-stats">{fmtNum(v.views)} views · {fmtNum(v.likes)} likes</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ VIDEOS ════ */}
            {activeTab === 'videos' && (
                <div className="py-videos-section">
                    <div className="py-videos-toolbar">
                        <div className="py-video-filters">
                            {[
                                { key: 'all', label: 'Semua' },
                                { key: 'public', label: '🌐 Public' },
                                { key: 'unlisted', label: '🔗 Unlisted' },
                                { key: 'draft', label: '📝 Draft' },
                            ].map(f => (
                                <button key={f.key} className={`py-vf-btn ${videoFilter === f.key ? 'py-vf-active' : ''}`} onClick={() => setVideoFilter(f.key)}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                        <div className="py-search-wrap">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" placeholder="Cari video..." value={searchVideo} onChange={(e) => setSearchVideo(e.target.value)} />
                        </div>
                    </div>

                    <div className="py-video-grid">
                        {filteredVideos.map(v => (
                            <div key={v.id} className="py-video-card">
                                <div className="py-video-thumb">
                                    <span className="py-thumb-emoji">{v.thumb}</span>
                                    <span className="py-video-duration">{v.duration}</span>
                                    <span className={`py-video-status status-${v.status}`}>{v.status}</span>
                                </div>
                                <div className="py-video-body">
                                    <div className="py-video-title">{v.title}</div>
                                    <div className="py-video-meta">
                                        <span>{v.published}</span>
                                        <span>{fmtNum(v.views)} views</span>
                                    </div>
                                    <div className="py-video-stats-row">
                                        <span>👍 {fmtNum(v.likes)}</span>
                                        <span>💬 {v.comments}</span>
                                    </div>
                                </div>
                                <button className="py-video-delete" onClick={() => deleteVideo(v.id)} title="Hapus video">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                                </button>
                            </div>
                        ))}
                        {filteredVideos.length === 0 && <div className="py-empty">Tidak ada video ditemukan</div>}
                    </div>
                </div>
            )}

            {/* ════ COMMENTS ════ */}
            {activeTab === 'comments' && (
                <div className="py-comments-section">
                    <div className="py-comments-toolbar">
                        {[
                            { key: 'all', label: `Semua (${comments.length})` },
                            { key: 'pending', label: `⏳ Pending (${comments.filter(c => c.status === 'pending').length})` },
                            { key: 'approved', label: `✅ Approved (${comments.filter(c => c.status === 'approved').length})` },
                            { key: 'spam', label: `🚫 Spam (${comments.filter(c => c.status === 'spam').length})` },
                        ].map(f => (
                            <button key={f.key} className={`py-cf-btn ${commentFilter === f.key ? 'py-cf-active' : ''}`} onClick={() => setCommentFilter(f.key)}>
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="py-comment-list">
                        {filteredComments.map(c => (
                            <div key={c.id} className={`py-comment-card comment-${c.status}`}>
                                <div className="comment-avatar">{c.avatar}</div>
                                <div className="comment-body">
                                    <div className="comment-header">
                                        <span className="comment-user">{c.user}</span>
                                        <span className="comment-time">{c.time}</span>
                                        <span className={`comment-status-badge cs-${c.status}`}>{c.status}</span>
                                    </div>
                                    <div className="comment-text">{c.text}</div>
                                    <div className="comment-footer">
                                        <span className="comment-video">📺 {c.video}</span>
                                        <span className="comment-likes">👍 {c.likes}</span>
                                    </div>
                                </div>
                                <div className="comment-actions">
                                    {c.status !== 'approved' && (
                                        <button className="ca-approve" onClick={() => approveComment(c.id)} title="Approve">✓</button>
                                    )}
                                    <button className="ca-delete" onClick={() => deleteComment(c.id)} title="Hapus">✕</button>
                                </div>
                            </div>
                        ))}
                        {filteredComments.length === 0 && <div className="py-empty">Tidak ada komentar</div>}
                    </div>
                </div>
            )}

            {/* ════ MONETIZATION ════ */}
            {activeTab === 'monetization' && (
                <div className="py-monetization">
                    <div className="py-money-summary">
                        <div className="py-money-card py-mc-total">
                            <div className="py-mc-label">Total Estimasi Revenue</div>
                            <div className="py-mc-value">${fmtNum(totalRevenue)}</div>
                            <div className="py-mc-sub">dari {CHANNELS_DATA.length} channel</div>
                        </div>
                        <div className="py-money-card">
                            <div className="py-mc-label">RPM (Revenue per 1K Views)</div>
                            <div className="py-mc-value">${(totalRevenue / (totalViews / 1000)).toFixed(2)}</div>
                            <div className="py-mc-sub">rata-rata semua channel</div>
                        </div>
                        <div className="py-money-card">
                            <div className="py-mc-label">Total Subscriber</div>
                            <div className="py-mc-value">{fmtNum(totalSubs)}</div>
                            <div className="py-mc-sub">gabungan</div>
                        </div>
                    </div>

                    <div className="py-revenue-table">
                        <div className="py-card-title" style={{ padding: '16px 20px', borderBottom: '1px solid #212631' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                            Revenue per Channel
                        </div>
                        <table className="py-table">
                            <thead>
                                <tr>
                                    <th>Channel</th>
                                    <th className="right-col">Subscriber</th>
                                    <th className="right-col">Views</th>
                                    <th className="right-col">Watch Hrs</th>
                                    <th className="right-col">Revenue</th>
                                    <th className="right-col">Growth</th>
                                </tr>
                            </thead>
                            <tbody>
                                {CHANNELS_DATA.map(ch => (
                                    <tr key={ch.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <img src={ch.avatar} alt={ch.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                                <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{ch.name}</span>
                                            </div>
                                        </td>
                                        <td className="right-col">{fmtNum(ch.subs)}</td>
                                        <td className="right-col">{fmtNum(ch.views)}</td>
                                        <td className="right-col">{fmtNum(ch.watchHrs)}</td>
                                        <td className="right-col" style={{ color: '#00b87c', fontWeight: 800 }}>${fmtNum(ch.revenue)}</td>
                                        <td className="right-col">
                                            <span className={ch.growth >= 0 ? 'growth-up' : 'growth-down'}>
                                                {ch.growth >= 0 ? '↑' : '↓'} {Math.abs(ch.growth)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
