import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(form.username, form.password);
        navigate('/dashboard');
      } else {
        await api.post('/auth/register', {
          username: form.username,
          email: form.email,
          password: form.password,
        });
        await login(form.username, form.password);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-bg">
        <div className="orb orb1" />
        <div className="orb orb2" />
        <div className="grid-overlay" />
      </div>

      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-icon">⬡</span>
          <span className="logo-text">DevTrack</span>
        </div>

        <h1 className="auth-title">
          {isLogin ? 'Welcome back' : 'Start tracking'}
        </h1>
        <p className="auth-sub">
          {isLogin
            ? 'Log in to continue your learning journey'
            : 'Create your account and start growing'}
        </p>

        <form onSubmit={submit} className="auth-form">
          <div className="field">
            <label>Username</label>
            <input
              name="username"
              value={form.username}
              onChange={handle}
              placeholder="zakaria"
              required
              autoComplete="username"
            />
          </div>

          {!isLogin && (
            <div className="field">
              <label>Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handle}
                placeholder="you@example.com"
                required
              />
            </div>
          )}

          <div className="field">
            <label>Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handle}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : (isLogin ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }}>
            {isLogin ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        .auth-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg);
          font-family: var(--font-body);
          position: relative;
          overflow: hidden;
        }

        .auth-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
        }

        .orb1 {
          width: 500px; height: 500px;
          background: #f97316;
          top: -100px; left: -100px;
          animation: drift 8s ease-in-out infinite alternate;
        }

        .orb2 {
          width: 400px; height: 400px;
          background: #fb923c;
          bottom: -80px; right: -80px;
          animation: drift 10s ease-in-out infinite alternate-reverse;
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(var(--grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
          background-size: 48px 48px;
          opacity: 0.4;
        }

        @keyframes drift {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(40px, 30px) scale(1.1); }
        }

        .auth-card {
          position: relative;
          z-index: 1;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 48px 44px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 32px 80px var(--shadow);
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .auth-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 32px;
        }

        .logo-icon {
          font-size: 28px;
          color: #f97316;
          line-height: 1;
        }

        .logo-text {
          font-family: var(--font-heading);
          font-weight: 800;
          font-size: 22px;
          color: var(--text);
          letter-spacing: -0.5px;
        }

        .auth-title {
          font-family: var(--font-heading);
          font-weight: 700;
          font-size: 28px;
          color: var(--text);
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }

        .auth-sub {
          font-size: 14px;
          color: var(--muted);
          margin: 0 0 32px;
          line-height: 1.5;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field label {
          font-size: 13px;
          font-weight: 500;
          color: var(--muted);
          letter-spacing: 0.3px;
        }

        .field input {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 15px;
          color: var(--text);
          font-family: var(--font-body);
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }

        .field input:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
        }

        .field input::placeholder { color: var(--placeholder); }

        .auth-error {
          font-size: 13px;
          color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          padding: 10px 14px;
          margin: 0;
        }

        .auth-btn {
          background: #f97316;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 13px;
          font-size: 15px;
          font-weight: 600;
          font-family: var(--font-body);
          cursor: pointer;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          margin-top: 4px;
          box-shadow: 0 4px 20px rgba(249, 115, 22, 0.35);
        }

        .auth-btn:hover:not(:disabled) {
          background: #ea6c0a;
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(249, 115, 22, 0.45);
        }

        .auth-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .auth-switch {
          text-align: center;
          font-size: 13px;
          color: var(--muted);
          margin: 24px 0 0;
        }

        .auth-switch button {
          background: none;
          border: none;
          color: #f97316;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
          font-family: var(--font-body);
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      `}</style>
    </div>
  );
}
