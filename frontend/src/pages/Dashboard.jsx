import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-accent" style={{ background: accent }} />
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  );
}

function QuickLogModal({ topics, onClose, onSaved }) {
  const [form, setForm] = useState({ topic_id: '', notes: '', time_spent: '' });
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
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Quick log</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="modal-form">
          <div className="field">
            <label>Topic</label>
            <select name="topic_id" value={form.topic_id} onChange={handle} required>
              <option value="">Select a topic...</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>What did you learn?</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handle}
              placeholder="Today I learned..."
              required
              rows={4}
            />
          </div>
          <div className="field">
            <label>Time spent (minutes)</label>
            <input
              type="number"
              name="time_spent"
              value={form.time_spent}
              onChange={handle}
              placeholder="e.g. 45"
              min={1}
              required
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Save log'}
          </button>
        </form>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="chart-tooltip">
        <p className="tooltip-date">{label}</p>
        <p className="tooltip-val">{payload[0].value}h</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchData = async () => {
    try {
      const [statsRes, topicsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/topics/'),
      ]);
      setStats(statsRes.data);
      setTopics(topicsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const chartData = stats?.weekly_activity?.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    hours: d.hours,
  })) || [];

  if (loading) return (
    <div className="dash-loading">
      <div className="loading-ring" />
    </div>
  );

  return (
    <div className="dash-root">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},
            <span className="name-accent"> {user?.username}</span>
          </h1>
          <p className="dash-sub">Here's your learning summary</p>
        </div>
        <button className="quick-log-btn" onClick={() => setShowModal(true)}>
          <span>+</span> Quick log
        </button>
      </div>

      {/* Stat cards */}
      <div className="stats-grid">
        <StatCard
          label="Total hours"
          value={`${stats?.total_hours ?? 0}h`}
          sub="time invested"
          accent="linear-gradient(135deg, #f97316, #fb923c)"
        />
        <StatCard
          label="In progress"
          value={stats?.topics_in_progress ?? 0}
          sub="active topics"
          accent="linear-gradient(135deg, #3b82f6, #60a5fa)"
        />
        <StatCard
          label="Mastered"
          value={stats?.topics_mastered ?? 0}
          sub="completed topics"
          accent="linear-gradient(135deg, #22c55e, #4ade80)"
        />
        <StatCard
          label="This week"
          value={`${chartData.reduce((s, d) => s + d.hours, 0).toFixed(1)}h`}
          sub="last 7 days"
          accent="linear-gradient(135deg, #a855f7, #c084fc)"
        />
      </div>

      {/* Chart */}
      <div className="chart-card">
        <div className="chart-header">
          <h2 className="chart-title">Weekly activity</h2>
          <span className="chart-badge">Last 7 days</span>
        </div>
        {chartData.length === 0 ? (
          <div className="chart-empty">
            <p>No activity yet — log your first session!</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="#f97316"
                strokeWidth={2.5}
                fill="url(#areaGrad)"
                dot={{ fill: '#f97316', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#f97316', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quick log modal */}
      {showModal && (
        <QuickLogModal
          topics={topics}
          onClose={() => setShowModal(false)}
          onSaved={fetchData}
        />
      )}

      <style>{`
        .dash-root {
          padding: 40px 44px;
          width: 100%;
          box-sizing: border-box;
          animation: fadeIn 0.4s ease forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .dash-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
        }

        .loading-ring {
          width: 36px; height: 36px;
          border: 3px solid var(--border);
          border-top-color: #f97316;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .dash-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 36px;
          gap: 16px;
          flex-wrap: wrap;
        }

        .dash-title {
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 28px;
          color: var(--text);
          letter-spacing: -0.5px;
          margin-bottom: 6px;
        }

        .name-accent { color: #f97316; }

        .dash-sub {
          font-size: 14px;
          color: var(--muted);
        }

        .quick-log-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f97316;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 11px 20px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(249, 115, 22, 0.3);
          white-space: nowrap;
        }

        .quick-log-btn span { font-size: 18px; line-height: 1; }

        .quick-log-btn:hover {
          background: #ea6c0a;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 28px;
        }

        .stat-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px var(--shadow);
        }

        .stat-accent {
          position: absolute;
          top: 0; left: 0;
          width: 4px;
          height: 100%;
          border-radius: 4px 0 0 4px;
        }

        .stat-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 10px;
        }

        .stat-value {
          font-family: 'Syne', sans-serif;
          font-size: 36px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -1px;
          line-height: 1;
          margin-bottom: 6px;
        }

        .stat-sub {
          font-size: 12px;
          color: var(--muted);
        }

        .chart-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 28px;
        }

        .chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .chart-title {
          font-family: 'Syne', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
        }

        .chart-badge {
          font-size: 12px;
          color: var(--tag-text);
          background: var(--tag-bg);
          padding: 4px 10px;
          border-radius: 99px;
          font-weight: 500;
        }

        .chart-empty {
          height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
          font-size: 14px;
        }

        .chart-tooltip {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 14px;
          box-shadow: 0 4px 16px var(--shadow);
        }

        .tooltip-date { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
        .tooltip-val  { font-size: 16px; font-weight: 700; color: #f97316; font-family: 'Syne', sans-serif; }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }

        .modal-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 32px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.3);
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .modal-header h2 {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
        }

        .modal-close {
          background: none;
          border: none;
          color: var(--muted);
          font-size: 16px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .modal-close:hover { background: var(--hover-bg); color: var(--text); }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
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
        }

        .field input, .field select, .field textarea {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 14px;
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          resize: vertical;
        }

        .field input:focus, .field select:focus, .field textarea:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .field select option { background: var(--card-bg); }

        .form-error {
          font-size: 13px;
          color: var(--danger-text);
          background: var(--danger-bg);
          border-radius: 8px;
          padding: 10px 14px;
        }

        .submit-btn {
          background: #f97316;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 12px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          box-shadow: 0 4px 16px rgba(249,115,22,0.3);
        }

        .submit-btn:hover:not(:disabled) {
          background: #ea6c0a;
          transform: translateY(-1px);
        }

        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}