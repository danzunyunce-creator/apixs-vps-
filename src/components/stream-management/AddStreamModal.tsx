import React, { useState, useMemo } from 'react';
import { Video } from '../../types';

interface AddStreamModalProps {
    show: boolean;
    onClose: () => void;
    onSubmit: () => void;
    newStream: {
        id: string;
        title: string;
        platform: string;
        rtmp_url: string;
        stream_key: string;
        playlist_path: string;
        description?: string;
        tags?: string;
        auto_restart?: boolean;
        ai_tone?: string;
        destinations: any[];
    };
    setNewStream: React.Dispatch<React.SetStateAction<any>>;
    allVideos: Video[];
    aiLoading: boolean;
    onGenerateAI: (tone: string) => void;
    onAddDest: () => void;
    onUpdateDest: (index: number, field: string, val: string) => void;
    onRemoveDest: (index: number) => void;
    loading: boolean;
}

export const AddStreamModal: React.FC<AddStreamModalProps> = ({
    show, onClose, onSubmit, newStream, setNewStream, allVideos, aiLoading, onGenerateAI, onAddDest, onUpdateDest, onRemoveDest, loading
}) => {
    const [videoSearch, setVideoSearch] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectedTone, setSelectedTone] = useState(newStream.ai_tone || 'viral');

    const filteredVideos = useMemo(() => {
        if (!videoSearch) return allVideos;
        const q = videoSearch.toLowerCase();
        return allVideos.filter(v => 
            (v.title || v.name || '').toLowerCase().includes(q) || 
            (v.filepath || '').toLowerCase().includes(q)
        );
    }, [allVideos, videoSearch]);

    if (!show) return null;

    return (
        <div className="glass-modal-overlay">
            <div className="glass-modal large">
                <div className="modal-header">
                    <h2>{newStream.id ? '📝 Edit Stream' : '➕ Create New Stream'}</h2>
                    <button className="btn-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            Stream Title
                            <div className="ai-controls" style={{ display: 'flex', gap: '8px' }}>
                                <select 
                                    className="tone-select"
                                    value={selectedTone}
                                    onChange={e => {
                                        const t = e.target.value;
                                        setSelectedTone(t);
                                        setNewStream({ ...newStream, ai_tone: t });
                                    }}
                                    style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid #334155' }}
                                >
                                    <option value="viral">🔥 Viral</option>
                                    <option value="professional">💼 Professional</option>
                                    <option value="clickbait">🎣 Clickbait</option>
                                    <option value="educational">🎓 Educational</option>
                                </select>
                                <button 
                                    className={`btn-ai-magic ${aiLoading ? 'loading' : ''}`}
                                    onClick={() => onGenerateAI(selectedTone)}
                                    disabled={aiLoading}
                                >
                                    {aiLoading ? '🪄 Thinking...' : '🪄 AI Magic'}
                                </button>
                            </div>
                        </label>
                        <input 
                            type="text" 
                            placeholder="Contoh: Live Streaming 24 Jam" 
                            value={newStream.title}
                            onChange={e => setNewStream({ ...newStream, title: e.target.value })}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Platform</label>
                            <select 
                                value={newStream.platform}
                                onChange={e => {
                                    const p = e.target.value;
                                    let url = '';
                                    if (p === 'YOUTUBE') url = 'rtmp://a.rtmp.youtube.com/live2';
                                    else if (p === 'FACEBOOK') url = 'rtmps://live-api-s.facebook.com:443/rtmp/';
                                    else if (p === 'TIKTOK') url = 'rtmp://open-rtmp.tiktok.com/stage/';
                                    setNewStream({ ...newStream, platform: p, rtmp_url: url });
                                }}
                            >
                                <option value="YOUTUBE">YouTube</option>
                                <option value="FACEBOOK">Facebook Pro</option>
                                <option value="TIKTOK">TikTok</option>
                                <option value="CUSTOM">Custom RTMP</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Video Source</label>
                            <div className="searchable-select">
                                <input 
                                    type="text" 
                                    placeholder="Search video..." 
                                    className="select-search-input"
                                    value={videoSearch}
                                    onChange={e => setVideoSearch(e.target.value)}
                                />
                                <select 
                                    value={newStream.playlist_path}
                                    onChange={e => setNewStream({ ...newStream, playlist_path: e.target.value })}
                                >
                                    <option value="">-- Pilih Video ({filteredVideos.length}) --</option>
                                    {filteredVideos.map(v => (
                                        <option key={v.id} value={v.filepath}>{v.title || v.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                             <input 
                                type="checkbox" 
                                id="auto_restart_chk"
                                checked={newStream.auto_restart !== false}
                                onChange={e => setNewStream({ ...newStream, auto_restart: e.target.checked })}
                                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                             />
                             <label htmlFor="auto_restart_chk" style={{ marginBottom: 0, cursor: 'pointer' }}>
                                 🔄 Auto-Restart on Crash (Watchdog)
                             </label>
                        </div>
                    </div>

                    {/* AI ADVANCED METADATA */}
                    <div className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
                        <span>{showAdvanced ? '🔽 Hide' : '▶️ Show'} Advanced AI Metadata (Description & Tags)</span>
                    </div>

                    {showAdvanced && (
                        <div className="advanced-fields animate-fade-in">
                            <div className="form-group">
                                <label>AI Description</label>
                                <textarea 
                                    rows={4}
                                    placeholder="Deskripsi viral untuk YouTube..."
                                    value={newStream.description || ''}
                                    onChange={e => setNewStream({ ...newStream, description: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Tags / Hashtags</label>
                                <input 
                                    type="text" 
                                    placeholder="#Live #Stream #24jam" 
                                    value={newStream.tags || ''}
                                    onChange={e => setNewStream({ ...newStream, tags: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    <div className="form-row">
                         <div className="form-group">
                            <label>Server RTMP URL</label>
                            <input 
                                type="text" 
                                placeholder="rtmp://..." 
                                value={newStream.rtmp_url}
                                onChange={e => setNewStream({ ...newStream, rtmp_url: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label>Primary Stream Key</label>
                            <input 
                                type="password" 
                                placeholder="Key siaran..." 
                                value={newStream.stream_key}
                                onChange={e => setNewStream({ ...newStream, stream_key: e.target.value })}
                            />
                        </div>
                    </div>

                    <hr className="modal-divider" />

                    <div className="destinations-manager">
                        <div className="dest-header">
                            <h3>🚀 Multi-Platform Simulcast</h3>
                            <button className="btn-add-dest" onClick={onAddDest}>+ Add Platform</button>
                        </div>
                        
                        {newStream.destinations.map((d: any, i: number) => (
                            <div key={i} className="dest-item-row">
                                <div className="dest-inputs">
                                    <input 
                                        type="text" 
                                        placeholder="Nama" 
                                        value={d.name} 
                                        onChange={e => onUpdateDest(i, 'name', e.target.value)} 
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="RTMP URL" 
                                        value={d.rtmp_url} 
                                        onChange={e => onUpdateDest(i, 'rtmp_url', e.target.value)} 
                                    />
                                    <input 
                                        type="password" 
                                        placeholder="Key" 
                                        value={d.stream_key} 
                                        onChange={e => onUpdateDest(i, 'stream_key', e.target.value)} 
                                    />
                                </div>
                                <button className="btn-remove-dest" onClick={() => onRemoveDest(i)}>×</button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn-cancel" onClick={onClose}>Batal</button>
                    <button className="btn-submit" onClick={onSubmit} disabled={loading}>
                        {loading ? 'Menyimpan...' : 'Create & Save Channel'}
                    </button>
                </div>
            </div>
        </div>
    );
};
