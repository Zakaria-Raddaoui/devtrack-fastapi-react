import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';

const DIFFICULTY_COLORS = {
    beginner: { bg: 'rgba(34,197,94,0.12)', text: '#16a34a', label: 'Beginner' },
    intermediate: { bg: 'rgba(249,115,22,0.12)', text: '#ea580c', label: 'Intermediate' },
    advanced: { bg: 'rgba(239,68,68,0.12)', text: '#dc2626', label: 'Advanced' },
};

const STATUS_COLORS = {
    to_learn: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', label: 'To Learn' },
    learning: { bg: 'rgba(59,130,246,0.12)', text: '#2563eb', label: 'Learning' },
    mastered: { bg: 'rgba(34,197,94,0.12)', text: '#16a34a', label: 'Mastered' },
};

function Badge({ value, map }) {
    const c = map[value] || {};
    return (
        <span style={{
            background: c.bg, color: c.text,
            fontSize: 11, fontWeight: 600, padding: '3px 10px',
            borderRadius: 99, letterSpacing: '0.3px', textTransform: 'uppercase',
        }}>
            {c.label}
        </span>
    );
}

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

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
        return (
            <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 14px',
                boxShadow: '0 4px 16px var(--shadow)',
            }}>
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#f97316', margin: 0, fontFamily: 'Syne, sans-serif' }}>
                    {payload[0].value}h
                </p>
            </div>
        );
    }
    return null;
};

export default function TopicDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [topic, setTopic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedLog, setExpandedLog] = useState(null);
    const [confirmLog, setConfirmLog] = useState(null);

    const fetchTopic = useCallback(async () => {
        try {
            const res = await api.get(`/topics/${id}/detail`);
            setTopic(res.data);
        } catch (e) {
            console.error(e);
            navigate('/topics');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => { fetchTopic(); }, [fetchTopic]);

    const deleteLog = async (logId) => {
        try {
            await api.delete(`/logs/${logId}`);
            fetchTopic();
        } catch (e) { console.error(e); }
        finally { setConfirmLog(null); }
    };

    if (loading) return (
        <div className="td-loading"><div className="td-ring" /></div>
    );

    if (!topic) return null;

    const totalHours = (topic.total_minutes / 60).toFixed(1);
    const pct = topic.goal_hours
        ? Math.min(100, Math.round((topic.total_minutes / 60 / topic.goal_hours) * 100))
        : null;
    const progressColor = pct === null ? '#f97316' : pct >= 100 ? '#22c55e' : pct >= 60 ? '#f97316' : '#3b82f6';

    // Build weekly activity chart from logs
    const weeks = {};
    topic.logs.forEach(log => {
        const d = new Date(log.date);
        const weekKey = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        weeks[weekKey] = (weeks[weekKey] || 0) + log.time_spent;
    });
    const chartData = Object.entries(weeks)
        .slice(-8)
        .map(([date, mins]) => ({ date, hours: parseFloat((mins / 60).toFixed(1)) }));

    return (
        <div className="td-root">
            {/* Back */}
            <button className="td-back" onClick={() => navigate('/topics')}>← Back to topics</button>

            {/* Two column layout */}
            <div className="td-layout">

                {/* Left — main content */}
                <div className="td-main">

                    {/* Topic header card */}
                    <div className="td-header-card">
                        <div className="td-header-top">
                            <div className="td-badges">
                                <Badge value={topic.difficulty} map={DIFFICULTY_COLORS} />
                                <Badge value={topic.status} map={STATUS_COLORS} />
                            </div>
                        </div>
                        <h1 className="td-title">{topic.title}</h1>
                        {topic.description && <p className="td-desc">{topic.description}</p>}

                        {/* Progress bar if goal set */}
                        {topic.goal_hours && (
                            <div className="td-progress-wrap">
                                <div className="td-progress-track">
                                    <div className="td-progress-fill" style={{ width: `${pct}%`, background: progressColor }} />
                                </div>
                                <div className="td-progress-meta">
                                    <span style={{ color: progressColor, fontWeight: 600 }}>{pct}% complete</span>
                                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{totalHours}h / {topic.goal_hours}h goal</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Activity chart */}
                    {chartData.length > 0 && (
                        <div className="td-card">
                            <h2 className="td-section-title">Activity</h2>
                            <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="tdGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="hours" stroke="#f97316" strokeWidth={2.5}
                                        fill="url(#tdGrad)" dot={{ fill: '#f97316', r: 4, strokeWidth: 0 }}
                                        activeDot={{ r: 6, fill: '#f97316', strokeWidth: 0 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Logs */}
                    <div className="td-card">
                        <div className="td-section-header">
                            <h2 className="td-section-title">Logs <span className="td-count">{topic.total_logs}</span></h2>
                        </div>
                        {topic.logs.length === 0 ? (
                            <p className="td-empty-text">No logs for this topic yet.</p>
                        ) : (
                            <div className="td-logs-list">
                                {topic.logs.map(log => {
                                    const h = Math.floor(log.time_spent / 60);
                                    const m = log.time_spent % 60;
                                    const timeLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;
                                    const isExpanded = expandedLog === log.id;
                                    return (
                                        <div key={log.id} className="td-log-item">
                                            <div className="td-log-header">
                                                <div className="td-log-meta">
                                                    <span className="td-log-date">
                                                        {new Date(log.date).toLocaleDateString('en-US', {
                                                            weekday: 'short', month: 'short', day: 'numeric'
                                                        })}
                                                    </span>
                                                    <span className="td-log-ago">{timeAgo(log.date)}</span>
                                                </div>
                                                <div className="td-log-right">
                                                    <span className="td-time-badge">◷ {timeLabel}</span>
                                                    <div className="td-log-actions">
                                                        <button
                                                            className="td-icon-btn del"
                                                            onClick={() => setConfirmLog(log.id)}
                                                            title="Delete"
                                                        >✕</button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`td-log-notes ${isExpanded ? 'expanded' : ''}`}>
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {isExpanded ? log.notes : log.notes.slice(0, 300) + (log.notes.length > 300 ? '...' : '')}
                                                </ReactMarkdown>
                                            </div>
                                            {log.notes.length > 300 && (
                                                <button
                                                    className="td-expand-btn"
                                                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                                                >
                                                    {isExpanded ? 'Show less ↑' : 'Read more ↓'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Resources */}
                    {topic.resources.length > 0 && (
                        <div className="td-card">
                            <h2 className="td-section-title">Resources <span className="td-count">{topic.resources.length}</span></h2>
                            <div className="td-resources-list">
                                {topic.resources.map(r => {
                                    let domain = r.url;
                                    try { domain = new URL(r.url).hostname.replace('www.', ''); } catch { }
                                    const TYPE_COLORS = {
                                        article: '#3b82f6', video: '#ef4444', course: '#f97316',
                                        book: '#a855f7', docs: '#22c55e', tool: '#14b8a6', other: '#6b7280',
                                    };
                                    const typeColor = TYPE_COLORS[r.resource_type] || TYPE_COLORS.other;
                                    return (
                                        <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="td-resource-item">
                                            <div className="td-resource-left">
                                                <span className="td-resource-type" style={{ color: typeColor, borderColor: typeColor + '40', background: typeColor + '15' }}>
                                                    {r.resource_type || 'link'}
                                                </span>
                                                <div className="td-resource-info">
                                                    <span className="td-resource-title">{r.title}</span>
                                                    {r.rating && (
                                                        <span className="td-resource-rating">
                                                            {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="td-resource-right">
                                                {r.is_read && <span className="td-resource-read">✓ Read</span>}
                                                <span className="td-resource-domain">↗ {domain}</span>
                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Linked roadmap steps */}
                    {topic.linked_steps && topic.linked_steps.length > 0 && (
                        <div className="td-card">
                            <h2 className="td-section-title">
                                Roadmap steps <span className="td-count">{topic.linked_steps.length}</span>
                            </h2>
                            <div className="td-steps-list">
                                {topic.linked_steps.map(step => (
                                    <div key={step.id} className={`td-step-item ${step.is_completed ? 'done' : ''}`}>
                                        <div className={`td-step-check ${step.is_completed ? 'checked' : ''}`}>
                                            {step.is_completed ? '✓' : ''}
                                        </div>
                                        <div className="td-step-body">
                                            <span className="td-step-title">{step.title}</span>
                                            <span className="td-step-roadmap">— {step.roadmap_title}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right — stats sidebar */}
                <div className="td-sidebar">
                    {/* Stats card */}
                    <div className="td-stats-card">
                        <h3 className="td-stats-title">Overview</h3>
                        <div className="td-stats-grid">
                            <div className="td-stat">
                                <span className="td-stat-val" style={{ color: '#f97316' }}>{totalHours}h</span>
                                <span className="td-stat-label">Total time</span>
                            </div>
                            <div className="td-stat">
                                <span className="td-stat-val" style={{ color: '#3b82f6' }}>{topic.total_logs}</span>
                                <span className="td-stat-label">Log entries</span>
                            </div>
                            <div className="td-stat">
                                <span className="td-stat-val" style={{ color: '#22c55e' }}>{topic.resources.length}</span>
                                <span className="td-stat-label">Resources</span>
                            </div>
                            <div className="td-stat">
                                <span className="td-stat-val" style={{ color: '#a855f7' }}>
                                    {topic.total_logs > 0
                                        ? ((topic.total_minutes / topic.total_logs) / 60).toFixed(1) + 'h'
                                        : '—'}
                                </span>
                                <span className="td-stat-label">Avg per log</span>
                            </div>
                        </div>
                    </div>

                    {/* Info card */}
                    <div className="td-info-card">
                        <div className="td-info-row">
                            <span className="td-info-label">Status</span>
                            <Badge value={topic.status} map={STATUS_COLORS} />
                        </div>
                        <div className="td-info-row">
                            <span className="td-info-label">Difficulty</span>
                            <Badge value={topic.difficulty} map={DIFFICULTY_COLORS} />
                        </div>
                        {topic.goal_hours && (
                            <div className="td-info-row">
                                <span className="td-info-label">Goal</span>
                                <span className="td-info-val">{topic.goal_hours}h</span>
                            </div>
                        )}
                        <div className="td-info-row">
                            <span className="td-info-label">Created</span>
                            <span className="td-info-val">
                                {new Date(topic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                        <div className="td-info-row">
                            <span className="td-info-label">Last updated</span>
                            <span className="td-info-val">{timeAgo(topic.updated_at)}</span>
                        </div>
                    </div>

                    {/* Last log preview */}
                    {topic.logs.length > 0 && (
                        <div className="td-last-log-card">
                            <h3 className="td-stats-title">Latest log</h3>
                            <p className="td-last-log-date">
                                {new Date(topic.logs[0].date).toLocaleDateString('en-US', {
                                    weekday: 'short', month: 'short', day: 'numeric'
                                })}
                            </p>
                            <div className="td-last-log-notes">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {topic.logs[0].notes.slice(0, 150) + (topic.logs[0].notes.length > 150 ? '...' : '')}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirm delete log */}
            {confirmLog !== null && (
                <ConfirmDialog
                    title="Delete log"
                    message="Are you sure you want to delete this log entry?"
                    onConfirm={() => deleteLog(confirmLog)}
                    onCancel={() => setConfirmLog(null)}
                />
            )}

            <style>{`
        .td-root {
          padding: 40px 44px;
          width: 100%; box-sizing: border-box;
          animation: tdFade 0.4s ease forwards;
        }

        @keyframes tdFade {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .td-loading {
          display: flex; align-items: center;
          justify-content: center; height: 100vh;
        }

        .td-ring {
          width: 36px; height: 36px;
          border: 3px solid var(--border);
          border-top-color: #f97316;
          border-radius: 50%;
          animation: tdSpin 0.8s linear infinite;
        }

        @keyframes tdSpin { to { transform: rotate(360deg); } }

        .td-back {
          background: none; border: none;
          color: var(--muted); cursor: pointer;
          font-size: 14px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          padding: 0; margin-bottom: 24px;
          transition: color 0.15s; display: block;
        }
        .td-back:hover { color: #f97316; }

        .td-layout {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 24px;
          align-items: start;
        }

        .td-main { display: flex; flex-direction: column; gap: 20px; }

        /* Header card */
        .td-header-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px; padding: 28px;
          display: flex; flex-direction: column; gap: 12px;
        }

        .td-header-top {
          display: flex; align-items: center;
          justify-content: space-between;
        }

        .td-badges { display: flex; gap: 8px; flex-wrap: wrap; }

        .td-title {
          font-family: 'Syne', sans-serif;
          font-size: 32px; font-weight: 800;
          color: var(--text); letter-spacing: -1px; margin: 0;
        }

        .td-desc {
          font-size: 15px; color: var(--muted);
          line-height: 1.6; margin: 0;
        }

        .td-progress-wrap { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }

        .td-progress-track {
          height: 8px; border-radius: 99px;
          background: var(--border); overflow: hidden;
        }

        .td-progress-fill {
          height: 100%; border-radius: 99px;
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .td-progress-meta {
          display: flex; justify-content: space-between; align-items: center;
        }

        /* General card */
        .td-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px; padding: 24px;
          display: flex; flex-direction: column; gap: 16px;
        }

        .td-section-header {
          display: flex; align-items: center;
          justify-content: space-between;
        }

        .td-section-title {
          font-family: 'Syne', sans-serif;
          font-size: 16px; font-weight: 700;
          color: var(--text); margin: 0;
          display: flex; align-items: center; gap: 8px;
        }

        .td-count {
          font-size: 12px; font-weight: 600;
          background: var(--bg); color: var(--muted);
          padding: 2px 8px; border-radius: 99px;
          border: 1px solid var(--border);
        }

        .td-empty-text { font-size: 14px; color: var(--muted); margin: 0; }

        /* Logs */
        .td-logs-list { display: flex; flex-direction: column; gap: 12px; }

        .td-log-item {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px; padding: 16px;
          display: flex; flex-direction: column; gap: 10px;
        }

        .td-log-header {
          display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
        }

        .td-log-meta { display: flex; align-items: center; gap: 8px; }

        .td-log-date {
          font-size: 13px; font-weight: 600; color: var(--text);
        }

        .td-log-ago {
          font-size: 11px; color: var(--placeholder);
        }

        .td-log-right {
          display: flex; align-items: center; gap: 8px;
        }

        .td-time-badge {
          font-size: 12px; font-weight: 600;
          color: #f97316; white-space: nowrap;
        }

        .td-log-actions { display: flex; gap: 4px; }

        .td-icon-btn {
          background: none; border: none;
          border-radius: 6px; padding: 3px 7px;
          font-size: 12px; cursor: pointer;
          transition: all 0.2s; color: var(--muted);
          font-family: 'DM Sans', sans-serif;
        }

        .td-icon-btn.del:hover { background: var(--danger-bg); color: var(--danger-text); }

        .td-log-notes {
          font-size: 14px; color: var(--text);
          line-height: 1.65;
        }

        .td-log-notes p { margin: 0 0 6px; }
        .td-log-notes p:last-child { margin: 0; }
        .td-log-notes h1, .td-log-notes h2, .td-log-notes h3 {
          font-family: 'Syne', sans-serif; font-weight: 700;
          color: var(--text); margin: 8px 0 4px;
        }
        .td-log-notes code {
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 4px; padding: 1px 5px;
          font-size: 12px; color: #f97316; font-family: monospace;
        }
        .td-log-notes ul, .td-log-notes ol { padding-left: 18px; margin: 4px 0; }
        .td-log-notes li { margin-bottom: 2px; }
        .td-log-notes strong { font-weight: 600; }
        .td-log-notes blockquote {
          border-left: 3px solid #f97316; padding-left: 10px;
          margin: 6px 0; color: var(--muted); font-style: italic;
        }

        .td-expand-btn {
          background: none; border: none;
          font-size: 12px; font-weight: 600;
          color: #f97316; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          padding: 0; transition: opacity 0.2s;
          align-self: flex-start;
        }
        .td-expand-btn:hover { opacity: 0.75; }

        /* Resources */
        .td-resources-list { display: flex; flex-direction: column; gap: 8px; }

        .td-resource-item {
          display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 12px 16px;
          text-decoration: none;
          transition: all 0.15s;
        }

        .td-resource-item:hover {
          border-color: #f97316;
          background: var(--hover-bg);
        }

        .td-resource-left {
          display: flex; align-items: center; gap: 10px; min-width: 0;
        }

        .td-resource-type {
          font-size: 10px; font-weight: 700;
          padding: 2px 8px; border-radius: 99px;
          text-transform: uppercase; letter-spacing: 0.3px;
          flex-shrink: 0; border: 1px solid;
        }

        .td-resource-info {
          display: flex; flex-direction: column; gap: 2px; min-width: 0;
        }

        .td-resource-title {
          font-size: 13px; font-weight: 500;
          color: var(--text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .td-resource-rating {
          font-size: 11px; color: #f59e0b; letter-spacing: 1px;
        }

        .td-resource-right {
          display: flex; align-items: center; gap: 8px; flex-shrink: 0;
        }

        .td-resource-read {
          font-size: 10px; font-weight: 700; color: #22c55e;
          background: rgba(34,197,94,0.1); padding: 2px 7px;
          border-radius: 99px;
        }

        .td-resource-domain {
          font-size: 12px; color: #f97316; flex-shrink: 0;
        }

        /* Roadmap steps */
        .td-steps-list { display: flex; flex-direction: column; gap: 8px; }

        .td-step-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px;
          background: var(--bg); border: 1px solid var(--border);
          border-radius: 10px; transition: all 0.15s;
        }

        .td-step-item.done { opacity: 0.6; }

        .td-step-check {
          width: 20px; height: 20px; border-radius: 50%;
          border: 2px solid var(--border); flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; color: white;
        }

        .td-step-check.checked { background: #22c55e; border-color: #22c55e; }

        .td-step-body { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }

        .td-step-title {
          font-size: 13px; font-weight: 600; color: var(--text);
        }

        .td-step-item.done .td-step-title { text-decoration: line-through; color: var(--muted); }

        .td-step-roadmap { font-size: 11px; color: var(--muted); }

        /* Sidebar */
        .td-sidebar {
          display: flex; flex-direction: column; gap: 16px;
          position: sticky; top: 20px;
        }

        .td-stats-card, .td-info-card, .td-last-log-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px; padding: 20px;
          display: flex; flex-direction: column; gap: 14px;
        }

        .td-stats-title {
          font-family: 'Syne', sans-serif;
          font-size: 13px; font-weight: 700;
          color: var(--muted); text-transform: uppercase;
          letter-spacing: 0.5px; margin: 0;
        }

        .td-stats-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .td-stat {
          display: flex; flex-direction: column; gap: 3px;
        }

        .td-stat-val {
          font-family: 'Syne', sans-serif;
          font-size: 24px; font-weight: 700;
          letter-spacing: -0.5px; line-height: 1;
        }

        .td-stat-label {
          font-size: 11px; color: var(--muted);
          text-transform: uppercase; letter-spacing: 0.4px;
        }

        .td-info-row {
          display: flex; align-items: center;
          justify-content: space-between; gap: 8px;
        }

        .td-info-label {
          font-size: 12px; color: var(--muted); font-weight: 500;
        }

        .td-info-val {
          font-size: 12px; font-weight: 600; color: var(--text);
        }

        .td-last-log-date {
          font-size: 12px; color: var(--muted); margin: 0;
        }

        .td-last-log-notes {
          font-size: 13px; color: var(--text); line-height: 1.6;
        }

        .td-last-log-notes p { margin: 0 0 4px; }
        .td-last-log-notes p:last-child { margin: 0; }
        .td-last-log-notes code {
          background: var(--input-bg); border-radius: 4px;
          padding: 1px 5px; font-size: 11px; color: #f97316; font-family: monospace;
        }
        .td-last-log-notes strong { font-weight: 600; }
      `}</style>
        </div>
    );
}