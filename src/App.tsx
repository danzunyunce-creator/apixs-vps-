import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import './App.css';

/* ═══════════════════════════════════════════════
   LAZY LOAD COMPONENTS
   ═══════════════════════════════════════════════ */
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

/** Preload map for intent-based loading */
const preloadPage = (key: string) => {
  switch (key) {
    case 'dashboard': import('./pages/Dashboard'); break;
    case 'streams': import('./pages/StreamManagement'); break;
    case 'automation': import('./pages/YTAutomation'); break;
    case 'media': import('./pages/MediaManager'); break;
    case 'scheduler': import('./pages/Scheduler'); break;
    case 'watchdog': import('./pages/Watchdog'); break;
    case 'users': import('./pages/UserManagement'); break;
    case 'settings': import('./pages/Settings'); break;
    case 'analytics': import('./pages/Analytics'); break;
  }
};

/* ═══════════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════════ */
const DEVICES = [
  { key: 'desktop', label: 'Desktop', size: '100%', icon: 'monitor' },
  { key: 'tablet', label: 'Tablet', size: '768px', icon: 'tablet' },
  { key: 'mobile', label: 'Mobile', size: '375px', icon: 'smartphone' },
];

const DAYS_ID = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const MONTHS_ID = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];

/* ═══════════════════════════════════════════════
   ISOLATED COMPONENTS (For Performance)
   ═══════════════════════════════════════════════ */

/** Isolated Live Clock component to prevent global App rerenders */
const LiveClock = () => {
    const [now, setNow] = useState(new Date());
    
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const pad = (n: number) => String(n).padStart(2, '0');
    const hours = now.getHours();
    const dayName = DAYS_ID[now.getDay()];
    const dayNum = now.getDate();
    const monthName = MONTHS_ID[now.getMonth()];
    const year = now.getFullYear();

    let greeting = 'Selamat Malam';
    if (hours >= 5 && hours < 12) greeting = 'Selamat Pagi';
    else if (hours >= 12 && hours < 15) greeting = 'Selamat Siang';
    else if (hours >= 15 && hours < 18) greeting = 'Selamat Sore';

    return (
        <div className="datetime-minimal">
            <span className="dt-greeting">{greeting}</span>
            <span className="dt-divider">|</span>
            <span className="dt-date">{dayName}, {dayNum} {monthName.slice(0, 3)}</span>
            <span className="dt-divider">|</span>
            <span className="dt-time">
                {pad(hours)}.{pad(now.getMinutes())}
                <span className="dt-seconds">:{pad(now.getSeconds())}</span>
            </span>
        </div>
    );
};

/* ═══════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════ */

/** Theme hook with localStorage persistence and system theme support */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('apixs-theme');
      if (stored) return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('apixs-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  // Sync with system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('apixs-theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle };
}

/** Device selection hook with localStorage persistence */
function useDevice() {
  const [device, setDevice] = useState(() => {
    try {
      return localStorage.getItem('apixs-device') || 'desktop';
    } catch {
      return 'desktop';
    }
  });

  useEffect(() => {
    try { localStorage.setItem('apixs-device', device); } catch { /* ignore */ }
  }, [device]);

  return { device, setDevice };
}

/* ═══════════════════════════════════════════════
   SVG ICONS
   ═══════════════════════════════════════════════ */
const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const MonitorIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
  
  const TabletIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
  
  const SmartphoneIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DeviceIcons: Record<string, React.FC> = { monitor: MonitorIcon, tablet: TabletIcon, smartphone: SmartphoneIcon };

/* ═══════════════════════════════════════════════
   DEVICE SELECTOR
   ═══════════════════════════════════════════════ */
interface DeviceSelectorProps {
  device: string;
  setDevice: (d: string) => void;
}

function DeviceSelector({ device, setDevice }: DeviceSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const currentDev = DEVICES.find((d) => d.key === device) || DEVICES[0];
  const CurrentIcon = DeviceIcons[currentDev.icon];

  return (
    <div className="device-selector-wrapper" ref={ref}>
      <button
        className={`device-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
        title="Pilih device preview"
      >
        <CurrentIcon />
        {currentDev.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
        </svg>
      </button>

      {open && (
        <div className="device-dropdown">
          <div className="device-dropdown-title">Pilih Device View</div>
          {DEVICES.map((d) => {
            const Icon = DeviceIcons[d.icon];
            const isSelected = device === d.key;
            return (
              <button
                key={d.key}
                className={`device-option ${isSelected ? 'selected' : ''}`}
                onClick={() => { setDevice(d.key); setOpen(false); }}
              >
                <div className="device-option-icon"><Icon /></div>
                <div className="device-option-info">
                  <span className="device-option-name">{d.label}</span>
                  <span className="device-option-size">{d.size}</span>
                </div>
                {isSelected && <span className="check-icon"><CheckIcon /></span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   APP ROOT
   ═══════════════════════════════════════════════ */
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return localStorage.getItem('apixs_auth') === 'true' || sessionStorage.getItem('apixs_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('apixs_userData') || sessionStorage.getItem('apixs_userData');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [activePage, setActivePage] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'dashboard';
  });
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [cachedPages, setCachedPages] = useState<Record<string, boolean>>({ [activePage]: true });
  const [usageCount, setUsageCount] = useState<Record<string, number>>({ [activePage]: 1 });
  const MAX_CACHE = 5; // Increased for better balance
  
  // Smart Navigation Handler (Persistent Rendering)
  const handlePageChange = useCallback((key: string) => {
    setActivePage(key);
    setIsDrawerOpen(false);

    setUsageCount(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    setCachedPages(prev => {
        if (prev[key]) return prev;
        const keys = Object.keys(prev);
        if (keys.length >= MAX_CACHE) {
            const leastUsed = keys.sort((a,b) => (usageCount[a] || 0) - (usageCount[b] || 0))[0];
            if (leastUsed !== key) {
                const updated = { ...prev };
                delete updated[leastUsed];
                return { ...updated, [key]: true };
            }
        }
        return { ...prev, [key]: true };
    });
  }, [usageCount]);

  useEffect(() => {
    window.location.hash = activePage;
  }, [activePage]);

  const { theme, toggle: toggleTheme } = useTheme();
  const { device, setDevice } = useDevice();

  const handleLogin = (userData: any, remember: boolean) => {
    setIsAuthenticated(true);
    setCurrentUser(userData);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('apixs_auth', 'true');
    storage.setItem('apixs_userData', JSON.stringify(userData));
    if (userData.token) storage.setItem('apixs-ses-id', userData.token);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('apixs_auth');
    localStorage.removeItem('apixs_userData');
    sessionStorage.removeItem('apixs_auth');
    sessionStorage.removeItem('apixs_userData');
    localStorage.removeItem('apixs_currentUser');
  };

  if (!isAuthenticated) {
    return (
        <Suspense fallback={<div className="login-loader">Loading Secure Access...</div>}>
            <Login onLogin={handleLogin} />
        </Suspense>
    );
  }

  const isAdmin = currentUser?.user_role === 'admin';

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', cls: 'active-nav', icon: 'Layout' },
    { key: 'streams', label: 'Stream Management', cls: 'active-nav-blue', icon: 'Tv' },
    { key: 'automation', label: 'YT Automation', cls: 'active-nav-blue', icon: 'Video' },
    { key: 'media', label: 'Media Manager', cls: 'active-nav-blue', icon: 'Folder' },
    { key: 'scheduler', label: 'Scheduler', cls: 'active-nav-blue', icon: 'Calendar' },
    { key: 'watchdog', label: 'Live Watchdog', cls: 'active-nav-blue', icon: 'Activity' },
    { key: 'channels', label: 'Channel Manager', cls: 'active-nav-teal', greenText: true, icon: 'Users' },
    ...(isAdmin ? [
      { key: 'users', label: 'User Management', cls: 'active-nav-teal', greenText: true, icon: 'Users' },
      { key: 'settings', label: 'Settings', cls: 'active-nav-blue', icon: 'Settings' }
    ] : []),
    { key: 'analytics', label: 'Analytics', cls: 'active-nav-blue', icon: 'BarChart' },
    { key: 'ultimate', label: 'Ultimate Hub', cls: 'active-nav-blue', icon: 'Layout' },
  ];

  const mainContent = (
    <>
      <header className="main-header">
        <div className="header-left">
          <button className="hamburger-btn" onClick={() => setIsDrawerOpen(!isDrawerOpen)}>
            {isDrawerOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            )}
          </button>
          <div className="logo" onClick={() => handlePageChange('dashboard')} style={{ cursor: 'pointer' }}>
            <span className="logo-apixs">APIXS</span>
            <span className="logo-live">LIVE</span>
          </div>
          <nav className="nav-menu desktop-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                onMouseEnter={() => preloadPage(item.key)}
                className={`nav-btn ${activePage === item.key ? item.cls : `outline-border${item.greenText ? ' with-green-text' : ''}`}`}
                onClick={() => handlePageChange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Side Drawer (Mobile) */}
      <div className={`nav-drawer ${isDrawerOpen ? 'open' : ''}`}>
         <div className="drawer-header">
            <div className="logo" onClick={() => handlePageChange('dashboard')}>
                <span className="logo-apixs">APIXS</span>
                <span className="logo-live">LIVE</span>
            </div>
            <button className="drawer-close" onClick={() => setIsDrawerOpen(false)}>×</button>
         </div>
         <nav className="drawer-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                onMouseEnter={() => preloadPage(item.key)}
                className={`drawer-item ${activePage === item.key ? 'active' : ''}`}
                onClick={() => handlePageChange(item.key)}
              >
                {/* SVG Icon Mapping */}
                {(() => {
                  switch(item.icon) {
                    case 'Layout': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>;
                    case 'Tv': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>;
                    case 'Video': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>;
                    case 'Folder': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>;
                    case 'Calendar': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
                    case 'Activity': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>;
                    case 'Users': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;
                    case 'Settings': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;
                    case 'BarChart': return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>;
                    default: return null;
                  }
                })()}
                <span>{item.label}</span>
              </button>
            ))}
         </nav>
      </div>
      {isDrawerOpen && <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)}></div>}

      <main className="dashboard-content">
        <Suspense fallback={<div className="page-loader">Memuat Modul...</div>}>
            <div style={{ display: activePage === 'dashboard' ? 'block' : 'none' }}>
                {cachedPages['dashboard'] && <Dashboard />}
            </div>
            <div style={{ display: activePage === 'streams' ? 'block' : 'none' }}>
                {cachedPages['streams'] && <StreamManagement />}
            </div>
            <div style={{ display: activePage === 'automation' ? 'block' : 'none' }}>
                {cachedPages['automation'] && <YTAutomation />}
            </div>
            <div style={{ display: activePage === 'media' ? 'block' : 'none' }}>
                {cachedPages['media'] && <MediaManager />}
            </div>
            <div style={{ display: activePage === 'scheduler' ? 'block' : 'none' }}>
                {cachedPages['scheduler'] && <Scheduler />}
            </div>
            <div style={{ display: activePage === 'watchdog' ? 'block' : 'none' }}>
                {cachedPages['watchdog'] && <Watchdog />}
            </div>
            <div style={{ display: activePage === 'channels' ? 'block' : 'none' }}>
                {cachedPages['channels'] && <ChannelManager />}
            </div>
            {isAdmin && (
                <div style={{ display: activePage === 'users' ? 'block' : 'none' }}>
                    {cachedPages['users'] && <UserManagement />}
                </div>
            )}
            <div style={{ display: activePage === 'settings' ? 'block' : 'none' }}>
                {cachedPages['settings'] && <Settings />}
            </div>
            <div style={{ display: activePage === 'analytics' ? 'block' : 'none' }}>
                {cachedPages['analytics'] && <Analytics />}
            </div>
            <div style={{ display: activePage === 'ultimate' ? 'block' : 'none' }}>
                {cachedPages['ultimate'] && <UltimateAutomation />}
            </div>
        </Suspense>
      </main>
    </>
  );

  return (
    <div className={`app-layout ${device}`}>
      {/* System Top Bar */}
      <div className="system-top-bar">
        <div className="top-bar-right" style={{ width: '100%', justifyContent: 'flex-end' }}>
          <DeviceSelector device={device} setDevice={setDevice} />

          {/* Isolated Clock */}
          <LiveClock />

          {/* Theme Toggle */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}
          >
            {theme === 'dark'
              ? <span className="theme-icon sun"><SunIcon /></span>
              : <span className="theme-icon moon"><MoonIcon /></span>
            }
          </button>

          <button
            className="top-btn"
            style={{ color: '#ef4444', borderColor: 'transparent', fontWeight: 'bold' }}
            onClick={handleLogout}
            title="Keluar (Logout)"
          >
            LOGOUT
          </button>
        </div>
      </div>

      {/* Conditionally wrap in device frame */}
      {device === 'desktop' ? (
        mainContent
      ) : (
        <div className="device-frame-wrapper">
          <div className={`device-frame ${device}`}>
            {mainContent}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;


