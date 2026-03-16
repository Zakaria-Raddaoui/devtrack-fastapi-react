import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/dashboard', icon: '⊡', label: 'Dashboard' },
  { to: '/topics',    icon: '◈', label: 'Topics'    },
  { to: '/logs',      icon: '◷', label: 'Logs'      },
  { to: '/resources', icon: '⊞', label: 'Resources' },
];

export default function Layout({ children, theme, setTheme }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout-root">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <span className="logo-icon">⬡</span>
          {!collapsed && <span className="logo-text">DevTrack</span>}
        </div>

        {/* Collapse toggle */}
        <button className="collapse-btn" onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '›' : '‹'}
        </button>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{icon}</span>
              {!collapsed && <span className="nav-label">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="sidebar-bottom">
          {/* Theme toggle */}
          <button className="theme-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            <span className="nav-icon">{theme === 'dark' ? '☀' : '☾'}</span>
            {!collapsed && <span className="nav-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          {/* User */}
          <div className="sidebar-user">
            <div className="user-avatar">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="user-info">
                <span className="user-name">{user?.username}</span>
                <span className="user-email">{user?.email}</span>
              </div>
            )}
          </div>

          {/* Logout */}
          <button className="logout-btn" onClick={handleLogout}>
            <span className="nav-icon">⎋</span>
            {!collapsed && <span className="nav-label">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="layout-main">
        {children}
      </main>

      <style>{`
        .layout-root {
          display: flex;
          min-height: 100vh;
          background: var(--bg);
        }

        .sidebar {
          width: 240px;
          min-height: 100vh;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
          flex-shrink: 0;
        }

        .sidebar.collapsed {
          width: 68px;
          padding: 24px 10px;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 8px;
          margin-bottom: 8px;
          overflow: hidden;
          white-space: nowrap;
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
        }

        .collapse-btn {
          background: none;
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--muted);
          cursor: pointer;
          font-size: 16px;
          padding: 4px 8px;
          margin: 8px 8px 16px;
          transition: all 0.2s;
          align-self: flex-end;
          width: calc(100% - 16px);
          text-align: center;
        }

        .collapse-btn:hover {
          background: var(--hover-bg);
          color: #f97316;
          border-color: #f97316;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
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

        .nav-item:hover, .theme-btn:hover, .logout-btn:hover {
          background: var(--hover-bg);
          color: var(--text);
        }

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

        .nav-label {
          overflow: hidden;
          text-overflow: ellipsis;
        }

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
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f97316, #fb923c);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
          font-family: 'Syne', sans-serif;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }

        .user-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-email {
          font-size: 11px;
          color: var(--muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .logout-btn {
          color: var(--muted);
        }

        .logout-btn:hover {
          background: var(--danger-bg);
          color: var(--danger-text);
        }

        .layout-main {
          flex: 1;
          overflow-y: auto;
          min-height: 100vh;
        }
      `}</style>
    </div>
  );
}