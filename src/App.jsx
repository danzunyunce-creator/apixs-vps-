import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import JadwalkanLive from './pages/JadwalkanLive';
import VideoLooping from './pages/VideoLooping';
import OtomatisasiYT from './pages/OtomatisasiYT';
import PengelolaYT from './pages/PengelolaYT';

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */
const PLATFORM_COLORS = { YOUTUBE: '#ff0000', FACEBOOK: '#1877F2', TIKTOK: '#ff0050' };
const PLATFORM_AVATARS = {
  YOUTUBE: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=100&h=100&fit=crop',
  FACEBOOK: 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=100&h=100&fit=crop',
  TIKTOK: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=100&fit=crop',
};
const ALL_CHANNELS = [
  { id: 1, name: 'Cocina Deliciosa', platform: 'YOUTUBE', avatar: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=100&h=100&fit=crop', status: 'STOP', subs: '383.363', watchHrs: '12K', views: '215.867', platformColor: '#ff0000' },
  { id: 2, name: 'Tech Insider UK', platform: 'YOUTUBE', avatar: 'https://images.unsplash.com/photo-1542393545-10f5cde2c810?w=100&h=100&fit=crop', status: 'MULAI', subs: '497.949', watchHrs: '45K', views: '1.245.000', platformColor: '#ff0000' },
  { id: 3, name: 'Musica Italiana', platform: 'YOUTUBE', avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop', status: 'STOP', subs: '452.520', watchHrs: '8K', views: '98.000', platformColor: '#ff0000' },
  { id: 4, name: 'Premier League Fan', platform: 'FACEBOOK', avatar: 'https://images.unsplash.com/photo-1508344928928-7165b67de128?w=100&h=100&fit=crop', status: 'MULAI', subs: '120.500', watchHrs: '32K', views: '512.000', platformColor: '#1877F2' },
  { id: 5, name: 'TikTok Viral Hits', platform: 'TIKTOK', avatar: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=100&fit=crop', status: 'STOP', subs: '1.2M', watchHrs: '150K', views: '3.500.000', platformColor: '#ff0050' },
];

/* ═══════════════════════════════════════════════
   HOOKS
═══════════════════════════════════════════════ */
function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`,
    time: `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`,
  };
}

/* ═══════════════════════════════════════════════
   CONFIRM MODAL
═══════════════════════════════════════════════ */
function ConfirmModal({ message, onConfirm, onCancel }) {
  // Close on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <p className="confirm-message">{message}</p>
        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button className="modal-btn-cancel" onClick={onCancel}>Batal</button>
          <button className="modal-btn-delete" onClick={onConfirm}>Ya, Hapus</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAMBAH CHANNEL MODAL
═══════════════════════════════════════════════ */
const EMPTY_FORM = { name: '', platform: 'YOUTUBE', apiKey: '', channelId: '', subs: '', watchHrs: '', views: '' };

function TambahChannelModal({ onClose, onAdd }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState(null);

  // Close on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
    if (field === 'apiKey') setApiKeyStatus(null);
  };

  const validateApiKey = () => {
    if (!form.apiKey.trim()) { setApiKeyStatus(null); return; }
    const isValid = /^AIza[0-9A-Za-z\-_]{35}$/.test(form.apiKey.trim());
    setApiKeyStatus('checking');
    setTimeout(() => setApiKeyStatus(isValid ? 'valid' : 'invalid'), 700);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nama channel wajib diisi.'); return; }
    if (!form.subs.trim()) { setError('Subscriber wajib diisi.'); return; }
    if (form.platform === 'YOUTUBE' && form.apiKey.trim() && apiKeyStatus === 'invalid') {
      setError('Format YouTube API Key tidak valid. Key harus dimulai dengan "AIza".'); return;
    }
    onAdd({
      id: Date.now(),
      name: form.name.trim(),
      platform: form.platform,
      avatar: PLATFORM_AVATARS[form.platform],
      status: 'STOP',
      subs: form.subs.trim(),
      watchHrs: form.watchHrs.trim() || '0',
      views: form.views.trim() || '0',
      platformColor: PLATFORM_COLORS[form.platform],
      apiKey: form.apiKey.trim() || null,
      channelId: form.channelId.trim() || null,
    });
    onClose();
  };

  const PlatformIcons = {
    YOUTUBE: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3 3 0 0 0-2.12-2.12C19.55 3.5 12 3.5 12 3.5s-7.55 0-9.38.57A3 3 0 0 0 .5 6.19C0 8.02 0 12 0 12s0 3.98.5 5.81a3 3 0 0 0 2.12 2.12C4.45 20.5 12 20.5 12 20.5s7.55 0 9.38-.57a3 3 0 0 0 2.12-2.12C24 15.98 24 12 24 12s0-3.98-.5-5.81zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" /></svg>,
    FACEBOOK: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.406 18.627 0 12 0S0 5.406 0 12.073C0 18.1 4.388 23.1 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.1 24 18.1 24 12.073z" /></svg>,
    TIKTOK: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.83 1.55V6.78a4.85 4.85 0 0 1-1.06-.09z" /></svg>,
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00b87c" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            Tambah Channel Baru
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {/* Platform */}
          <div className="form-group">
            <label className="form-label">Platform</label>
            <div className="platform-selector">
              {['YOUTUBE', 'FACEBOOK', 'TIKTOK'].map((p) => (
                <button key={p} type="button"
                  className={`platform-option ${form.platform === p ? 'platform-active' : ''}`}
                  style={{ '--p-color': PLATFORM_COLORS[p] }}
                  onClick={() => handleChange('platform', p)}>
                  {PlatformIcons[p]}<span>{p}</span>
                </button>
              ))}
            </div>
          </div>

          {/* YouTube API Key + Channel ID */}
          {form.platform === 'YOUTUBE' && (
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">
                  YouTube API Key
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="api-key-link" title="Buka Google Cloud Console">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    Cara dapat
                  </a>
                </label>
                <div className="api-key-input-wrapper">
                  <div className="api-key-prefix">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </div>
                  <input
                    className={`form-input api-key-input ${apiKeyStatus === 'valid' ? 'input-valid' : ''} ${apiKeyStatus === 'invalid' ? 'input-invalid' : ''}`}
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="AIza..."
                    value={form.apiKey}
                    onChange={(e) => handleChange('apiKey', e.target.value)}
                    onBlur={validateApiKey}
                  />
                  <button type="button" className="api-key-toggle" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>}
                  </button>
                  {apiKeyStatus === 'checking' && <span className="api-status checking">⏳</span>}
                  {apiKeyStatus === 'valid' && <span className="api-status valid">✓ Valid</span>}
                  {apiKeyStatus === 'invalid' && <span className="api-status invalid">✗ Salah</span>}
                </div>
                <div className="api-key-hint">Opsional · YouTube Data API v3</div>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Channel ID</label>
                <input className="form-input" type="text" placeholder="UC..." value={form.channelId} onChange={(e) => handleChange('channelId', e.target.value)} />
                <div className="api-key-hint">Opsional · cth: UCxxxxxx</div>
              </div>
            </div>
          )}

          {/* Nama Channel */}
          <div className="form-group">
            <label className="form-label">Nama Channel <span className="required">*</span></label>
            <input className="form-input" type="text" placeholder="Contoh: My Awesome Channel" value={form.name} onChange={(e) => handleChange('name', e.target.value)} autoFocus />
          </div>

          {/* Statistik */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Subscriber <span className="required">*</span></label>
              <input className="form-input" type="text" placeholder="cth: 10.000" value={form.subs} onChange={(e) => handleChange('subs', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Jam Tayang</label>
              <input className="form-input" type="text" placeholder="cth: 500K" value={form.watchHrs} onChange={(e) => handleChange('watchHrs', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">View (BLN)</label>
              <input className="form-input" type="text" placeholder="cth: 2.000" value={form.views} onChange={(e) => handleChange('views', e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="form-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              {error}
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="modal-btn-submit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              Tambah Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════ */
function Dashboard() {
  const [channels, setChannels] = useState(ALL_CHANNELS);
  const [activeTab, setActiveTab] = useState('SEMUA');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // id to delete
  const [search, setSearch] = useState('');

  const liveCount = channels.filter((c) => c.status === 'MULAI').length;
  const stopCount = channels.filter((c) => c.status === 'STOP').length;

  const filtered = channels
    .filter((c) => activeTab === 'SEMUA' || c.platform === activeTab)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const toggleStatus = (id) =>
    setChannels((prev) =>
      prev.map((c) => c.id === id ? { ...c, status: c.status === 'STOP' ? 'MULAI' : 'STOP' } : c)
    );

  const toggleSelectAll = () => {
    if (selectAll) setSelectedIds([]);
    else setSelectedIds(filtered.map((c) => c.id));
    setSelectAll(!selectAll);
  };

  const toggleSelect = (id) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);

  const confirmDeleteChannel = (id) => setConfirmDelete(id);

  const doDelete = () => {
    setChannels((prev) => prev.filter((c) => c.id !== confirmDelete));
    setSelectedIds((prev) => prev.filter((i) => i !== confirmDelete));
    setConfirmDelete(null);
  };

  const addChannel = (ch) => setChannels((prev) => [...prev, ch]);

  return (
    <>
      {showModal && <TambahChannelModal onClose={() => setShowModal(false)} onAdd={addChannel} />}
      {confirmDelete && (
        <ConfirmModal
          message={`Yakin ingin menghapus channel "${channels.find(c => c.id === confirmDelete)?.name}"?`}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div className="dashboard-card">
        {/* ── Summary strip ── */}
        <div className="dashboard-summary-strip">
          <div className="summary-stat">
            <span className="ss-value">{channels.length}</span>
            <span className="ss-label">Total Channel</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-stat">
            <span className="ss-value green-val">{liveCount}</span>
            <span className="ss-label">Live Aktif</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-stat">
            <span className="ss-value red-val">{stopCount}</span>
            <span className="ss-label">Offline</span>
          </div>
        </div>

        <div className="card-header">
          <div className="card-title-group">
            <h1>DASHBOARD</h1>
            <span className="total-badge">{channels.length} Total</span>
          </div>
          <div className="card-actions">
            <div className="search-input-container">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Cari saluran..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <button className="search-clear" onClick={() => setSearch('')} title="Hapus pencarian">×</button>
              )}
            </div>
            <button className="btn-add" onClick={() => setShowModal(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              TAMBAH CHANNEL
            </button>
          </div>
        </div>

        <div className="tabs-container">
          {[
            { key: 'SEMUA', count: channels.length },
            { key: 'YOUTUBE', count: channels.filter(c => c.platform === 'YOUTUBE').length },
            { key: 'FACEBOOK', count: channels.filter(c => c.platform === 'FACEBOOK').length },
            { key: 'TIKTOK', count: channels.filter(c => c.platform === 'TIKTOK').length },
          ].map(({ key, count }) => (
            <button key={key} className={`tab ${activeTab === key ? 'active-tab' : ''}`} onClick={() => setActiveTab(key)}>
              {key} <span className="tab-count">{count}</span>
            </button>
          ))}
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th width="48"><input type="checkbox" className="custom-checkbox" checked={selectAll} onChange={toggleSelectAll} /></th>
                <th width="48">NO</th>
                <th>SALURAN</th>
                <th className="center-col">ACTION</th>
                <th className="right-col">SUBSCRIBER</th>
                <th className="right-col">JAM TAYANG</th>
                <th className="right-col">VIEW / BLN</th>
                <th className="center-col">AI ASSIST</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="8" className="empty-row">
                  {search ? `Tidak ada channel dengan nama "${search}"` : 'Belum ada channel di platform ini.'}
                </td></tr>
              ) : (
                filtered.map((ch, idx) => (
                  <tr key={ch.id} className={selectedIds.includes(ch.id) ? 'row-selected' : ''}>
                    <td><input type="checkbox" className="custom-checkbox" checked={selectedIds.includes(ch.id)} onChange={() => toggleSelect(ch.id)} /></td>
                    <td className="row-no">{idx + 1}</td>
                    <td>
                      <div className="channel-info">
                        <img src={ch.avatar} alt={ch.name} className="channel-avatar" />
                        <div className="channel-details">
                          <div className="channel-name">{ch.name}</div>
                          <div className="channel-platform" style={{ color: ch.platformColor }}>{ch.platform}</div>
                        </div>
                      </div>
                    </td>
                    <td className="center-col">
                      <div className="action-buttons">
                        <button
                          className={`status-btn ${ch.status === 'STOP' ? 'btn-stop' : 'btn-mulai'}`}
                          onClick={() => toggleStatus(ch.id)}
                          title={ch.status === 'STOP' ? 'Klik untuk mulai live' : 'Klik untuk stop live'}
                        >
                          {ch.status === 'STOP'
                            ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> MULAI</>
                            : <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> STOP</>
                          }
                        </button>
                        <button className="icon-action-btn" title="Edit channel">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button className="icon-action-btn icon-delete" title="Hapus channel" onClick={() => confirmDeleteChannel(ch.id)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </td>
                    <td className="right-col font-numeric">{ch.subs}</td>
                    <td className="right-col font-numeric">{ch.watchHrs}</td>
                    <td className="right-col font-numeric">{ch.views}</td>
                    <td className="center-col">
                      <div className="ai-assist-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                        <span className="dot"></span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card-footer">
          <div className="pagination-info">
            Showing <span>1</span> to <span>{filtered.length}</span> of <span>{channels.length}</span> results
          </div>
          <div className="pagination-controls">
            <button className="page-nav-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
            <button className="page-number active-page">1</button>
            <button className="page-nav-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════ */
function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const { date, time } = useLiveClock();

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', cls: 'active-nav' },
    { key: 'jadwalkan', label: 'JADWALKAN LIVE', cls: 'active-nav-blue', arrow: true },
    { key: 'videolooping', label: 'Video Looping', cls: 'active-nav-teal', greenText: true },
    { key: 'otomatisasi', label: 'Otomatisasi YT', cls: 'active-nav-blue' },
    { key: 'pengelola', label: 'Pengelola YouTube', cls: 'active-nav-blue' },
  ];

  return (
    <div className="app-layout">
      {/* System Top Bar */}
      <div className="system-top-bar">
        <div className="top-bar-left"><span>Apixs Live Stream Dashboard</span></div>
        <div className="top-bar-center"><span>Copy of Apixs Live Stream Dashboard</span></div>
        <div className="top-bar-right">
          <button className="top-btn border-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            Device
          </button>
          <button className="top-btn icon-only-btn"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></button>
          <button className="top-btn border-btn-right">
            <span>DEVICE</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.24l-3.32 3.32"></path></svg>
          </button>
        </div>
      </div>

      <header className="main-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-apixs">APIXS</span>
            <span className="logo-live">LIVE STREAM</span>
          </div>
          <nav className="nav-menu">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`nav-btn ${activePage === item.key ? item.cls : `outline-border${item.greenText ? ' with-green-text' : ''}`}`}
                onClick={() => setActivePage(item.key)}
              >
                {item.label}
                {item.arrow && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>}
              </button>
            ))}
          </nav>
        </div>
        <div className="header-right">
          <div className="datetime">
            <div className="date">{date}</div>
            <div className="time">{time}</div>
          </div>
          <button className="clock-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--active-blue)" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {activePage === 'dashboard' && <Dashboard />}
        {activePage === 'jadwalkan' && <JadwalkanLive />}
        {activePage === 'videolooping' && <VideoLooping />}
        {activePage === 'otomatisasi' && <OtomatisasiYT />}
        {activePage === 'pengelola' && <PengelolaYT />}
      </main>
    </div>
  );
}

export default App;
