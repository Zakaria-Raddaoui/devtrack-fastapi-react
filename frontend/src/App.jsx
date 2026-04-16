import React, { useState, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Topics from './pages/Topics';
import TopicDetail from './pages/TopicDetail';
import Logs from './pages/Logs';
import Notes from './pages/Notes';
import Roadmaps from './pages/Roadmaps';
import Goals from './pages/Goals';
import Todos from './pages/Todos';
import Resources from './pages/Resources';
import Analytics from './pages/Analytics';
import Assistant from './pages/Assistant';
import Profile from './pages/Profile';
import KnowledgeGraph from './pages/KnowledgeGraph';
import Confidence from './pages/Confidence';
import PublicProfile from './pages/PublicProfile';

function ProtectedRoute({ children, theme, setTheme }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout theme={theme} setTheme={setTheme}>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Dashboard /></ProtectedRoute>} />
      <Route path="/topics/:id" element={<ProtectedRoute theme={theme} setTheme={setTheme}><TopicDetail /></ProtectedRoute>} />
      <Route path="/topics" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Topics /></ProtectedRoute>} />
      <Route path="/logs" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Logs /></ProtectedRoute>} />
      <Route path="/notes" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Notes /></ProtectedRoute>} />
      <Route path="/roadmaps" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Roadmaps /></ProtectedRoute>} />
      <Route path="/goals" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Goals /></ProtectedRoute>} />
      <Route path="/todos" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Todos /></ProtectedRoute>} />
      <Route path="/resources" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Resources /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Analytics /></ProtectedRoute>} />
      <Route path="/assistant" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Assistant /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Profile /></ProtectedRoute>} />
      <Route path="/graph" element={<ProtectedRoute theme={theme} setTheme={setTheme}><KnowledgeGraph /></ProtectedRoute>} />
      <Route path="/confidence" element={<ProtectedRoute theme={theme} setTheme={setTheme}><Confidence /></ProtectedRoute>} />
      <Route path="/u/:username" element={<PublicProfile />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const Router = isFileProtocol ? HashRouter : BrowserRouter;

  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}