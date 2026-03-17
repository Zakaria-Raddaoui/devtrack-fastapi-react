import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Topics from './pages/Topics';
import Logs from './pages/Logs';
import Resources from './pages/Resources';
import PublicProfile from './pages/PublicProfile';

function ProtectedRoute({ children, theme, setTheme }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', color: 'var(--muted)', fontFamily: 'DM Sans,sans-serif', fontSize: 14
    }}>
      Loading...
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Layout theme={theme} setTheme={setTheme}>{children}</Layout>;
}

function AppRoutes({ theme, setTheme }) {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Dashboard /></ProtectedRoute>} />
      <Route path="/topics" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Topics /></ProtectedRoute>} />
      <Route path="/logs" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Logs /></ProtectedRoute>} />
      <Route path="/resources" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Resources /></ProtectedRoute>} />
      <Route path="/u/:username" element={<PublicProfile />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes theme={theme} setTheme={setTheme} />
      </AuthProvider>
    </BrowserRouter>
  );
}