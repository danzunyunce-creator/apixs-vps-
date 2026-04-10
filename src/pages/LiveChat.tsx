import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, ArrowLeft, RefreshCw, User, ShieldCheck } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import './ModuleCommon.css';

interface ChatMessage {
    id: string;
    author: string;
    profile: string;
    message: string;
    isChatOwner: boolean;
    publishedAt: string;
}

interface LiveChatProps {
    streamId: string;
    onBack: () => void;
}

export default function LiveChat({ streamId, onBack }: LiveChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [liveChatId, setLiveChatId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [polling, setPolling] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchChat();
        const interval = setInterval(fetchChat, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [streamId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchChat = async () => {
        setPolling(true);
        try {
            const res = await apiFetch(`/api/streams/live-chat/${streamId}`);
            if (res.messages) {
                // Prevent duplicate messages
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const newMsgs = res.messages.filter((m: any) => !existingIds.has(m.id));
                    return [...prev, ...newMsgs];
                });
                setLiveChatId(res.liveChatId);
            }
        } catch (err: any) {
            console.error('Chat fetch error:', err);
        } finally {
            setLoading(false);
            setPolling(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reply.trim() || sending || !liveChatId) return;

        setSending(true);
        try {
            await apiFetch(`/api/streams/live-chat/${streamId}/message`, {
                method: 'POST',
                body: JSON.stringify({ message: reply, liveChatId })
            });
            toast.success('Pesan terkirim!');
            setReply('');
            fetchChat(); // Instant refresh
        } catch (err: any) {
            toast.error('Gagal mengirim pesan: ' + err.message);
        } finally {
            setSending(false);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', flexDirection: 'column', gap: '20px' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                <RefreshCw size={40} color="#6366f1" />
            </motion.div>
            <p style={{ color: 'var(--text-dim)' }}>Menghubungkan ke YouTube Live Chat...</p>
        </div>
    );

    return (
        <div className="analytics-container" style={{ maxWidth: '800px', margin: '0 auto', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <Toaster position="top-right" />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button className="btn-icon" onClick={onBack} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <MessageCircle size={20} color="#6366f1" /> LIVE CHAT HUB
                        </h2>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dim)' }}>Stream ID: {streamId} {polling && <span style={{ color: '#6366f1', fontSize: '0.7rem' }}>• Syncing...</span>}</p>
                    </div>
                </div>
            </div>

            {/* CHAT VIEWPORT */}
            <div 
                ref={scrollRef}
                className="glass-card-pro" 
                style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '20px', 
                    marginBottom: '20px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    background: 'rgba(15, 23, 42, 0.4)'
                }}
            >
                {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-dim)' }}>
                        <MessageCircle size={40} style={{ opacity: 0.1, marginBottom: '10px' }} />
                        <p>Belum ada pesan terdeteksi.</p>
                    </div>
                ) : (
                    messages.map((m) => (
                        <motion.div 
                            key={m.id} 
                            initial={{ opacity: 0, x: -10 }} 
                            animate={{ opacity: 1, x: 0 }}
                            style={{ 
                                display: 'flex', 
                                gap: '12px', 
                                alignItems: 'flex-start',
                                padding: '10px',
                                borderRadius: '12px',
                                background: m.isChatOwner ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                borderLeft: m.isChatOwner ? '3px solid #6366f1' : 'none'
                            }}
                        >
                            <img src={m.profile} alt={m.author} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: m.isChatOwner ? '#6366f1' : '#f8fafc' }}>
                                        {m.author}
                                    </span>
                                    {m.isChatOwner && <ShieldCheck size={12} color="#6366f1" />}
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                        {new Date(m.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                                    {m.message}
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* INPUT AREA */}
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <input 
                    type="text" 
                    placeholder="Tulis balasan publik..." 
                    className="pro-input"
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    disabled={sending}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.2)' }}
                />
                <button 
                    type="submit" 
                    className="neon-btn" 
                    disabled={sending || !reply.trim()}
                    style={{ padding: '0 20px', height: '45px', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                    {sending ? <RefreshCw className="spin" size={18} /> : <Send size={18} />}
                    KIRIM
                </button>
            </form>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .pro-input {
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    padding: 12px 16px;
                    color: white;
                    font-size: 0.9rem;
                    outline: none;
                    transition: 0.2s;
                }
                .pro-input:focus { border-color: #6366f1; }
            `}</style>
        </div>
    );
}
