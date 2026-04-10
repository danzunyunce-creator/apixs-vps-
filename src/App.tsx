import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { TOKEN_KEY } from './api';
import './App.css';

// PAGES
const Dashboard = lazy(() => import('./pages/Dashboard'));
const StreamManagement = lazy(() => import('./pages/StreamManagement'));
const YTAutomation = lazy(() => import('./pages/YTAutomation'));
const MediaManager = lazy(() => import('./pages/MediaManager'));
const Scheduler = lazy(() => import('./pages/Scheduler'));
const Watchdog = lazy(() => import('./pages/Watchdog'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));
const UltimateAutomation = lazy(() => import('./pages/UltimateAutomation'));
const Login = lazy(() => import('./pages/Login'));
const ChannelManager = lazy(() => import('./pages/ChannelManager'));
const LiveChat = lazy(() => import('./pages/LiveChat'));

import { SystemToolkitModal } from './components/stream-management/SystemToolkitModal';

const DAYS_ID = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];

const LiveClock = () => {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        <div className="datetime-compact">
            <span className="dt-label">{DAYS_ID[now.getDay()]}</span>
            <span className="dt-time-bold">{pad(now.getHours())}:{pad(now.getMinutes())}<span className="dt-sec">:{pad(now.getSeconds())}</span></span>
        </div>
    );
};

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('apixs-theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('apixs-theme', theme);
  }, [theme]);
  return { theme, toggle: () => setTheme(prev => prev === 'dark' ? 'light' : 'dark') };
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('apixs_auth') === 'true' || sessionStorage.getItem('apixs_auth') === 'true';
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = localStorage.getItem('apixs_userData') || sessionStorage.getItem('apixs_userData');
    return stored ? JSON.parse(stored) : null;
  });

  const [activePage, setActivePage] = useState('dashboard');
  const [showToolkit, setShowToolkit] = useState(false);
  const [cachedPages, setCachedPages] = useState<Record<string, boolean>>({ dashboard: true });
  const { theme, toggle: toggleTheme } = useTheme();

  const handleLogin = (userData: any, remember: boolean) => {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('apixs_auth', 'true');
    storage.setItem('apixs_userData', JSON.stringify(userData));
    if (userData.token) storage.setItem(TOKEN_KEY, userData.token);
    setIsAuthenticated(true);
    setCurrentUser(userData);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('apixs_auth');
    localStorage.removeItem('apixs_userData');
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem('apixs_auth');
    sessionStorage.removeItem('apixs_userData');
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.hash = '';
    window.location.reload();
  };

  const navItems = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'streams', label: 'Streams' },
    { key: 'automation', label: 'Automation' },
    { key: 'media', label: 'Media' },
    { key: 'channels', label: 'Channel Mgt.' },
    { key: 'scheduler', label: 'Scheduler' },
    { key: 'settings', label: 'Settings' },
  ];

  if (!isAuthenticated) return <Suspense fallback={<div>Loading...</div>}><Login onLogin={handleLogin} /></Suspense>;

  return (
    <div className={`app-layout theme-${theme}`}>
      <header className="unified-command-bar">
        <div className="bar-left">
          <div className="compact-logo" onClick={() => setActivePage('dashboard')}>
            <span className="logo-accent">APIXS</span>
          </div>
          <nav className="compact-nav">
            {navItems.map(item => (
              <button 
                key={item.key} 
                className={`compact-nav-btn ${activePage === item.key ? 'active' : ''}`}
                onClick={() => { setActivePage(item.key); setCachedPages(p => ({ ...p, [item.key]: true })); }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="bar-right">
          <LiveClock />
          <div className="bar-divider" />
          <button className="bar-icon-btn magic" onClick={() => setShowToolkit(true)} title="Magic Toolkit">🪄</button>
          <button className="bar-icon-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button className="bar-logout-btn" onClick={handleLogout}>OUT</button>
        </div>
      </header>

      <main className="compact-workspace">
        <Suspense fallback={<div className="sync-spinner">SYNCING...</div>}>
            <div style={{ display: activePage === 'dashboard' ? 'block' : 'none' }}>{cachedPages['dashboard'] && <Dashboard />}</div>
            <div style={{ display: activePage === 'streams' ? 'block' : 'none' }}>{cachedPages['streams'] && <StreamManagement />}</div>
            <div style={{ display: activePage === 'automation' ? 'block' : 'none' }}>{cachedPages['automation'] && <YTAutomation />}</div>
            <div style={{ display: activePage === 'media' ? 'block' : 'none' }}>{cachedPages['media'] && <MediaManager />}</div>
            <div style={{ display: activePage === 'channels' ? 'block' : 'none' }}>{cachedPages['channels'] && <ChannelManager />}</div>
            <div style={{ display: activePage === 'scheduler' ? 'block' : 'none' }}>{cachedPages['scheduler'] && <Scheduler />}</div>
            <div style={{ display: activePage === 'settings' ? 'block' : 'none' }}>{cachedPages['settings'] && <Settings />}</div>
        </Suspense>
      </main>

      <SystemToolkitModal show={showToolkit} onClose={() => setShowToolkit(false)} />
    </div>
  );
}

export default App;
