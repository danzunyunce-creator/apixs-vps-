import React, { useState, useCallback, useEffect, useRef } from 'react';
import './Login.css';

// SVG Icons
const UserIcon = () => (
    <div className="input-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    </div>
);

const LockIcon = () => (
    <div className="input-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    </div>
);

const EyeIcon = ({ show }: { show: boolean }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {show ? (
            <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
            </>
        ) : (
            <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
            </>
        )}
    </svg>
);

const ApixsBrandIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);

const CheckCircleIcon = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

const floatingParticlesData = Array.from({ length: 20 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: 15 + Math.random() * 20,
    delay: Math.random() * -20,
    size: 2 + Math.random() * 3,
    opacity: 0.15 + Math.random() * 0.3
}));

function FloatingParticles() {
    return (
        <div className="login-particles" aria-hidden="true">
            {floatingParticlesData.map((p, i) => (
                <div
                    key={i}
                    className="particle"
                    style={{
                        '--x': `${p.x}%`,
                        '--y': `${p.y}%`,
                        '--duration': `${p.duration}s`,
                        '--delay': `${p.delay}s`,
                        '--size': `${p.size}px`,
                        '--opacity': `${p.opacity}`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */
interface LoginProps {
    onLogin: (userData: any, remember: boolean) => void;
}

export default function Login({ onLogin }: LoginProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [remember, setRemember] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [success, setSuccess] = useState(false);
    const [successUser, setSuccessUser] = useState('');
    const [regEnabled, setRegEnabled] = useState(true);
    const formRef = useRef<HTMLDivElement>(null);
    const usernameRef = useRef<HTMLInputElement>(null);

    // Auto‑focus username on mount & mode switch
    useEffect(() => {
        const timer = setTimeout(() => usernameRef.current?.focus(), 300);
        
        // Fetch config to check if registration is enabled
        fetch('/api/settings/public')
            .then(r => r.json())
            .then(d => {
                if (d.register_enabled === 'false') setRegEnabled(false);
                else setRegEnabled(true);
            })
            .catch(() => {});

        return () => clearTimeout(timer);
    }, [isRegistering]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password.trim()) {
            setError('Username dan Password harus diisi.');
            return;
        }

        if (loading) return;
        setLoading(true);

        try {
            if (isRegistering) {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (!response.ok) {
                    const isDuplicate = data.error && data.error.includes('UNIQUE constraint');
                    setError(isDuplicate ? 'Username sudah digunakan.' : (data.error || 'Gagal mendaftarkan akun.'));
                } else {
                    setSuccess(true);
                    setSuccessUser(username);
                    setTimeout(() => {
                        onLogin({ username, token: data.token, user_role: 'admin', status: 'active', id: data.userId }, remember);
                    }, 1200);
                }
            } else {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (!response.ok) {
                    setError('Username atau Password yang Anda masukkan salah.');
                } else {
                    setSuccess(true);
                    setSuccessUser(data.user.username);
                    setTimeout(() => {
                        onLogin({
                            username: data.user.username,
                            token: data.token,
                            user_role: data.user.user_role,
                            status: data.user.status,
                            id: data.user.id
                        }, remember);
                    }, 1200);
                }
            }
        } catch {
            setError('Tidak dapat terhubung ke server. Pastikan backend berjalan di port 3001.');
        } finally {
            if (!success) setLoading(false);
        }
    }, [username, password, remember, isRegistering, onLogin, loading, success]);

    const togglePassword = useCallback(() => setShowPassword(p => !p), []);

    const switchMode = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsRegistering(prev => !prev);
        setError('');
        setUsername('');
        setPassword('');
    }, []);

    // ── Success Overlay ──
    if (success) {
        return (
            <div className="login-page-wrapper">
                <FloatingParticles />
                <div className="login-bg-glow" />
                <div className="login-bg-glow-2" />
                <div className="login-bg-grid" />
                <div className="login-success-overlay">
                    <div className="success-check"><CheckCircleIcon /></div>
                    <h2>Welcome, {successUser}!</h2>
                    <p>Redirecting to dashboard...</p>
                    <div className="success-loader-bar"><div className="success-loader-fill" /></div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page-wrapper">
            {/* Background decorations */}
            <FloatingParticles />
            <div className="login-bg-glow" />
            <div className="login-bg-glow-2" />
            <div className="login-bg-glow-3" />
            <div className="login-bg-grid" />

            {/* Main Card */}
            <div className="login-container" ref={formRef}>

                {/* Left Side: Graphic / Branding */}
                <div className="login-graphic">
                    <div className="graphic-shape" />
                    <div className="graphic-shape-2" />

                    <div className="login-brand">
                        <div className="brand-icon">
                            <ApixsBrandIcon />
                        </div>
                        <span className="brand-text">Apixs <span className="brand-highlight">Live Web Stream</span></span>
                    </div>

                    <div className="graphic-content">
                        <h2>Stream your vision <br />to the <span className="text-gradient">world</span>.</h2>
                        <p>
                            Manage live broadcasts, playlists, and multi-platform automation in one premium dashboard.
                        </p>

                        <div className="graphic-stats">
                            <div className="g-stat">
                                <strong>99.9<span className="stat-unit">%</span></strong>
                               <span>Uptime</span>
                            </div>
                            <div className="g-stat">
                                <strong>4K</strong>
                                <span>Streaming</span>
                            </div>
                            <div className="g-stat">
                                <strong>24/7</strong>
                                <span>Automation</span>
                            </div>
                        </div>
                    </div>

                    <div className="graphic-footer">
                        <div className="gf-dot" /><span>Secured with end-to-end encryption</span>
                    </div>
                </div>

                {/* Right Side: Sign In Form */}
                <div className="login-form-side">
                    <div className="lf-header">
                        <div className="lf-mobile-brand">
                            <div className="brand-icon small"><ApixsBrandIcon /></div>
                            <span className="brand-text small">Apixs <span className="brand-highlight">Live Web Stream</span></span>
                        </div>
                        <h1>{isRegistering ? 'Create Account' : 'Welcome back'}</h1>
                        <p>{isRegistering ? 'Daftar untuk membuat akun baru.' : 'Sign in to your dashboard.'}</p>
                    </div>

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="form-group-login">
                            <div className="input-wrapper">
                                <input
                                    ref={usernameRef}
                                    id="login-username"
                                    type="text"
                                    className="login-input"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    autoComplete="username"
                                />
                                <UserIcon />
                            </div>
                        </div>

                        <div className="form-group-login">
                            <div className="input-wrapper">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="login-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete={isRegistering ? 'new-password' : 'current-password'}
                                />
                                <LockIcon />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={togglePassword}
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    <EyeIcon show={showPassword} />
                                </button>
                            </div>
                        </div>

                        <div className="login-options">
                            <label className="remember-me">
                                <input
                                    type="checkbox"
                                    className="custom-checkbox"
                                    checked={remember}
                                    onChange={(e) => setRemember(e.target.checked)}
                                />
                                <span className="checkbox-visual" />
                                <span className="remember-text">Remember me</span>
                            </label>
                            {!isRegistering && (
                                <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); setError('Hubungi administrator untuk reset password.'); }}>
                                    Forgot Password?
                                </a>
                            )}
                        </div>

                        {error && (
                            <div className="login-error" role="alert">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                <span>{error}</span>
                            </div>
                        )}

                        <button type="submit" className={`btn-login ${loading ? 'btn-login-loading' : ''}`} disabled={loading}>
                            {loading ? (
                                <><span className="btn-spinner" />{isRegistering ? 'Creating Account...' : 'Authenticating...'}</>
                            ) : (
                                <>{isRegistering ? 'Create Account' : 'Sign In'}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></>
                            )}
                        </button>

                        {regEnabled && (
                            <div className="login-register-prompt">
                                {isRegistering ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
                                <a href="#" className="register-link" onClick={switchMode}>
                                    {isRegistering ? 'Sign In' : 'Register'}
                                </a>
                            </div>
                        )}
                        {!regEnabled && isRegistering && (
                             <div className="login-register-prompt" style={{color: '#ef4444'}}>
                                Pendaftaran ditutup. <a href="#" onClick={switchMode}>Kembali ke Login</a>
                             </div>
                        )}
                    </form>
                </div>

            </div>
        </div>
    );
}

