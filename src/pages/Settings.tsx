import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings as SettingsIcon, Globe, Play, Send, 
  Zap, Brain, Shield, Save, Download, Upload, Eye, EyeOff 
} from 'lucide-react';
import { apiFetch } from '../api';
import toast, { Toaster } from 'react-hot-toast';
import './ModuleCommon.css';

export default function Settings() {
    const [config, setConfig] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

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
            toast.success('System Configuration Synchronized');
        } catch (err) {
            toast.error('Failed to sync settings.');
        } finally {
            setSaving(false);
        }
    };

    const toggleKey = (key: string) => {
        setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                <SettingsIcon size={32} color="#6366f1" />
            </motion.div>
        </div>
    );

    const tabs = [
        { id: 'general', label: 'General', icon: <Globe size={18} /> },
        { id: 'youtube', label: 'YouTube API', icon: <Play size={18} /> },
        { id: 'telegram', label: 'Telegram Bot', icon: <Send size={18} /> },
        { id: 'automation', label: 'Automation', icon: <Zap size={18} /> },
        { id: 'ai', label: 'AI Engine', icon: <Brain size={18} /> },
        { id: 'advanced', label: 'System Core', icon: <Shield size={18} /> },
    ];

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}
        >
            <Toaster position="top-right" />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '15px' }}>
                         System Control
                    </h1>
                    <div className="sub-header">Configure the "Heart" of your broadcasting engine.</div>
                </div>
                <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="neon-btn" 
                    onClick={handleSave} 
                    disabled={saving}
                >
                    <Save size={18} /> {saving ? 'SYNCING...' : 'SAVE CHANGES'}
                </motion.button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '30px', alignItems: 'start' }}>
                {/* ELITE SIDEBAR */}
                <aside className="glass-card-pro" style={{ padding: '10px' }}>
                    {tabs.map(tab => (
                        <motion.div
                            key={tab.id}
                            className={`s-nav-item-elite ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                            whileHover={{ x: 5 }}
                            style={{ 
                                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', 
                                borderRadius: '12px', cursor: 'pointer', color: activeTab === tab.id ? 'white' : '#64748b',
                                background: activeTab === tab.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                transition: '0.2s'
                            }}
                        >
                            <span style={{ color: activeTab === tab.id ? '#6366f1' : 'inherit' }}>{tab.icon}</span>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{tab.label}</span>
                        </motion.div>
                    ))}
                    
                    <div style={{ marginTop: '20px', padding: '15px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', color: '#475569' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>CORE VERSION</span>
                            <span style={{ color: '#6366f1' }}>2.5.0-ELITE</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>HEALTH</span>
                            <span style={{ color: '#10b981' }}>OPTIMAL</span>
                        </div>
                    </div>
                </aside>

                {/* DYNAMIC CONTENT AREA */}
                <main style={{ minHeight: '600px' }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="glass-card-pro"
                        >
                            {activeTab === 'general' && (
                                <Section title="Global Identity" sub="Manage how Apixs appears across your ecosystem.">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div className="field">
                                            <label>Console Name</label>
                                            <input className="pro-input" type="text" value={config.site_name || ''} onChange={e => setConfig({...config, site_name: e.target.value})} />
                                        </div>
                                        <div className="field">
                                            <label>Primary Language</label>
                                            <select className="pro-input" value={config.language || 'id'} onChange={e => setConfig({...config, language: e.target.value})}>
                                                <option value="id">Bahasa Indonesia</option>
                                                <option value="en">English (Elite)</option>
                                            </select>
                                        </div>
                                    </div>
                                </Section>
                            )}

                            {activeTab === 'youtube' && (
                                <Section title="YouTube Credentials" sub="OAuth 2.0 and API keys for broadcast management.">
                                    <div className="field">
                                        <label>Primary Data API Key</label>
                                        <div style={{ position: 'relative' }}>
                                            <input 
                                                className="pro-input" 
                                                type={showKeys['yt_api'] ? 'text' : 'password'} 
                                                value={config.yt_api_key_1 || ''} 
                                                onChange={e => setConfig({...config, yt_api_key_1: e.target.value})} 
                                            />
                                            <button onClick={() => toggleKey('yt_api')} style={iconBtnStyle}>
                                                {showKeys['yt_api'] ? <EyeOff size={16}/> : <Eye size={16}/>}
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '15px' }}>
                                        <div className="field">
                                            <label>Client ID</label>
                                            <input className="pro-input" type="text" value={config.yt_client_id || ''} onChange={e => setConfig({...config, yt_client_id: e.target.value})} />
                                        </div>
                                        <div className="field">
                                            <label>Client Secret</label>
                                            <input className="pro-input" type="password" value={config.yt_client_secret || ''} onChange={e => setConfig({...config, yt_client_secret: e.target.value})} />
                                        </div>
                                    </div>
                                </Section>
                            )}

                            {activeTab === 'ai' && (
                                <Section title="AI Neural Engine" sub="Powering viral metadata with GPT-4o.">
                                    <div className="field">
                                        <label>OpenAI API Secret</label>
                                        <input className="pro-input" type="password" value={config.openai_api_key || ''} onChange={e => setConfig({...config, openai_api_key: e.target.value})} />
                                    </div>
                                    <div className="field" style={{ marginTop: '15px' }}>
                                        <label>Creative Tone</label>
                                        <select className="pro-input" value={config.ai_tone || 'viral'} onChange={e => setConfig({...config, ai_tone: e.target.value})}>
                                            <option value="formal">Formal & Corporate</option>
                                            <option value="viral">Viral & High-Energy</option>
                                            <option value="clickbait">Attention-Grabbing (CTR)</option>
                                        </select>
                                    </div>
                                </Section>
                            )}

                            {activeTab === 'advanced' && (
                                <Section title="Core Engineering" sub="Low-level system parameters and maintenance.">
                                    <div className="field">
                                        <label>Storage Base Path</label>
                                        <input className="pro-input" type="text" value={config.storage_path || ''} onChange={e => setConfig({...config, storage_path: e.target.value})} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                                        <button className="neon-btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <Download size={16} /> EXPORT CONFIG
                                        </button>
                                        <button className="neon-btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <Upload size={16} /> IMPORT DATA
                                        </button>
                                    </div>
                                </Section>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>

            <style>{`
                .pro-input {
                    width: 100%;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 12px 16px;
                    color: white;
                    font-size: 0.9rem;
                    transition: 0.2s;
                }
                .pro-input:focus {
                    outline: none;
                    border-color: #6366f1;
                    background: rgba(0, 0, 0, 0.3);
                    box-shadow: 0 0 15px rgba(99, 102, 241, 0.1);
                }
                .field label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #64748b;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
            `}</style>
        </motion.div>
    );
}

const Section = ({ title, sub, children }: any) => (
    <div>
        <h3 style={{ marginBottom: '5px' }}>{title}</h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '30px' }}>{sub}</p>
        {children}
    </div>
);

const iconBtnStyle: React.CSSProperties = {
    position: 'absolute',
    right: '12px',
    top: '10px',
    background: 'none',
    border: 'none',
    color: '#475569',
    cursor: 'pointer'
};
