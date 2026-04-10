import React from 'react';
import { 
  BarChart2, 
  Wind, 
  Zap, 
  PlayCircle, 
  Calendar, 
  Settings,
  MessageCircle
} from 'lucide-react';

interface MobileBottomNavProps {
  activePage: string;
  onPageChange: (page: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activePage, onPageChange }) => {
  const items = [
    { key: 'dashboard', label: 'Home', icon: <BarChart2 size={24} /> },
    { key: 'streams', label: 'Streams', icon: <Wind size={24} /> },
    { key: 'automation', label: 'Auto', icon: <Zap size={24} /> },
    { key: 'media', label: 'Media', icon: <PlayCircle size={24} /> },
    { key: 'scheduler', label: 'Sched', icon: <Calendar size={24} /> },
    { key: 'chat', label: 'Chat', icon: <MessageCircle size={24} />, hidden: activePage !== 'live-chat' }
  ];

  return (
    <div className="mobile-bottom-nav">
      {items.map(item => (
        <button 
          key={item.key}
          className={`nav-item ${activePage === item.key || (item.key === 'chat' && activePage === 'live-chat') ? 'active' : ''}`}
          onClick={() => onPageChange(item.key)}
        >
          <div className="nav-icon">{item.icon}</div>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}

      <style>{`
        .mobile-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: var(--mobile-nav-height);
          background: rgba(13, 17, 23, 0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid var(--glass-border);
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 0 10px;
          z-index: 3000;
          display: none; /* Hidden by default */
        }

        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex;
          }
        }

        .nav-item {
          background: transparent;
          border: none;
          color: var(--text-dim);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          border-radius: 12px;
          transition: all 0.2s;
          min-width: 60px;
        }

        .nav-item.active {
          color: var(--accent-indigo);
          background: rgba(99, 102, 241, 0.1);
        }

        .nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }

        .nav-item.active .nav-icon {
          transform: translateY(-2px);
        }

        .nav-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
};
