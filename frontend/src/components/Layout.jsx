import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import ShortcutsOverlay from './ShortcutsOverlay';
import QuickCapture from './QuickCaptureGlobal';
import StudySession from './StudySession';

const NAV = [
  { to: '/dashboard', icon: <IcoDashboard />, label: 'Dashboard' },
  { to: '/topics', icon: <IcoTopics />, label: 'Topics' },
  { to: '/logs', icon: <IcoLogs />, label: 'Logs' },
  { to: '/notes', icon: <IcoNotes />, label: 'Notes' },
  { to: '/roadmaps', icon: <IcoRoadmaps />, label: 'Roadmaps' },
  { to: '/goals', icon: <IcoGoals />, label: 'Goals' },
  { to: '/todos', icon: <IcoTodos />, label: 'To-do' },
  { to: '/resources', icon: <IcoResources />, label: 'Resources' },
  { to: '/analytics', icon: <IcoAnalytics />, label: 'Analytics' },
  { to: '/confidence', icon: <IcoConfidence />, label: 'Confidence' },
  { to: '/graph', icon: <IcoGraph />, label: 'Knowledge Graph' },
  { to: '/assistant', icon: <IcoAI />, label: 'AI Assistant' },
];

const TYPE_ICONS = { topic: '◈', log: '◷', resource: '⊞', note: '◇' };
const TYPE_COLORS = { topic: '#f97316', log: '#3b82f6', resource: '#22c55e', note: '#a855f7' };

// ─── SVG Icon set ─────────────────────────────────────────────────────────────

function IcoDashboard() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="7" height="7" rx="1.5" /><rect x="11" y="2" width="7" height="7" rx="1.5" /><rect x="2" y="11" width="7" height="7" rx="1.5" /><rect x="11" y="11" width="7" height="7" rx="1.5" /></svg>;
}
function IcoTopics() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="10,2 18,7 18,13 10,18 2,13 2,7" /></svg>;
}
function IcoLogs() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="8" /><polyline points="10,5 10,10 13,13" /></svg>;
}
function IcoNotes() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2z" /><line x1="7" y1="8" x2="13" y2="8" /><line x1="7" y1="11" x2="13" y2="11" /><line x1="7" y1="14" x2="10" y2="14" /></svg>;
}
function IcoRoadmaps() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="5" r="2" /><circle cx="15" cy="10" r="2" /><circle cx="5" cy="15" r="2" /><path d="M7 5h4a2 2 0 012 2v1M7 15h4a2 2 0 000-4h-1" /></svg>;
}
function IcoGoals() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="8" /><circle cx="10" cy="10" r="4" /><circle cx="10" cy="10" r="1" fill="currentColor" /></svg>;
}
function IcoTodos() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="14" height="14" rx="2" /><polyline points="6,7 7.5,8.5 10,6" /><line x1="11" y1="7" x2="14" y2="7" /><polyline points="6,11 7.5,12.5 10,10" /><line x1="11" y1="11" x2="14" y2="11" /></svg>;
}
function IcoResources() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4a1 1 0 011-1h5l2 2h5a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" /></svg>;
}
function IcoAnalytics() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="17" x2="7" y2="11" /><line x1="7" y1="11" x2="10" y2="14" /><line x1="10" y1="14" x2="13" y2="7" /><line x1="13" y1="7" x2="17" y2="3" /><line x1="3" y1="17" x2="17" y2="17" /></svg>;
}
function IcoGraph() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="2" /><circle cx="4" cy="5" r="2" /><circle cx="16" cy="5" r="2" /><circle cx="4" cy="15" r="2" /><circle cx="16" cy="15" r="2" /><line x1="6" y1="6" x2="8" y2="9" /><line x1="14" y1="6" x2="12" y2="9" /><line x1="6" y1="14" x2="8" y2="11" /><line x1="14" y1="14" x2="12" y2="11" /></svg>;
}
function IcoAI() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2c-4.4 0-8 2.9-8 7 0 2.3 1.2 4.3 3 5.6V17l3-1.5c.6.1 1.3.2 2 .2 4.4 0 8-2.9 8-7s-3.6-7-8-7z" /><line x1="7" y1="9" x2="7" y2="9" strokeWidth="2" strokeLinecap="round" /><line x1="10" y1="9" x2="10" y2="9" strokeWidth="2" strokeLinecap="round" /><line x1="13" y1="9" x2="13" y2="9" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function IcoConfidence() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="8" /><path d="M7 10l2 2 4-4" /><circle cx="10" cy="10" r="4" strokeDasharray="3 2" /></svg>;
}

// ─── Search ───────────────────────────────────────────────────────────────────

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
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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
    setQuery(''); setResults([]); setOpen(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (collapsed) { onExpand(); setTimeout(() => inputRef.current?.focus(), 280); }
        else inputRef.current?.focus();
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
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="sb-ico"><circle cx="9" cy="9" r="6" /><line x1="13.5" y1="13.5" x2="17" y2="17" /></svg>
      </button>
    );
  }

  return (
    <div className="search-wrap" ref={containerRef}>
      <div className="search-input-wrap">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="sb-ico search-ico"><circle cx="9" cy="9" r="6" /><line x1="13.5" y1="13.5" x2="17" y2="17" /></svg>
        <input
          ref={inputRef}
          className="search-input"
          placeholder="Search… (Ctrl+K)"
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
          ) : results.map((r, i) => (
            <button key={i} className="search-result" onClick={() => handleSelect(r)}>
              <span className="result-icon" style={{ color: TYPE_COLORS[r.type] }}>{TYPE_ICONS[r.type]}</span>
              <div className="result-text">
                <span className="result-title">{r.title}</span>
                {r.subtitle && <span className="result-sub">{r.subtitle}</span>}
              </div>
              <span className="result-type">{r.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function Layout({ children, theme, setTheme }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(true);
  const [showCapture, setShowCapture] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [sessionTopics, setSessionTopics] = useState([]);

  const handleLogout = () => { logout(); navigate('/login'); };

  useEffect(() => {
    const ROUTES = {
      '1': '/dashboard', '2': '/topics', '3': '/logs',
      '4': '/notes', '5': '/roadmaps', '6': '/goals',
      '7': '/resources', '8': '/analytics', '9': '/assistant', '0': '/graph',
    };
    const handler = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.shiftKey && e.key === 'V') { e.preventDefault(); setShowCapture(s => !s); return; }
      if (e.shiftKey && e.key === 'S') { e.preventDefault(); openStudySession(); return; }
      if (e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); navigate('/confidence'); return; }
      if (e.altKey && e.key.toLowerCase() === 't') { e.preventDefault(); navigate('/goals'); return; }
      const route = ROUTES[e.key];
      if (route && !e.shiftKey) { e.preventDefault(); navigate(route); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSidebar = useCallback(() => setCollapsed(false), []);

  const toggleSidebar = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const openStudySession = useCallback(async () => {
    try { const res = await api.get('/topics/?limit=100'); setSessionTopics(res.data); }
    catch (_) { setSessionTopics([]); }
    setShowSession(true);
  }, []);

  return (
    <div className="layout-root">
      <ShortcutsOverlay />
      <QuickCapture open={showCapture} onClose={() => setShowCapture(false)} />
      {showSession && <StudySession topics={sessionTopics} onClose={() => setShowSession(false)} />}

      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''}`}
      >
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L22 7V12C22 16.4 17.6 20.5 12 22C6.4 20.5 2 16.4 2 12V7L12 2Z" fill="#f97316" opacity="0.9" /><path d="M8 12l2.5 2.5L16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span className="logo-text">DevTrack</span>
          <button
            className={`sb-collapse-toggle ${collapsed ? '' : 'open'}`}
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
            title={collapsed ? 'Open sidebar' : 'Close sidebar'}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? (
                <>
                  <polyline points="7,4 13,10 7,16" />
                </>
              ) : (
                <>
                  <polyline points="13,4 7,10 13,16" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Search */}
        <GlobalSearch collapsed={collapsed} onExpand={openSidebar} />

        {/* Main nav */}
        <nav className="sidebar-nav">
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="sidebar-bottom">

          {/* Action buttons row */}
          <div className="sb-actions">
            <button
              className="sb-action-btn"
              onClick={() => setShowCapture(true)}
              title="Quick Capture (Ctrl+Shift+V)"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="sb-ico"><circle cx="10" cy="10" r="2" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" /></svg>
              <span className="nav-label">Quick Capture</span>
            </button>
            <button
              className="sb-action-btn session"
              onClick={openStudySession}
              title="Study Session (Ctrl+Shift+S)"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="sb-ico"><circle cx="10" cy="10" r="8" /><polyline points="10,5 10,10 13,13" /></svg>
              <span className="nav-label">Study Session</span>
            </button>
          </div>

          <div className="sb-divider" />

          {/* User row */}
          <NavLink to="/profile" className="sb-user">
            <div className="sb-avatar">{user?.username?.[0]?.toUpperCase() || 'U'}</div>
            <div className="sb-user-info">
              <span className="sb-username">{user?.username}</span>
              <span className="sb-user-sub">View profile</span>
            </div>
          </NavLink>

          {/* Footer row: theme + signout */}
          <div className="sb-footer-row">
            <button
              className="sb-icon-action"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="sb-ico"><circle cx="10" cy="10" r="4" /><line x1="10" y1="2" x2="10" y2="4" /><line x1="10" y1="16" x2="10" y2="18" /><line x1="2" y1="10" x2="4" y2="10" /><line x1="16" y1="10" x2="18" y2="10" /><line x1="4.2" y1="4.2" x2="5.6" y2="5.6" /><line x1="14.4" y1="14.4" x2="15.8" y2="15.8" /><line x1="4.2" y1="15.8" x2="5.6" y2="14.4" /><line x1="14.4" y1="5.6" x2="15.8" y2="4.2" /></svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="sb-ico"><path d="M17 11a7 7 0 11-8-8 5.5 5.5 0 008 8z" /></svg>
              )}
              <span className="nav-label sb-footer-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>

            <button className="sb-icon-action danger" onClick={handleLogout} aria-label="Sign out" title="Sign out">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="sb-ico"><path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3M13 14l4-4-4-4M17 10H7" /></svg>
              <span className="nav-label sb-footer-label">Sign out</span>
            </button>
          </div>

          <div className="sb-shortcut-hint">
            <kbd>Ctrl+/</kbd>
            <span className="nav-label">Shortcuts</span>
          </div>
        </div>
      </aside>

      <main className="layout-main">{children}</main>

      <style>{`
        /* ── Base ── */
        .layout-root {
          display: flex; min-height: 100vh;
          background: var(--bg); position: relative;
        }

        /* ── Sidebar shell ── */
        .sidebar {
          width: 248px; height: 100vh;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          padding: 20px 12px 16px;
          position: sticky; top: 0; left: 0;
          overflow: hidden; flex-shrink: 0;
          transition: width 0.3s cubic-bezier(0.16,1,0.3,1),
                      padding 0.3s cubic-bezier(0.16,1,0.3,1);
          z-index: 100;
        }

        .sidebar.collapsed { width: 72px; padding: 20px 14px 16px; }

        /* ── Logo ── */
        .sidebar-logo {
          display: flex; align-items: center; gap: 10px;
          padding: 0 6px 0 2px; margin-bottom: 24px; flex-shrink: 0;
          white-space: nowrap; position: relative;
        }

        .sidebar.collapsed .sidebar-logo {
          flex-direction: column; 
          align-items: center;
          padding: 0;
          gap: 16px;
        }

        .sb-collapse-toggle {
          margin-left: auto;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px; border: 1px solid var(--border);
          background: var(--input-bg); color: var(--muted);
          cursor: pointer; transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
          flex-shrink: 0;
        }

        .sidebar.collapsed .sb-collapse-toggle {
          margin-left: 0;
          width: 36px; height: 36px;
          border-radius: 10px;
        }

        .sb-collapse-toggle svg { width: 14px; height: 14px; }

        .sb-collapse-toggle:hover {
          color: #f97316;
          border-color: rgba(249,115,22,0.45);
          background: rgba(249,115,22,0.06);
          transform: scale(1.05);
        }

        .sb-collapse-toggle.open {
          color: #f97316;
          border-color: rgba(249,115,22,0.35);
        }

        .sidebar.collapsed .logo-text {
          display: none;
        }
        .logo-mark {
          width: 32px; height: 32px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }

        .logo-mark svg { width: 28px; height: 28px; }

        .logo-text {var(--font-heading); font-weight: 800;
          font-size: 19px; color: var(--text); letter-spacing: -0.5px;
          transition: opacity 0.18s ease, max-width 0.22s ease;
          overflow: hidden; white-space: nowrap; max-width: 160px;
        }

        .sidebar.collapsed .logo-text { opacity: 0; max-width: 0; pointer-events: none; }

        /* ── Search ── */
        .search-wrap { position: relative; margin: 0 0 16px; }

        .search-input-wrap {
          display: flex; align-items: center; gap: 8px;
          background: var(--input-bg); border: 1px solid transparent;
          border-radius: 10px; padding: 10px 12px;
          transition: all 0.2s ease;
        }

        .search-wrap:focus-within .search-input-wrap {
          border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
          background: var(--card-bg);
        }

        .sb-ico {
          width: 18px; height: 18px; flex-shrink: 0;
        }

        .search-ico { color: var(--muted); }

        .search-input {
          flex: 1; background: none; border: none; outline: none;
          font-size: 14px; color: var(--text);
          font-family: var(--font-body); font-weight: 500);
          font-family: var(--font-body); min-width: 0;
        }

        .search-input::placeholder { color: var(--placeholder); }

        .search-spinner {
          width: 11px; height: 11px; border: 1.5px solid var(--border);
          border-top-color: #f97316; border-radius: 50%;
          animation: spin 0.7s linear infinite; display: inline-block; flex-shrink: 0;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .search-clear {
          background: none; border: none; color: var(--muted);
          cursor: pointer; font-size: 10px; padding: 0; flex-shrink: 0;
          line-height: 1; transition: color 0.15s;
        }

        .search-clear:hover { color: var(--text); }

        .search-icon-btn {
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 9px; color: var(--muted); cursor: pointer;
          padding: 9px; width: 100%; margin-bottom: 10px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }

        .search-icon-btn:hover { color: #f97316; border-color: rgba(249,115,22,0.4); }

        .search-dropdown {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.25);
          z-index: 9999; overflow: hidden; max-height: 300px; overflow-y: auto;
        }

        .search-empty { padding: 14px; font-size: 13px; color: var(--muted); text-align: center; }

        .search-result {
          display: flex; align-items: center; gap: 10px; width: 100%;
          background: none; border: none; border-bottom: 1px solid var(--border);
          padding: 9px 12px; cursor: pointer; text-align: left;
          transition: background 0.12s; font-family: var(--font-body);
        }

        .search-result:last-child { border-bottom: none; }
        .search-result:hover { background: var(--hover-bg); }
        .result-icon { font-size: 15px; flex-shrink: 0; }
        .result-text { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .result-title { font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .result-sub { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .result-type { font-size: 9px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; flex-shrink: 0; }

        /* ── Nav items ── */
        .sidebar-nav {
          display: flex; flex-direction: column; gap: 1px;
          flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0;
        }

        .nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: 8px;
          color: var(--muted); font-size: 13.5px; font-weight: 500;
          transition: all 0.15s; cursor: pointer; white-space: nowrap;
          overflow: hidden; text-decoration: none;
        }

        .nav-item:hover { background: var(--hover-bg); color: var(--text); }

        .nav-item.active {
          background: rgba(249,115,22,0.1);
          color: #f97316; font-weight: 600;
        }

        .nav-item.active .nav-icon svg { stroke: #f97316; }

        .nav-icon {
          width: 18px; height: 18px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }

        .nav-icon svg { width: 17px; height: 17px; }

        .nav-label {
          overflow: hidden; text-overflow: ellipsis;
          transition: opacity 0.18s ease, max-width 0.22s ease;
          white-space: nowrap;
        }

        .sidebar.collapsed .nav-label {
          opacity: 0; max-width: 0; pointer-events: none;
        }

        /* ── Bottom section ── */
        .sidebar-bottom {
          display: flex; flex-direction: column; gap: 2px;
          padding-top: 12px; flex-shrink: 0;
        }

        /* Action buttons */
        .sb-actions {
          display: flex; flex-direction: column; gap: 1px;
          margin-bottom: 4px;
        }

        .sb-action-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: 8px;
          background: none; border: none;
          color: var(--muted); font-size: 13.5px; font-weight: 500;
          cursor: pointer; font-family: var(--font-body);
          transition: all 0.15s; white-space: nowrap; overflow: hidden; width: 100%;
          text-align: left;
        }

        .sb-action-btn:hover {
          background: rgba(249,115,22,0.08);
          color: #f97316;
        }

        .sb-action-btn:hover svg { stroke: #f97316; }

        .sb-action-btn.session:hover {
          background: rgba(34,197,94,0.08);
          color: #22c55e;
        }

        .sb-action-btn.session:hover svg { stroke: #22c55e; }

        .sb-divider {
          height: 1px; background: var(--border);
          margin: 6px 4px; flex-shrink: 0;
        }

        /* User row */
        .sb-user {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 8px;
          text-decoration: none; transition: background 0.15s;
          overflow: hidden;
        }

        .sb-user:hover { background: var(--hover-bg); }

        .sb-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg, #f97316, #fb923c);
          color: white; display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; flex-shrink: 0;
          font-family: var(--font-heading);
        }

        .sb-user-info {
          display: flex; flex-direction: column; overflow: hidden; min-width: 0;
          transition: opacity 0.18s ease, max-width 0.22s ease;
          white-space: nowrap; max-width: 160px;
        }

        .sidebar.collapsed .sb-user-info { opacity: 0; max-width: 0; pointer-events: none; }

        .sb-username {
          font-size: 13px; font-weight: 600; color: var(--text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .sb-user-sub {
          font-size: 11px; color: var(--muted);
        }

        /* Footer row */
        .sb-footer-row {
          display: flex; align-items: center; gap: 4px;
        }

        .sb-icon-action {
          display: flex; align-items: center; gap: 10px;
          flex: 1; min-height: 34px; padding: 8px 10px; border-radius: 8px;
          background: none; border: none;
          color: var(--muted); font-size: 13px; font-weight: 500;
          cursor: pointer; font-family: var(--font-body);
          transition: all 0.15s; white-space: nowrap; overflow: hidden;
          text-align: left;
        }

        .sb-icon-action:hover { background: var(--hover-bg); color: var(--text); }
        .sb-icon-action:hover svg { stroke: var(--text); }
        .sb-icon-action.danger:hover { background: var(--danger-bg); color: var(--danger-text); }
        .sb-icon-action.danger:hover svg { stroke: var(--danger-text); }

        .sb-footer-label {
          font-size: 13px !important;
        }

        .sidebar.collapsed .sb-footer-row {
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
        }

        .sidebar.collapsed .sb-icon-action {
          justify-content: center;
          flex: none;
          width: 100%;
          padding: 8px;
        }

        /* Shortcut hint */
        .sb-shortcut-hint {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 10px; opacity: 0.4; margin-top: 2px;
        }

        .sidebar.collapsed .sb-shortcut-hint {
          justify-content: center;
          padding: 6px 0;
        }

        .sb-shortcut-hint kbd {
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--bg); border: 1px solid var(--border);
          border-bottom: 2px solid var(--border); border-radius: 4px;
          padding: 1px 6px; font-size: 10px; font-weight: 700;
          color: var(--muted); font-family: var(--font-body); flex-shrink: 0;
        }

        .sb-shortcut-hint .nav-label { font-size: 11px !important; color: var(--muted); }

        /* ── Main content ── */
        .layout-main {
          flex: 1; min-height: 100vh; overflow: visible;
          margin-left: 60px;
          transition: margin-left 0.22s cubic-bezier(0.16,1,0.3,1);
        }
      `}</style>
    </div>
  );
}
