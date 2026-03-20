import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import ShortcutsOverlay from './ShortcutsOverlay';

const NAV = [
  { to: '/dashboard', icon: '⊡', label: 'Dashboard' },
  { to: '/topics', icon: '◈', label: 'Topics' },
  { to: '/logs', icon: '◷', label: 'Logs' },
  { to: '/notes', icon: '◇', label: 'Notes' },
  { to: '/roadmaps', icon: '⟳', label: 'Roadmaps' },
  { to: '/goals', icon: '🎯', label: 'Goals' },
  { to: '/resources', icon: '⊞', label: 'Resources' },
  { to: '/analytics', icon: '◎', label: 'Analytics' },
  { to: '/assistant', icon: '⬡', label: 'AI Assistant' },
];

const TYPE_ICONS = {
  topic: '◈',
  log: '◷',
  resource: '⊞',
  note: '◇',
};

const TYPE_COLORS = {
  topic: '#f97316',
  log: '#3b82f6',
  resource: '#22c55e',
  note: '#a855f7',
};

function GlobalSearch({ collapsed, onExpand }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await api.get(`/search/?q=${encodeURIComponent(q)}`);
      setResults(res.data.results);
      setOpen(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (result) => {
    const routes = { topic: '/topics', log: '/logs', resource: '/resources', note: '/notes' };
    navigate(routes[result.type] || '/dashboard');
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut: Ctrl+K — expand sidebar if collapsed, then focus
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (collapsed) {
          onExpand();
          // Wait for sidebar to expand before focusing
          setTimeout(() => inputRef.current?.focus(), 280);
        } else {
          inputRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [collapsed, onExpand]);

  if (collapsed) {
    return (
      <button
        className="search-icon-btn"
        onClick={() => { onExpand(); setTimeout(() => inputRef.current?.focus(), 280); }}
        title="Search (Ctrl+K)"
      >
        ⌕
      </button>
    );
  }

  return (
    <div className="search-wrap" ref={containerRef}>
      <div className="search-input-wrap">
        <span className="search-icon">⌕</span>
        <input
          ref={inputRef}
          className="search-input"
          placeholder="Search... (Ctrl+K)"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKey}
          onFocus={() => query && setOpen(true)}
        />
        {loading && <span className="search-spinner" />}
        {query && !loading && (
          <button className="search-clear" onClick={() => { setQuery(''); setResults([]); setOpen(false); }}>✕</button>
        )}
      </div>

      {open && (
        <div className="search-dropdown">
          {results.length === 0 ? (
            <div className="search-empty">No results for "{query}"</div>
          ) : (
            results.map((r, i) => (
              <button
                key={i}
                className="search-result"
                onClick={() => handleSelect(r)}
              >
                <span className="result-icon" style={{ color: TYPE_COLORS[r.type] }}>
                  {TYPE_ICONS[r.type]}
                </span>
                <div className="result-text">
                  <span className="result-title">{r.title}</span>
                  {r.subtitle && <span className="result-sub">{r.subtitle}</span>}
                </div>
                <span className="result-type">{r.type}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children, theme, setTheme }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // closed at all times unless hover/keyboard forces it open
  const [collapsed, setCollapsed] = useState(true);

  // if user explicitly expanded via Ctrl+K search, keep open until mouse leaves
  const [forceOpen, setForceOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Ctrl+1-9 navigation shortcuts
  useEffect(() => {
    const ROUTES = {
      '1': '/dashboard', '2': '/topics', '3': '/logs',
      '4': '/notes', '5': '/roadmaps', '6': '/goals',
      '7': '/resources', '8': '/analytics', '9': '/assistant',
    };
    const handler = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      const route = ROUTES[e.key];
      if (route) { e.preventDefault(); navigate(route); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]);

  const openSidebar = useCallback(() => {
    setCollapsed(false);
    setForceOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setForceOpen(false);
    setCollapsed(true);
  }, []);

  const handleSidebarEnter = () => {
    setCollapsed(false);
  };

  const handleSidebarLeave = () => {
    // always close when cursor leaves the sidebar area
    closeSidebar();
  };

  return (
    <div className="layout-root">
      <ShortcutsOverlay />

      {/* Invisible hover strip so user can open sidebar by moving cursor to the left edge */}
      <div
        className="sidebar-hover-strip"
        onMouseEnter={handleSidebarEnter}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''}`}
        onMouseEnter={handleSidebarEnter}
        onMouseLeave={handleSidebarLeave}
      >
        {/* Logo */}
        <div className="sidebar-logo">
          <span className="logo-icon">⬡</span>
          <span className="logo-text">DevTrack</span>
        </div>

        {/* Global search */}
        <GlobalSearch
          collapsed={collapsed}
          onExpand={openSidebar}
        />

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                // optional: keep collapsed behavior consistent after navigation
                // (leave as-is; it will collapse on mouse leave)
              }}
            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="sidebar-bottom">
          <button className="theme-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            <span className="nav-icon">{theme === 'dark' ? '☀' : '☾'}</span>
            <span className="nav-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>

          <div className="sidebar-user">
            <NavLink to="/profile" className="user-avatar" title="Your profile">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </NavLink>
            <div className="user-info">
              <span className="user-name">{user?.username}</span>
              <NavLink to="/profile" className="user-profile-link">
                Edit profile ↗
              </NavLink>
            </div>
          </div>

          <button className="logout-btn" onClick={handleLogout}>
            <span className="nav-icon">⎋</span>
            <span className="nav-label">Sign out</span>
          </button>

          <div className="sh-hint-row">
            <kbd className="sh-hint-key">Ctrl+/</kbd>
            <span className="nav-label sh-hint-text">Shortcuts</span>
          </div>
        </div>
      </aside>

      <main className="layout-main">
        {children}
      </main>

      <style>{`
        .layout-root {
          display: flex;
          min-height: 100vh;
          background: var(--bg);
          position: relative;
        }

        /* Hover strip that sits at the very left edge to trigger opening */
        .sidebar-hover-strip {
          position: fixed;
          left: 0;
          top: 0;
          height: 100vh;
          width: 10px;
          z-index: 9998;
          background: transparent;
        }

        .sidebar {
          width: 240px;
          min-height: 100vh;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
          flex-shrink: 0;
          transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1),
                      padding 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 9999;
        }

        .sidebar.collapsed {
          width: 68px;
          padding: 24px 10px;
        }

        .sidebar-logo,
        .nav-label,
        .user-info {
          transition: opacity 0.2s ease, max-width 0.25s ease;
          overflow: hidden;
          white-space: nowrap;
        }

        .sidebar.collapsed .nav-label,
        .sidebar.collapsed .user-info,
        .sidebar.collapsed .logo-text {
          opacity: 0;
          max-width: 0;
          pointer-events: none;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 8px;
          margin-bottom: 8px;
          overflow: hidden;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .logo-icon {
          font-size: 24px;
          color: #f97316;
          flex-shrink: 0;
        }

        .logo-text {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 18px;
          color: var(--text);
          letter-spacing: -0.5px;
          transition: opacity 0.2s ease, max-width 0.25s ease;
          overflow: hidden;
          white-space: nowrap;
          max-width: 160px;
        }

        /* Search */
        .search-wrap {
          position: relative;
          margin: 0 0 12px;
        }

        .search-input-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 10px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .search-wrap:focus-within .search-input-wrap {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .search-icon {
          font-size: 15px;
          color: var(--muted);
          flex-shrink: 0;
        }

        .search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-size: 13px;
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          min-width: 0;
        }

        .search-input::placeholder { color: var(--placeholder); }

        .search-spinner {
          width: 12px; height: 12px;
          border: 2px solid var(--border);
          border-top-color: #f97316;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
          flex-shrink: 0;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .search-clear {
          background: none; border: none;
          color: var(--muted); cursor: pointer;
          font-size: 11px; padding: 0;
          flex-shrink: 0; line-height: 1;
          transition: color 0.15s;
        }

        .search-clear:hover { color: var(--text); }

        .search-icon-btn {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--muted);
          cursor: pointer;
          font-size: 16px;
          padding: 8px;
          width: 100%;
          margin-bottom: 12px;
          transition: all 0.2s;
        }

        .search-icon-btn:hover {
          color: #f97316;
          border-color: #f97316;
        }

        .search-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0; right: 0;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 8px 32px var(--shadow);
          z-index: 9999;
          overflow: hidden;
          max-height: 320px;
          overflow-y: auto;
        }

        .search-empty {
          padding: 16px;
          font-size: 13px;
          color: var(--muted);
          text-align: center;
        }

        .search-result {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          background: none;
          border: none;
          border-bottom: 1px solid var(--border);
          padding: 10px 12px;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s;
          font-family: 'DM Sans', sans-serif;
        }

        .search-result:last-child { border-bottom: none; }
        .search-result:hover { background: var(--hover-bg); }

        .result-icon { font-size: 16px; flex-shrink: 0; }

        .result-text {
          flex: 1;
          display: flex; flex-direction: column;
          gap: 2px; min-width: 0;
        }

        .result-title {
          font-size: 13px; font-weight: 500;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .result-sub {
          font-size: 11px; color: var(--muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .result-type {
          font-size: 10px; font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }

        /* Nav */
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          min-height: 0;
        }

        .nav-item, .theme-btn, .logout-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          color: var(--muted);
          font-size: 14px;
          font-weight: 500;
          transition: all 0.18s;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-decoration: none;
          border: none;
          background: none;
          width: 100%;
          font-family: 'DM Sans', sans-serif;
        }

        .nav-item:hover, .theme-btn:hover { background: var(--hover-bg); color: var(--text); }
        .nav-item.active {
          background: rgba(249, 115, 22, 0.12);
          color: #f97316;
          font-weight: 600;
        }

        .nav-icon {
          font-size: 18px;
          flex-shrink: 0;
          width: 20px;
          text-align: center;
        }

        .nav-label { overflow: hidden; text-overflow: ellipsis; }

        .sidebar-bottom {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
          margin-top: 16px;
        }

        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          overflow: hidden;
        }

        .user-avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f97316, #fb923c);
          color: white;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700;
          flex-shrink: 0;
          font-family: 'Syne', sans-serif;
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .user-avatar:hover {
          transform: scale(1.08);
          box-shadow: 0 2px 8px rgba(249,115,22,0.4);
        }

        .user-info {
          display: flex; flex-direction: column;
          overflow: hidden; min-width: 0;
        }

        .user-name {
          font-size: 13px; font-weight: 600;
          color: var(--text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .user-profile-link {
          font-size: 11px; color: #f97316;
          text-decoration: none; font-weight: 500;
          transition: opacity 0.2s;
        }

        .user-profile-link:hover { opacity: 0.75; }

        .logout-btn { color: var(--muted); }
        .logout-btn:hover { background: var(--danger-bg); color: var(--danger-text); }

        .sh-hint-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; opacity: 0.5;
        }

        .sh-hint-key {
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--bg); border: 1px solid var(--border);
          border-bottom: 2px solid var(--border);
          border-radius: 5px; padding: 2px 7px;
          font-size: 11px; font-weight: 700;
          color: var(--muted); font-family: 'DM Sans', sans-serif;
          flex-shrink: 0;
        }

        .sh-hint-text { font-size: 12px; color: var(--muted); }

        .layout-main {
          flex: 1;
          min-height: 100vh;
          overflow: visible;
        }
      `}</style>
    </div>
  );
}