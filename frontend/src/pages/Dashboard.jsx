import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import QuickCapture from '../components/QuickCapture';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function computeStreak(logs) {
  if (!logs.length) return 0;
  const days = new Set(logs.map(l => {
    const d = new Date(l.date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (days.has(key)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function computePace(logs) {
  if (logs.length < 2) return null;
  const days = new Set(logs.map(l => {
    const d = new Date(l.date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));
  const sorted = [...days].sort();
  const first = new Date(sorted[0]);
  const last = new Date(sorted[sorted.length - 1]);
  const totalDays = Math.max(1, (last - first) / (1000 * 60 * 60 * 24) + 1);
  return (days.size / totalDays * 7).toFixed(1);
}

function todayMinutes(logs) {
  const today = new Date();
  return logs
    .filter(l => {
      const d = new Date(l.date);
      return d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
    })
    .reduce((s, l) => s + l.time_spent, 0);
}

// ─── Quick Log Modal ──────────────────────────────────────────────────────────

function QuickLogModal({ topics, defaultTopic, onClose, onSaved }) {
  const [form, setForm] = useState({
    topic_id: defaultTopic || '',
    notes: '',
    time_spent: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/logs/', {
        topic_id: parseInt(form.topic_id),
        notes: form.notes,
        time_spent: parseInt(form.time_spent),
        date: form.date,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save log');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="db-overlay" onClick={onClose}>
      <div className="db-modal" onClick={e => e.stopPropagation()}>
        <div className="db-modal-header">
          <h2>Quick log</h2>
          <button className="db-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="db-modal-form">
          <div className="db-field">
            <label>Topic</label>
            <select name="topic_id" value={form.topic_id} onChange={handle} required>
              <option value="">Select a topic...</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="db-field">
            <label>What did you learn?</label>
            <textarea name="notes" value={form.notes} onChange={handle}
              placeholder="Today I learned..." required rows={3} />
          </div>
          <div className="db-field-row">
            <div className="db-field">
              <label>Time spent (min)</label>
              <input type="number" name="time_spent" value={form.time_spent}
                onChange={handle} placeholder="e.g. 45" min={1} required />
            </div>
            <div className="db-field">
              <label>Date</label>
              <input type="date" name="date" value={form.date} onChange={handle} required />
            </div>
          </div>
          {error && <p className="db-form-error">{error}</p>}
          <button type="submit" className="db-submit" disabled={loading}>
            {loading ? <span className="db-spinner" /> : 'Save log'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Streak ring ─────────────────────────────────────────────────────────────

function DailyRing({ minutes, goal = 60 }) {
  const pct = Math.min(100, Math.round((minutes / goal) * 100));
  const r = 28;
  const circ = 2 * Math.PI * r;
  const color = pct >= 100 ? '#22c55e' : pct >= 60 ? '#f97316' : '#3b82f6';
  const hrs = (minutes / 60).toFixed(1);

  return (
    <div className="db-ring-wrap">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="db-ring-center">
        <span className="db-ring-val" style={{ color }}>{hrs}h</span>
        <span className="db-ring-label">today</span>
      </div>
    </div>
  );
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="db-tooltip">
        <p className="db-tooltip-label">{label}</p>
        <p className="db-tooltip-val">{payload[0].value}h</p>
      </div>
    );
  }
  return null;
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [topics, setTopics] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [defaultTopic, setDefaultTopic] = useState('');
  const [showCapture, setShowCapture] = useState(false);

  const fetchData = async () => {
    try {
      const [statsRes, topicsRes, logsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/topics/?limit=100'),
        api.get('/logs/'),
      ]);
      setStats(statsRes.data);
      setTopics(topicsRes.data);
      setLogs(logsRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return (
    <div className="db-loading"><div className="db-ring-spinner" /></div>
  );

  // Derived data
  const streak = computeStreak(logs);
  const pace = computePace(logs);
  const todayMins = todayMinutes(logs);
  const weekHours = (stats?.weekly_activity || []).reduce((s, d) => s + d.hours, 0).toFixed(1);

  // Chart data
  const chartData = (stats?.weekly_activity || []).map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    hours: d.hours,
  }));

  // Top topics by hours
  const topicMinutes = logs.reduce((acc, l) => {
    if (l.topic_id) acc[l.topic_id] = (acc[l.topic_id] || 0) + l.time_spent;
    return acc;
  }, {});

  const topTopics = topics
    .map(t => ({ name: t.title, hours: parseFloat(((topicMinutes[t.id] || 0) / 60).toFixed(1)) }))
    .filter(t => t.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5);

  // Recent logs
  const recentLogs = [...logs]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  // Last topic (continue where you left off)
  const lastLog = recentLogs[0];
  const lastTopic = lastLog ? topics.find(t => t.id === lastLog.topic_id) : null;

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const TOPIC_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899'];

  return (
    <div className="db-root">

      {/* ── Header ── */}
      <div className="db-header">
        <div className="db-header-left">
          <h1 className="db-greeting">
            {greeting}, <span className="db-name">{user?.username}</span> 👋
          </h1>
          <p className="db-sub">
            {streak > 0
              ? `🔥 ${streak}-day streak — keep it going!`
              : 'Start logging today to build your streak'}
          </p>
        </div>
        <div className="db-header-right">
          <DailyRing minutes={todayMins} />
          <button className="db-capture-btn" onClick={() => setShowCapture(true)} title="Paste a URL to auto-log">
            ⚡ Quick Capture
          </button>
          <button className="db-primary-btn" onClick={() => { setDefaultTopic(''); setShowModal(true); }}>
            <span>+</span> Quick log
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="db-stats-grid">
        <div className="db-stat-card" style={{ '--accent': '#f97316' }}>
          <div className="db-stat-icon">⏱</div>
          <div className="db-stat-body">
            <p className="db-stat-val">{stats?.total_hours ?? 0}h</p>
            <p className="db-stat-label">Total hours</p>
          </div>
        </div>
        <div className="db-stat-card" style={{ '--accent': '#3b82f6' }}>
          <div className="db-stat-icon">◑</div>
          <div className="db-stat-body">
            <p className="db-stat-val">{stats?.topics_in_progress ?? 0}</p>
            <p className="db-stat-label">In progress</p>
          </div>
        </div>
        <div className="db-stat-card" style={{ '--accent': '#22c55e' }}>
          <div className="db-stat-icon">✓</div>
          <div className="db-stat-body">
            <p className="db-stat-val">{stats?.topics_mastered ?? 0}</p>
            <p className="db-stat-label">Mastered</p>
          </div>
        </div>
        <div className="db-stat-card" style={{ '--accent': '#a855f7' }}>
          <div className="db-stat-icon">📅</div>
          <div className="db-stat-body">
            <p className="db-stat-val">{weekHours}h</p>
            <p className="db-stat-label">This week</p>
          </div>
        </div>
        <div className="db-stat-card" style={{ '--accent': '#f97316' }}>
          <div className="db-stat-icon">🔥</div>
          <div className="db-stat-body">
            <p className="db-stat-val">{streak}</p>
            <p className="db-stat-label">Day streak</p>
          </div>
        </div>
        {pace && (
          <div className="db-stat-card" style={{ '--accent': '#ec4899' }}>
            <div className="db-stat-icon">⚡</div>
            <div className="db-stat-body">
              <p className="db-stat-val">{pace}</p>
              <p className="db-stat-label">Days/week avg</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Continue + Recent logs ── */}
      <div className="db-row">

        {/* Continue where you left off */}
        {lastTopic && (
          <div className="db-continue-card">
            <p className="db-card-title">Continue where you left off</p>
            <div className="db-continue-body">
              <div className="db-continue-info">
                <span className="db-continue-name">{lastTopic.title}</span>
                <span className="db-continue-meta">
                  Last logged {timeAgo(lastLog.date)} ·{' '}
                  {lastTopic.status === 'learning' ? '◑ In progress' : lastTopic.status === 'mastered' ? '● Mastered' : '○ To learn'}
                </span>
                {lastLog.notes && (
                  <p className="db-continue-notes">
                    "{lastLog.notes.slice(0, 100)}{lastLog.notes.length > 100 ? '...' : ''}"
                  </p>
                )}
              </div>
              <button
                className="db-continue-btn"
                onClick={() => { setDefaultTopic(lastTopic.id); setShowModal(true); }}
              >
                Log session →
              </button>
            </div>
          </div>
        )}

        {/* Recent logs */}
        <div className="db-recent-card">
          <div className="db-card-header">
            <p className="db-card-title">Recent logs</p>
            <span className="db-card-meta">{logs.length} total</span>
          </div>
          {recentLogs.length === 0 ? (
            <div className="db-card-empty">No logs yet — start your first session!</div>
          ) : (
            <div className="db-recent-list">
              {recentLogs.map(log => {
                const topic = topics.find(t => t.id === log.topic_id);
                const h = Math.floor(log.time_spent / 60);
                const m = log.time_spent % 60;
                const timeLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;
                return (
                  <div key={log.id} className="db-recent-item">
                    <div className="db-recent-dot" />
                    <div className="db-recent-body">
                      <div className="db-recent-top">
                        <span className="db-recent-topic">{topic?.title || 'Unknown'}</span>
                        <span className="db-recent-time">◷ {timeLabel}</span>
                      </div>
                      <p className="db-recent-notes">
                        {log.notes.slice(0, 80)}{log.notes.length > 80 ? '...' : ''}
                      </p>
                      <span className="db-recent-ago">{timeAgo(log.date)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Chart + Top topics ── */}
      <div className="db-row">

        {/* Activity chart */}
        <div className="db-chart-card">
          <div className="db-card-header">
            <p className="db-card-title">Weekly activity</p>
            <span className="db-badge">{weekHours}h this week</span>
          </div>
          {chartData.length === 0 ? (
            <div className="db-card-empty">No activity yet — log your first session!</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="dbGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="hours" stroke="#f97316" strokeWidth={2.5}
                  fill="url(#dbGrad)"
                  dot={{ fill: '#f97316', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#f97316', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top topics bar chart */}
        {topTopics.length > 0 && (
          <div className="db-topics-card">
            <div className="db-card-header">
              <p className="db-card-title">Most time invested</p>
              <span className="db-card-meta">by hours</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topTopics} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={90}
                  tick={{ fontSize: 11, fill: 'var(--text)', fontWeight: 500 }}
                  axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--hover-bg)' }}
                  content={({ active, payload }) => active && payload?.length ? (
                    <div className="db-tooltip">
                      <p className="db-tooltip-label">{payload[0].payload.name}</p>
                      <p className="db-tooltip-val">{payload[0].value}h</p>
                    </div>
                  ) : null}
                />
                <Bar dataKey="hours" radius={[0, 6, 6, 0]} maxBarSize={18}>
                  {topTopics.map((_, i) => (
                    <Cell key={i} fill={TOPIC_COLORS[i % TOPIC_COLORS.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Pace card ── */}
      {pace && (
        <div className="db-pace-card">
          <div className="db-pace-left">
            <span className="db-pace-icon">⚡</span>
            <div>
              <p className="db-pace-title">Learning pace</p>
              <p className="db-pace-sub">Based on all your logs</p>
            </div>
          </div>
          <div className="db-pace-stats">
            <div className="db-pace-stat">
              <span className="db-pace-val" style={{ color: '#f97316' }}>{pace}</span>
              <span className="db-pace-label">days/week</span>
            </div>
            <div className="db-pace-divider" />
            <div className="db-pace-stat">
              <span className="db-pace-val" style={{ color: '#3b82f6' }}>{streak}</span>
              <span className="db-pace-label">current streak</span>
            </div>
            <div className="db-pace-divider" />
            <div className="db-pace-stat">
              <span className="db-pace-val" style={{ color: '#22c55e' }}>{logs.length}</span>
              <span className="db-pace-label">total sessions</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <QuickLogModal
          topics={topics}
          defaultTopic={defaultTopic}
          onClose={() => setShowModal(false)}
          onSaved={fetchData}
        />
      )}

      {showCapture && (
        <QuickCapture
          topics={topics}
          onClose={() => setShowCapture(false)}
          onSaved={() => { setShowCapture(false); fetchData(); }}
        />
      )}

      <style>{`
        .db-root {
          padding: 40px 44px; width: 100%;
          box-sizing: border-box;
          animation: dbFade 0.4s ease forwards;
          display: flex; flex-direction: column; gap: 20px;
        }

        @keyframes dbFade {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .db-loading {
          display: flex; align-items: center;
          justify-content: center; height: 100vh;
        }

        .db-ring-spinner {
          width: 36px; height: 36px;
          border: 3px solid var(--border); border-top-color: #f97316;
          border-radius: 50%; animation: dbSpin 0.8s linear infinite;
        }

        @keyframes dbSpin { to { transform: rotate(360deg); } }

        /* ── Header ── */
        .db-header {
          display: flex; align-items: center;
          justify-content: space-between; gap: 20px; flex-wrap: wrap;
        }

        .db-greeting {
          font-family: 'Syne', sans-serif;
          font-size: 28px; font-weight: 700;
          color: var(--text); letter-spacing: -0.5px; margin: 0 0 6px;
        }

        .db-name { color: #f97316; }

        .db-sub { font-size: 14px; color: var(--muted); margin: 0; }

        .db-header-right {
          display: flex; align-items: center; gap: 16px;
        }

        .db-primary-btn {
          display: flex; align-items: center; gap: 8px;
          background: #f97316; color: white; border: none;
          border-radius: 10px; padding: 11px 20px;
          font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(249,115,22,0.3);
          white-space: nowrap;
        }

        .db-primary-btn span { font-size: 18px; line-height: 1; }
        .db-primary-btn:hover { background: #ea6c0a; transform: translateY(-1px); }

        .db-capture-btn {
          display: flex; align-items: center; gap: 7px;
          background: var(--card-bg); color: var(--text);
          border: 1px solid var(--border); border-radius: 10px;
          padding: 11px 18px; font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.2s; white-space: nowrap;
        }

        .db-capture-btn:hover {
          border-color: #f97316; color: #f97316;
          background: rgba(249,115,22,0.06);
        }

        /* ── Daily ring ── */
        .db-ring-wrap {
          position: relative; width: 72px; height: 72px;
          display: flex; align-items: center; justify-content: center;
        }

        .db-ring-wrap svg { position: absolute; top: 0; left: 0; }

        .db-ring-center {
          position: relative; z-index: 1;
          display: flex; flex-direction: column;
          align-items: center; gap: 0;
        }

        .db-ring-val {
          font-family: 'Syne', sans-serif;
          font-size: 14px; font-weight: 800; line-height: 1;
        }

        .db-ring-label {
          font-size: 9px; color: var(--muted);
          text-transform: uppercase; letter-spacing: 0.5px;
        }

        /* ── Stat cards ── */
        .db-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 14px;
        }

        .db-stat-card {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 14px; padding: 18px 20px;
          display: flex; align-items: center; gap: 14px;
          border-left: 3px solid var(--accent);
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative; overflow: hidden;
        }

        .db-stat-card:hover {
          transform: translateY(-2px); box-shadow: 0 8px 24px var(--shadow);
        }

        .db-stat-icon {
          font-size: 22px; line-height: 1; flex-shrink: 0;
        }

        .db-stat-body { display: flex; flex-direction: column; gap: 2px; }

        .db-stat-val {
          font-family: 'Syne', sans-serif;
          font-size: 26px; font-weight: 800;
          color: var(--text); letter-spacing: -0.5px; line-height: 1;
        }

        .db-stat-label {
          font-size: 11px; color: var(--muted);
          text-transform: uppercase; letter-spacing: 0.5px;
        }

        /* ── Row layout ── */
        .db-row {
          display: grid; gap: 20px;
          grid-template-columns: 1fr 1fr;
        }

        /* ── Cards ── */
        .db-continue-card, .db-recent-card, .db-chart-card, .db-topics-card {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 16px; padding: 22px;
          display: flex; flex-direction: column; gap: 14px;
        }

        .db-card-header {
          display: flex; align-items: center;
          justify-content: space-between;
        }

        .db-card-title {
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 700;
          color: var(--text); margin: 0;
        }

        .db-card-meta { font-size: 12px; color: var(--muted); }

        .db-badge {
          font-size: 11px; font-weight: 600;
          background: var(--tag-bg); color: var(--tag-text);
          padding: 3px 10px; border-radius: 99px;
        }

        .db-card-empty {
          font-size: 14px; color: var(--muted);
          text-align: center; padding: 24px 0;
        }

        /* Continue card */
        .db-continue-body {
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 12px;
        }

        .db-continue-info {
          display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;
        }

        .db-continue-name {
          font-family: 'Syne', sans-serif;
          font-size: 17px; font-weight: 700; color: var(--text);
        }

        .db-continue-meta { font-size: 12px; color: var(--muted); }

        .db-continue-notes {
          font-size: 13px; color: var(--muted);
          font-style: italic; margin: 4px 0 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .db-continue-btn {
          background: rgba(249,115,22,0.1);
          border: 1px solid rgba(249,115,22,0.3);
          border-radius: 8px; padding: 8px 14px;
          font-size: 13px; font-weight: 600;
          color: #f97316; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
        }

        .db-continue-btn:hover { background: rgba(249,115,22,0.2); }

        /* Recent logs */
        .db-recent-list {
          display: flex; flex-direction: column; gap: 12px;
        }

        .db-recent-item {
          display: flex; gap: 12px; align-items: flex-start;
        }

        .db-recent-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #f97316; flex-shrink: 0; margin-top: 5px;
        }

        .db-recent-body { flex: 1; min-width: 0; }

        .db-recent-top {
          display: flex; align-items: center;
          justify-content: space-between; gap: 8px; margin-bottom: 3px;
        }

        .db-recent-topic {
          font-size: 13px; font-weight: 600; color: var(--text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .db-recent-time {
          font-size: 11px; font-weight: 600; color: #f97316;
          flex-shrink: 0;
        }

        .db-recent-notes {
          font-size: 12px; color: var(--muted);
          line-height: 1.4; margin: 0 0 3px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .db-recent-ago { font-size: 10px; color: var(--placeholder); }

        /* Tooltip */
        .db-tooltip {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: 10px 14px;
          box-shadow: 0 4px 16px var(--shadow);
        }

        .db-tooltip-label { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
        .db-tooltip-val {
          font-size: 16px; font-weight: 700; color: #f97316;
          font-family: 'Syne', sans-serif;
        }

        /* Pace card */
        .db-pace-card {
          background: linear-gradient(135deg, rgba(249,115,22,0.08), rgba(249,115,22,0.02));
          border: 1px solid rgba(249,115,22,0.2);
          border-radius: 16px; padding: 22px;
          display: flex; align-items: center;
          justify-content: space-between; gap: 20px; flex-wrap: wrap;
        }

        .db-pace-left { display: flex; align-items: center; gap: 14px; }

        .db-pace-icon { font-size: 28px; }

        .db-pace-title {
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 700; color: var(--text); margin: 0 0 3px;
        }

        .db-pace-sub { font-size: 12px; color: var(--muted); margin: 0; }

        .db-pace-stats {
          display: flex; align-items: center; gap: 0;
        }

        .db-pace-stat {
          display: flex; flex-direction: column; gap: 3px;
          align-items: center; padding: 0 24px;
        }

        .db-pace-val {
          font-family: 'Syne', sans-serif;
          font-size: 24px; font-weight: 800;
          letter-spacing: -0.5px; line-height: 1;
        }

        .db-pace-label {
          font-size: 11px; color: var(--muted);
          text-transform: uppercase; letter-spacing: 0.4px;
        }

        .db-pace-divider {
          width: 1px; height: 36px; background: var(--border);
        }

        /* ── Modal ── */
        .db-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }

        .db-modal {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 20px; padding: 32px; width: 100%; max-width: 460px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.3);
          animation: dbSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes dbSlide {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .db-modal-header {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 24px;
        }

        .db-modal-header h2 {
          font-family: 'Syne', sans-serif;
          font-size: 20px; font-weight: 700; color: var(--text);
        }

        .db-modal-close {
          background: none; border: none; color: var(--muted);
          font-size: 16px; cursor: pointer; padding: 4px 8px;
          border-radius: 6px; transition: all 0.2s;
        }

        .db-modal-close:hover { background: var(--hover-bg); color: var(--text); }

        .db-modal-form { display: flex; flex-direction: column; gap: 18px; }
        .db-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .db-field { display: flex; flex-direction: column; gap: 7px; }
        .db-field label { font-size: 13px; font-weight: 500; color: var(--muted); }

        .db-field input, .db-field select, .db-field textarea {
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: 11px 14px;
          font-size: 14px; color: var(--text);
          font-family: 'DM Sans', sans-serif; outline: none; resize: vertical;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .db-field input:focus, .db-field select:focus, .db-field textarea:focus {
          border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .db-field select option { background: var(--card-bg); }

        .db-form-error {
          font-size: 13px; color: var(--danger-text);
          background: var(--danger-bg); border-radius: 8px; padding: 10px 14px;
        }

        .db-submit {
          background: #f97316; color: white; border: none;
          border-radius: 10px; padding: 12px; font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
          min-height: 44px; box-shadow: 0 4px 16px rgba(249,115,22,0.3);
        }

        .db-submit:hover:not(:disabled) { background: #ea6c0a; transform: translateY(-1px); }
        .db-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .db-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
          border-radius: 50%; animation: dbSpin 0.7s linear infinite; display: inline-block;
        }
      `}</style>
    </div>
  );
}