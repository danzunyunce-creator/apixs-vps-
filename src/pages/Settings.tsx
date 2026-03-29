import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import toast, { Toaster } from 'react-hot-toast';
import './ModuleCommon.css';

export default function Settings() {
    const [config, setConfig] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const data = await apiFetch('/api/config');
            setConfig(data || {});
        } catch (err) {
            console.error('Load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiFetch('/api/config', {
                method: 'PUT',
                body: JSON.stringify(config)
            });
            toast.success('Pengaturan sistem berhasil diperbarui!');
        } catch (err) {
            toast.error('Gagal menyimpan pengaturan.');
        } finally {
            setSaving(false);
        }
    };

    const testNotify = async () => {
        const msg = prompt('Isi pesan ujicoba Telegram:', 'Testing Notifikasi ApixsLive ✨');
        if (!msg) return;
        try {
            await apiFetch('/api/notify/telegram', { method: 'POST', body: JSON.stringify({ message: msg }) });
            toast.success('Pesan uji coba berhasil dikirim!');
        } catch (e: any) {
            toast.error('Gagal: ' + (e.message || 'Cek bot token.'));
        }
    };

    const exportConfig = () => {
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `apixs-config-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    };

    const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                setConfig({ ...config, ...data });
                toast.success('Data konfigurasi diimpor (Klik Simpan untuk permanen).');
            } catch {
                toast.error('File tidak valid.');
            }
        };
        reader.readAsText(file);
    };

    if (loading) return (
        <div className="skeleton-container" style={{ padding: '20px' }}>
            <div className="skeleton" style={{ height: '40px', width: '200px', marginBottom: '20px' }}></div>
            <div className="settings-wrapper">
                <div className="skeleton" style={{ height: '300px', borderRadius: '12px' }}></div>
                <div className="skeleton" style={{ height: '500px', borderRadius: '12px' }}></div>
            </div>
        </div>
    );

    const tabs = [
        { id: 'general', label: '🌍 General', icon: '🌐' },
        { id: 'youtube', label: '📺 YouTube API', icon: '🔑' },
        { id: 'telegram', label: '🤖 Telegram Bot', icon: '📱' },
        { id: 'automation', label: '⚡ Automation', icon: '⚙️' },
        { id: 'ai', label: '🧠 AI Settings', icon: '🤖' },
        { id: 'advanced', label: '🛠️ Advanced', icon: '💾' },
    ];

    return (
        <div className="settings-page">
            <div className="header-row">
                <div className="header-left">
                     <h2>⚙️ SYSTEM SETTINGS</h2>
                     <p className="text-muted" style={{ fontSize: '12px' }}>Konfigurasi parameter inti platform ApixsLive</p>
                </div>
                <button 
                    className="btn-primary" 
                    onClick={handleSave} 
                    disabled={saving}
                    style={{ padding: '10px 24px', minWidth: '160px' }}
                >
                    {saving ? '⌛ MENYIMPAN...' : '💾 SIMPAN PERUBAHAN'}
                </button>
            </div>

            <div className="settings-wrapper">
                {/* Sidebar Navigation */}
                <aside className="settings-sidebar">
                    {tabs.map(tab => (
                        <button 
                            key={tab.id}
                            className={`s-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span>{tab.label}</span>
                        </button>
                    ))}
                    
                    <div style={{ marginTop: 'auto', padding: '20px 10px' }}>
                        <div className="card glass" style={{ padding: '12px', fontSize: '11px', opacity: 0.7 }}>
                            🚀 Version 2.1.0-PRO<br/>
                            🟢 System Healthy
                        </div>
                    </div>
                </aside>

                {/* Content Area */}
                <main className="settings-content">
                    {activeTab === 'general' && (
                        <section className="card glass-premium">
                             <h3>🌍 General Configuration</h3>
                             <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '15px' }}>
                                 <div className="field">
                                     <label>Site Name</label>
                                     <input type="text" value={config.site_name || 'ApixsLive'} onChange={e => setConfig({...config, site_name: e.target.value})} />
                                 </div>
                                 <div className="field">
                                     <label>Platform Language</label>
                                     <select value={config.language || 'id'} onChange={e => setConfig({...config, language: e.target.value})}>
                                         <option value="id">Bahasa Indonesia</option>
                                         <option value="en">English (US)</option>
                                     </select>
                                 </div>
                                 <div className="field" style={{ gridColumn: 'span 2' }}>
                                     <label>Custom Brand Logo URL</label>
                                     <input type="text" value={config.logo_url || ''} onChange={e => setConfig({...config, logo_url: e.target.value})} placeholder="https://..." />
                                 </div>
                             </div>
                        </section>
                    )}

                    {activeTab === 'youtube' && (
                        <section className="card glass-premium">
                            <h3>🔑 YouTube API Management</h3>
                            <p className="text-muted">Gunakan API Key dari Google Cloud Console untuk fitur Smart Meta.</p>
                            
                            <div className="field" style={{ marginTop: '15px' }}>
                                <label>Primary API Key (v3)</label>
                                <input type="password" value={config.yt_api_key_1 || ''} onChange={e => setConfig({...config, yt_api_key_1: e.target.value})} placeholder="AIza..." />
                            </div>
                            <div className="field">
                                <label>Secondary/Backup Key</label>
                                <input type="password" value={config.yt_api_key_2 || ''} onChange={e => setConfig({...config, yt_api_key_2: e.target.value})} />
                            </div>
                            <div className="field">
                                <label>YouTube OAuth Client ID 🆔</label>
                                <input type="text" value={config.yt_client_id || ''} onChange={e => setConfig({...config, yt_client_id: e.target.value})} placeholder="789...apps.googleusercontent.com" />
                            </div>
                            <div className="field">
                                <label>YouTube OAuth Client Secret 🤫</label>
                                <input type="password" value={config.yt_client_secret || ''} onChange={e => setConfig({...config, yt_client_secret: e.target.value})} />
                            </div>
                            <div className="field">
                                <label>OAuth Redirect URL (Read-only)</label>
                                <input type="text" value={config.app_redirect_url || ''} readOnly style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--accent-blue)' }} />
                            </div>
                        </section>
                    )}

                    {activeTab === 'telegram' && (
                        <section className="card glass-premium">
                            <h3>📱 Telegram Integration</h3>
                            <p className="text-muted">Kirim update status stream langsung ke bot/grup Telegram.</p>
                            
                            <div className="field" style={{ marginTop: '15px' }}>
                                <label>Bot Token 🤖</label>
                                <input type="password" value={config.telegram_bot_token || ''} onChange={e => setConfig({...config, telegram_bot_token: e.target.value})} />
                            </div>
                            <div className="field">
                                <label>Target Chat ID / Group ID 🆔</label>
                                <input type="text" value={config.telegram_chat_id || ''} onChange={e => setConfig({...config, telegram_chat_id: e.target.value})} />
                            </div>
                            <button onClick={testNotify} className="a-btn" style={{ padding: '10px 20px', background: 'rgba(0,136,204,0.1)', color: '#0088cc', borderColor: 'rgba(0,136,204,0.2)' }}>
                                🔔 KIRIM PESAN UJI COBA
                            </button>
                        </section>
                    )}

                    {activeTab === 'automation' && (
                        <section className="card glass-premium">
                            <h3>⚡ Automation & Streaming Engine</h3>
                            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '15px' }}>
                                <div className="field" style={{ gridColumn: 'span 2' }}>
                                    <label className="checkbox-label">
                                        <input type="checkbox" checked={config.auto_mode === 'true'} onChange={e => setConfig({...config, auto_mode: e.target.checked ? 'true' : 'false'})} />
                                        <span>Aktifkan Fitur Otomatisasi Global</span>
                                    </label>
                                </div>
                                <div className="field">
                                    <label>Task Check Interval (Menit)</label>
                                    <input type="number" value={config.interval || 30} onChange={e => setConfig({...config, interval: e.target.value})} />
                                </div>
                                <div className="field">
                                    <label>Default Streaming Bitrate</label>
                                    <select value={config.default_bitrate || '2500'} onChange={e => setConfig({...config, default_bitrate: e.target.value})}>
                                        <option value="1500">1500 Kbps (Lite)</option>
                                        <option value="2500">2500 Kbps (Standard)</option>
                                        <option value="4500">4500 Kbps (High)</option>
                                    </select>
                                </div>
                                <div className="field">
                                    <label className="checkbox-label">
                                        <input type="checkbox" checked={config.auto_restart === 'true'} onChange={e => setConfig({...config, auto_restart: e.target.checked ? 'true' : 'false'})} />
                                        <span>Auto Restart jika stream OFF</span>
                                    </label>
                                </div>
                                <div className="field">
                                    <label className="checkbox-label">
                                        <input type="checkbox" checked={config.fallback_video === 'true'} onChange={e => setConfig({...config, fallback_video: e.target.checked ? 'true' : 'false'})} />
                                        <span>Putar Fallback jika source error</span>
                                    </label>
                                </div>
                            </div>
                        </section>
                    )}

                    {activeTab === 'ai' && (
                        <section className="card glass-premium">
                            <h3>🧠 Smart AI Settings (GPT-4o)</h3>
                            <p className="text-muted">Konfigurasi otak AI untuk optimasi konten otomatis.</p>
                            
                            <div className="field" style={{ marginTop: '15px' }}>
                                <label>OpenAI API Key (GPT-4o) 🔑</label>
                                <input 
                                    type="password" 
                                    value={config.openai_api_key || ''} 
                                    onChange={e => setConfig({...config, openai_api_key: e.target.value})} 
                                    placeholder="sk-proj-..."
                                />
                                <small style={{ color: '#94a3b8' }}>Dapatkan di platform.openai.com. Pastikan saldo mencukupi.</small>
                            </div>

                            <div className="field">
                                <label>AI Writing Tone</label>
                                <select value={config.ai_tone || 'viral'} onChange={e => setConfig({...config, ai_tone: e.target.value})}>
                                    <option value="formal">Formal & Profesional</option>
                                    <option value="viral">Viral & Trending (Recommended)</option>
                                    <option value="clickbait">High Click-through Rate</option>
                                </select>
                            </div>

                            <div className="field">
                                <label>AI Prompt Template 🪄</label>
                                <textarea 
                                    style={{ height: '80px', padding: '10px' }}
                                    value={config.ai_prompt_template || ''} 
                                    onChange={e => setConfig({...config, ai_prompt_template: e.target.value})}
                                    placeholder="Buat judul viral, deskripsi SEO untuk: {title}"
                                />
                                <small style={{ color: '#94a3b8' }}>Gunakan tag {'{title}'} sebagai placeholder judul video master.</small>
                            </div>

                            <div className="field">
                                <label className="checkbox-label">
                                    <input type="checkbox" checked={config.auto_generate === 'true'} onChange={e => setConfig({...config, auto_generate: e.target.checked ? 'true' : 'false'})} />
                                    <span>Auto-generate Meta (Judul/Tags) dari AI</span>
                                </label>
                            </div>
                        </section>
                    )}

                    {activeTab === 'advanced' && (
                        <section className="card glass-premium">
                            <h3>🛠️ Advanced & Maintenance</h3>
                            <div className="field" style={{ marginTop: '15px' }}>
                                <label>Storage Library Path</label>
                                <input type="text" value={config.storage_path || 'backend/uploads'} onChange={e => setConfig({...config, storage_path: e.target.value})} />
                            </div>
                            
                            <div className="field">
                                <label>Global Bandwidth Limit (Mbps) ⚡</label>
                                <input 
                                    type="number" 
                                    value={config.bandwidth_limit_mbps || 100} 
                                    onChange={e => setConfig({...config, bandwidth_limit_mbps: e.target.value})} 
                                />
                                <small style={{ color: '#94a3b8' }}>Membatasi total bitrate seluruh stream aktif untuk menjaga stabilitas VPS.</small>
                            </div>
                            
                            <hr style={{ margin: '20px 0', opacity: 0.1 }} />
                            
                            <h4>💾 Backup & Transfer</h4>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button className="a-btn" onClick={exportConfig}>📤 EXPORT DATA (.JSON)</button>
                                <div className="file-input-wrapper">
                                    <label className="a-btn" style={{ cursor: 'pointer' }}>
                                        📥 IMPORT DATA
                                        <input type="file" accept=".json" onChange={importConfig} style={{ display: 'none' }} />
                                    </label>
                                </div>
                            </div>
                            
                            <div style={{ marginTop: '20px' }}>
                                <label className="checkbox-label">
                                    <input type="checkbox" checked={config.register_enabled === 'true'} onChange={e => setConfig({...config, register_enabled: e.target.checked ? 'true' : 'false'})} />
                                    <span>Izinkan Pendaftaran Akun Baru (Public Register)</span>
                                </label>
                            </div>
                        </section>
                    )}
                </main>
            </div>
            <Toaster position="bottom-right" />
        </div>
    );
}
