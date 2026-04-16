import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysRemaining(dateStr) {
    if (!dateStr) return null;
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
}

// ─── Goal Modal ───────────────────────────────────────────────────────────────

function GoalModal({ goal, topics, onClose, onSaved }) {
    const editing = !!goal?.id;
    const [form, setForm] = useState({
        title: goal?.title || '',
        description: goal?.description || '',
        target_hours: goal?.target_hours || '',
        target_date: goal?.target_date
            ? new Date(goal.target_date).toISOString().split('T')[0]
            : '',
        topic_id: goal?.topic_id || '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const submit = async e => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const payload = {
                title: form.title,
                description: form.description || null,
                target_hours: form.target_hours ? parseFloat(form.target_hours) : null,
                target_date: form.target_date ? new Date(form.target_date).toISOString() : null,
                topic_id: form.topic_id ? parseInt(form.topic_id) : null,
            };
            if (editing) await api.put(`/goals/${goal.id}`, payload);
            else await api.post('/goals/', payload);
            onSaved();
            onClose();
        } catch (err) {
            const d = err.response?.data?.detail;
            setError(typeof d === 'string' ? d : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="gl-overlay" onClick={onClose}>
            <div className="gl-modal" onClick={e => e.stopPropagation()}>
                <div className="gl-modal-header">
                    <h2>{editing ? 'Edit goal' : 'New goal'}</h2>
                    <button className="gl-modal-close" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit} className="gl-modal-form">
                    <div className="gl-field">
                        <label>Goal title</label>
                        <input name="title" value={form.title} onChange={handle}
                            placeholder="e.g. Complete Docker mastery" required autoFocus />
                    </div>
                    <div className="gl-field">
                        <label>Description <span className="gl-opt">(optional)</span></label>
                        <textarea name="description" value={form.description} onChange={handle}
                            placeholder="What does achieving this goal look like?" rows={2} />
                    </div>
                    <div className="gl-field-row">
                        <div className="gl-field">
                            <label>Target hours <span className="gl-opt">(optional)</span></label>
                            <input type="number" name="target_hours" value={form.target_hours}
                                onChange={handle} placeholder="e.g. 50" min={1} step={0.5} />
                        </div>
                        <div className="gl-field">
                            <label>Deadline <span className="gl-opt">(optional)</span></label>
                            <input type="date" name="target_date" value={form.target_date} onChange={handle}
                                min={new Date().toISOString().split('T')[0]} />
                        </div>
                    </div>
                    <div className="gl-field">
                        <label>Link to topic <span className="gl-opt">(optional)</span></label>
                        <select name="topic_id" value={form.topic_id} onChange={handle}>
                            <option value="">No topic linked</option>
                            {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                    </div>
                    {error && <p className="gl-error">{error}</p>}
                    <button type="submit" className="gl-submit" disabled={loading}>
                        {loading ? <span className="gl-spinner" /> : (editing ? 'Save changes' : 'Create goal')}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, onEdit, onDelete, onToggle }) {
    const [confirm, setConfirm] = useState(false);
    const days = daysRemaining(goal.target_date);

    // Progress
    const hasHoursGoal = !!goal.target_hours;
    const pct = hasHoursGoal
        ? Math.min(100, Math.round((goal.logged_hours / goal.target_hours) * 100))
        : null;
    const progressColor = goal.is_completed
        ? '#22c55e'
        : pct === null ? '#f97316'
            : pct >= 100 ? '#22c55e'
                : pct >= 60 ? '#f97316'
                    : '#3b82f6';

    // Deadline urgency
    const deadlineColor = days === null
        ? 'var(--muted)'
        : goal.is_completed ? '#22c55e'
            : days < 0 ? '#ef4444'
                : days < 7 ? '#f97316'
                    : '#22c55e';

    const deadlineLabel = days === null
        ? null
        : goal.is_completed ? 'Completed'
            : days < 0 ? `${Math.abs(days)}d overdue`
                : days === 0 ? 'Due today!'
                    : days === 1 ? '1 day left'
                        : `${days} days left`;

    return (
        <div className={`gl-card ${goal.is_completed ? 'completed' : ''}`}>
            {/* Top */}
            <div className="gl-card-top">
                <div className="gl-card-title-row">
                    <button
                        className={`gl-check ${goal.is_completed ? 'done' : ''}`}
                        onClick={() => onToggle(goal)}
                        title={goal.is_completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                        {goal.is_completed ? '✓' : ''}
                    </button>
                    <h3 className="gl-card-title">{goal.title}</h3>
                </div>
                <div className="gl-card-actions">
                    <button className="gl-icon-btn" onClick={() => onEdit(goal)} title="Edit">✎</button>
                    <button className="gl-icon-btn del" onClick={() => setConfirm(true)} title="Delete">✕</button>
                </div>
            </div>

            {/* Description */}
            {goal.description && (
                <p className="gl-card-desc">{goal.description}</p>
            )}

            {/* Topic badge */}
            {goal.topic_title && (
                <div className="gl-topic-badge">
                    <span className="gl-topic-dot" />
                    {goal.topic_title}
                </div>
            )}

            {/* Progress bar */}
            {hasHoursGoal && (
                <div className="gl-progress-wrap">
                    <div className="gl-progress-bg">
                        <div className="gl-progress-fill" style={{ width: `${pct}%`, background: progressColor }} />
                    </div>
                    <div className="gl-progress-meta">
                        <span style={{ color: progressColor, fontWeight: 600, fontSize: 12 }}>
                            {goal.logged_hours}h / {goal.target_hours}h
                        </span>
                        <span style={{ color: progressColor, fontWeight: 700, fontSize: 12 }}>{pct}%</span>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="gl-card-footer">
                <span className="gl-created">Created {timeAgo(goal.created_at)}</span>
                {deadlineLabel && (
                    <span className="gl-deadline" style={{ color: deadlineColor }}>
                        {days !== null && days >= 0 && !goal.is_completed ? '⏰ ' : ''}{deadlineLabel}
                    </span>
                )}
            </div>

            {confirm && (
                <ConfirmDialog
                    title="Delete goal"
                    message={`Delete "${goal.title}"? This cannot be undone.`}
                    onConfirm={() => { onDelete(goal.id); setConfirm(false); }}
                    onCancel={() => setConfirm(false)}
                />
            )}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Goals() {
    const [goals, setGoals] = useState([]);
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [tab, setTab] = useState('active'); // 'active' | 'completed'
    const [sortBy, setSortBy] = useState('deadline'); // 'deadline' | 'progress' | 'recent'
    const [filterTopic, setFilterTopic] = useState('all'); // topic_id or 'all'

    const fetchData = useCallback(async () => {
        try {
            const [goalsRes, topicsRes] = await Promise.all([
                api.get('/goals/'),
                api.get('/topics/?limit=100'),
            ]);
            setGoals(goalsRes.data);
            setTopics(topicsRes.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDelete = async (id) => {
        try {
            await api.delete(`/goals/${id}`);
            setGoals(prev => prev.filter(g => g.id !== id));
        } catch (e) { console.error(e); }
    };

    const handleToggle = async (goal) => {
        try {
            const res = await api.put(`/goals/${goal.id}`, { is_completed: !goal.is_completed });
            setGoals(prev => prev.map(g => g.id === res.data.id ? res.data : g));
        } catch (e) { console.error(e); }
    };

    const active = goals.filter(g => !g.is_completed);
    const completed = goals.filter(g => g.is_completed);

    // Base list on tab
    let shown = tab === 'active' ? active : completed;

    // Apply Topic filter
    if (filterTopic !== 'all') {
        shown = shown.filter(g => g.topic_id === parseInt(filterTopic));
    }

    // Apply Sort
    shown = [...shown].sort((a, b) => {
        if (sortBy === 'deadline') {
            if (!a.target_date) return 1;
            if (!b.target_date) return -1;
            return new Date(a.target_date) - new Date(b.target_date);
        }
        if (sortBy === 'progress') {
            const pctA = a.target_hours ? (a.logged_hours / a.target_hours) : 0;
            const pctB = b.target_hours ? (b.logged_hours / b.target_hours) : 0;
            return pctB - pctA; // descending
        }
        // recent
        return new Date(b.created_at) - new Date(a.created_at);
    });

    // Stats
    const overdue = active.filter(g => {
        if (!g.target_date) return false;
        return daysRemaining(g.target_date) < 0;
    }).length;

    const nearDeadline = active.filter(g => {
        if (!g.target_date) return false;
        const d = daysRemaining(g.target_date);
        return d >= 0 && d <= 7;
    }).length;

    if (loading) return (
        <div className="gl-loading"><div className="gl-ring" /></div>
    );

    return (
        <div className="gl-root">
            {/* Header */}
            <div className="gl-header">
                <div>
                    <h1 className="gl-title">Goals</h1>
                    <p className="gl-sub">
                        {active.length} active · {completed.length} completed
                        {overdue > 0 && <span className="gl-overdue-badge">{overdue} overdue</span>}
                    </p>
                </div>
                <div className="gl-header-actions">
                    <select className="gl-filter-select" value={filterTopic} onChange={e => setFilterTopic(e.target.value)}>
                        <option value="all">All topics</option>
                        {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                    <select className="gl-filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                        <option value="deadline">Sort by Deadline</option>
                        <option value="progress">Sort by Progress</option>
                        <option value="recent">Sort by Recently Added</option>
                    </select>
                    <button className="gl-primary-btn" onClick={() => setModal({})}>
                        <span>+</span> New goal
                    </button>
                </div>
            </div>

            {/* Summary bar */}
            {goals.length > 0 && (
                <div className="gl-summary-bar">
                    <div className="gl-summary-stat">
                        <span className="gl-summary-val" style={{ color: '#3b82f6' }}>{active.length}</span>
                        <span className="gl-summary-label">Active</span>
                    </div>
                    <div className="gl-summary-divider" />
                    <div className="gl-summary-stat">
                        <span className="gl-summary-val" style={{ color: '#22c55e' }}>{completed.length}</span>
                        <span className="gl-summary-label">Completed</span>
                    </div>
                    <div className="gl-summary-divider" />
                    <div className="gl-summary-stat">
                        <span className="gl-summary-val" style={{ color: '#ef4444' }}>{overdue}</span>
                        <span className="gl-summary-label">Overdue</span>
                    </div>
                    <div className="gl-summary-divider" />
                    <div className="gl-summary-stat">
                        <span className="gl-summary-val" style={{ color: '#f97316' }}>{nearDeadline}</span>
                        <span className="gl-summary-label">Due this week</span>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="gl-tabs">
                <button
                    className={`gl-tab ${tab === 'active' ? 'active' : ''}`}
                    onClick={() => setTab('active')}
                >
                    Active <span className="gl-tab-count">{active.length}</span>
                </button>
                <button
                    className={`gl-tab ${tab === 'completed' ? 'active' : ''}`}
                    onClick={() => setTab('completed')}
                >
                    Completed <span className="gl-tab-count">{completed.length}</span>
                </button>
            </div>

            {/* Goals grid */}
            {shown.length === 0 ? (
                <div className="gl-empty">
                    <div className="gl-empty-icon">{tab === 'active' ? '🎯' : '🏆'}</div>
                    <h2 className="gl-empty-title">
                        {tab === 'active' ? 'No active goals' : 'No completed goals yet'}
                    </h2>
                    <p className="gl-empty-sub">
                        {tab === 'active'
                            ? 'Set a goal to give your learning direction and purpose'
                            : 'Complete your active goals to see them here'}
                    </p>
                    {tab === 'active' && (
                        <button className="gl-primary-btn" onClick={() => setModal({})}>+ New goal</button>
                    )}
                </div>
            ) : (
                <div className="gl-grid">
                    {shown.map(goal => (
                        <GoalCard
                            key={goal.id}
                            goal={goal}
                            onEdit={g => setModal(g)}
                            onDelete={handleDelete}
                            onToggle={handleToggle}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            {modal !== null && (
                <GoalModal
                    goal={modal?.id ? modal : null}
                    topics={topics}
                    onClose={() => setModal(null)}
                    onSaved={fetchData}
                />
            )}

            <style>{`
        .gl-root {
          padding: 32px 40px; width: 100%; box-sizing: border-box;
          display: flex; flex-direction: column; gap: 20px;
          animation: glFade 0.4s ease forwards;
        }

        @keyframes glFade {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }

        .gl-loading {
          display:flex; align-items:center; justify-content:center; height:100vh;
        }

        .gl-ring {
          width:32px; height:32px; border:3px solid var(--border);
          border-top-color:#f97316; border-radius:50%;
          animation:glSpin 0.8s linear infinite;
        }

        @keyframes glSpin { to { transform:rotate(360deg); } }

        /* Header */
        .gl-header {
          display:flex; align-items:flex-start;
          justify-content:space-between; gap:16px; flex-wrap:wrap;
        }

        .gl-header-actions {
          display:flex; gap:10px; align-items:center; flex-wrap:wrap;
        }

        .gl-filter-select {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:10px; padding:10px 14px;
          font-size:13px; color:var(--text); font-weight:500;
          font-family:var(--font-body); outline:none;
          transition: border-color 0.2s; box-shadow:0 2px 8px var(--shadow);
        }

        .gl-filter-select:focus { border-color:#f97316; }

        .gl-title {
          font-family:var(--font-heading); font-size:24px; font-weight:800;
          color:var(--text); letter-spacing:-0.5px; margin:0 0 6px;
        }

        .gl-sub { font-size:13px; color:var(--muted); margin:0; display:flex; align-items:center; gap:8px; font-weight:500; }

        .gl-overdue-badge {
          font-size:11px; font-weight:700;
          background:rgba(239,68,68,0.12); color:#ef4444;
          padding:2px 8px; border-radius:99px;
        }

        .gl-primary-btn {
          display:flex; align-items:center; gap:8px;
          background:#f97316; color:white; border:none;
          border-radius:10px; padding:10px 18px;
          font-size:14px; font-weight:700;
          font-family:var(--font-heading); cursor:pointer;
          transition:all 0.2s cubic-bezier(0.16,1,0.3,1); box-shadow:0 4px 14px rgba(249,115,22,0.3);
          white-space:nowrap;
        }

        .gl-primary-btn span { font-size:16px; line-height:1; }
        .gl-primary-btn:hover { background:#ea6c0a; transform:translateY(-2px); box-shadow:0 6px 18px rgba(249,115,22,0.4); }

        /* Summary bar */
        .gl-summary-bar {
          display:flex; align-items:center;
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:16px; padding:16px 24px; gap:0; box-shadow:0 4px 16px var(--shadow);
        }

        .gl-summary-stat {
          display:flex; flex-direction:column; gap:4px;
          flex:1; align-items:center;
        }

        .gl-summary-val {
          font-family:var(--font-heading); font-size:24px; font-weight:800;
          letter-spacing:-0.5px; line-height:1;
        }

        .gl-summary-label {
          font-size:11px; color:var(--muted); font-weight:700; font-family:var(--font-heading);
          text-transform:uppercase; letter-spacing:0.5px;
        }

        .gl-summary-divider {
          width:1px; height:32px; background:var(--border);
          flex-shrink:0; margin:0 8px;
        }

        /* Tabs */
        .gl-tabs {
          display:flex; gap:6px; background:var(--bg); border:1px solid var(--border);
          border-radius:12px; padding:4px; margin-bottom:4px; align-self:flex-start;
          box-shadow:inset 0 1px 3px rgba(0,0,0,0.02);
        }

        .gl-tab {
          display:flex; align-items:center; gap:8px;
          background:none; border:none; border-radius:8px;
          padding:8px 14px; font-size:13px; font-weight:600;
          color:var(--muted); cursor:pointer;
          font-family:var(--font-body); transition:all 0.2s;
        }

        .gl-tab:hover { color:var(--text); }

        .gl-tab.active {
          background:var(--card-bg); color:var(--text); box-shadow:0 2px 8px var(--shadow);
          color:#f97316; font-weight:700;
        }

        .gl-tab-count {
          font-size:11px; font-weight:700;
          background:var(--bg); color:var(--muted);
          padding:2px 8px; border-radius:99px;
          border:1px solid var(--border);
        }

        .gl-tab.active .gl-tab-count {
          background:rgba(249,115,22,0.12);
          color:#f97316; border-color:rgba(249,115,22,0.25);
        }

        /* Grid */
        .gl-grid {
          display:grid; grid-template-columns:repeat(auto-fill, minmax(320px,1fr));
          gap:16px;
        }

        /* Goal card */
        .gl-card {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:20px; padding:20px;
          display:flex; flex-direction:column; gap:12px;
          transition:transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s cubic-bezier(0.16,1,0.3,1); box-shadow:0 4px 12px var(--shadow);
        }

        .gl-card:hover { transform:translateY(-3px); box-shadow:0 8px 24px var(--shadow); border-color:rgba(249,115,22,0.25); }
        .gl-card.completed { opacity:0.8; }

        .gl-card-top {
          display:flex; align-items:flex-start;
          justify-content:space-between; gap:10px;
        }

        .gl-card-title-row {
          display:flex; align-items:center; gap:10px; flex:1; min-width:0;
        }

        .gl-check {
          width:20px; height:20px; border-radius:50%;
          border:2px solid var(--border); background:none;
          cursor:pointer; display:flex; align-items:center;
          justify-content:center; font-size:11px; color:white; font-weight:800;
          transition:all 0.2s; flex-shrink:0;
        }

        .gl-check:hover:not(.done) { border-color:#22c55e; background:rgba(34,197,94,0.1); }
        .gl-check.done { background:#22c55e; border-color:#22c55e; animation:glPop 0.3s cubic-bezier(0.16,1,0.3,1); }

        @keyframes glPop {
          0%   { transform:scale(0.8); }
          50%  { transform:scale(1.2); }
          100% { transform:scale(1); }
        }

        .gl-card-title {
          font-family:var(--font-heading); font-size:16px; font-weight:800;
          color:var(--text); margin:0; letter-spacing:-0.3px;
        }

        .gl-card.completed .gl-card-title { text-decoration:line-through; color:var(--muted); }

        .gl-card-actions { display:flex; gap:4px; flex-shrink:0; }

        .gl-icon-btn {
          background:none; border:1px solid transparent; border-radius:8px;
          padding:6px; font-size:13px; color:var(--muted);
          cursor:pointer; transition:all 0.15s; font-family:var(--font-body);
        }

        .gl-icon-btn:hover { background:var(--bg); border-color:var(--border); color:var(--text); }
        .gl-icon-btn.del:hover { background:var(--danger-bg); border-color:var(--danger-border); color:var(--danger-text); }

        .gl-card-desc {
          font-size:13px; color:var(--muted); line-height:1.5; margin:0; font-weight:500;
        }

        .gl-topic-badge {
          display:inline-flex; align-items:center; gap:6px;
          font-size:11px; font-weight:700;
          background:var(--bg); border:1px solid var(--border); color:var(--text);
          padding:4px 10px; border-radius:99px;
          align-self:flex-start;
        }

        .gl-topic-dot {
          width:6px; height:6px; border-radius:50%; background:#f97316;
        }

        /* Progress */
        .gl-progress-wrap { display:flex; flex-direction:column; gap:6px; margin-top:4px; }

        .gl-progress-bg {
          height:8px; border-radius:99px; background:var(--bg); border:1px solid var(--border); overflow:hidden;
        }

        .gl-progress-fill {
          height:100%; border-radius:99px;
          transition:width 0.5s cubic-bezier(0.16,1,0.3,1); box-shadow:inset 0 1px 3px rgba(255,255,255,0.2);
        }

        .gl-progress-meta { display:flex; justify-content:space-between; }

        /* Footer */
        .gl-card-footer {
          display:flex; align-items:center; justify-content:space-between;
          padding-top:12px; border-top:1px solid var(--border); margin-top:4px;
        }

        .gl-created { font-size:12px; color:var(--placeholder); font-weight:600; }

        .gl-deadline { font-size:12px; font-weight:700; font-family:var(--font-body); }

        /* Empty */
        .gl-empty {
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          gap:16px; text-align:center; padding:80px 20px;
        }

        .gl-empty-icon { font-size:48px; color:var(--border); }
        .gl-empty-title {
          font-family:var(--font-heading); font-size:22px; font-weight:800; color:var(--text); margin:0; letter-spacing:-0.5px;
        }
        .gl-empty-sub { font-size:14px; color:var(--muted); margin:0 0 8px; font-weight:500; }

        /* Modal */
        .gl-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.6);
          backdrop-filter:blur(8px); display:flex;
          align-items:center; justify-content:center; z-index:1000; padding:24px;
        }

        .gl-modal {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius: 28px; padding: 40px; width:100%; max-width:480px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px var(--border);
          animation:glSlide 0.3s cubic-bezier(0.16,1,0.3,1);
        }

        @keyframes glSlide {
          from { opacity:0; transform:translateY(24px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }

        .gl-modal-header {
          display:flex; align-items:center;
          justify-content:space-between; margin-bottom:24px;
        }

        .gl-modal-header h2 {
          font-family:var(--font-heading); font-size:24px; font-weight:800; color:var(--text); letter-spacing:-0.5px; margin:0;
        }

        .gl-modal-close {
          background:var(--bg); border:1px solid var(--border); color:var(--muted);
          font-size:14px; cursor:pointer; padding:6px 10px; font-weight:700;
          border-radius:10px; transition:all 0.2s cubic-bezier(0.16,1,0.3,1); box-shadow:0 2px 6px var(--shadow);
        }

        .gl-modal-close:hover { background:var(--hover-bg); color:var(--text); border-color:var(--muted); transform:translateY(-1px); }

        .gl-modal-form { display:flex; flex-direction:column; gap:20px; }
        .gl-field-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .gl-field { display:flex; flex-direction:column; gap:6px; }
        .gl-field label { font-size:12px; font-weight:700; color:var(--text); font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.5px; }
        .gl-opt { font-weight:400; color:var(--placeholder); text-transform:none; font-family:var(--font-body); letter-spacing:0; }

        .gl-field input, .gl-field select, .gl-field textarea {
          background:var(--input-bg); border:2px solid var(--border);
          border-radius:12px; padding:12px 16px;
          font-size:14px; color:var(--text); font-weight:500;
          font-family:var(--font-body); outline:none; resize:vertical;
          transition:all 0.2s; box-shadow:inset 0 1px 3px var(--shadow);
        }

        .gl-field input:focus, .gl-field select:focus, .gl-field textarea:focus {
          border-color:#f97316; background:var(--bg); box-shadow:0 0 0 3px rgba(249,115,22,0.1), inset 0 1px 3px rgba(0,0,0,0.02);
        }

        .gl-field select option { background:var(--card-bg); font-weight:500; }

        .gl-error {
          font-size:13px; font-weight:600; color:var(--danger-text);
          background:var(--danger-bg); border-radius:10px; padding:12px 16px; border:1px solid rgba(239,68,68,0.2);
        }

        .gl-submit {
          background:#f97316; color:white; border:none;
          border-radius:12px; padding:14px; font-size:15px; font-weight:700;
          font-family:var(--font-heading); cursor:pointer; transition:all 0.2s cubic-bezier(0.16,1,0.3,1);
          display:flex; align-items:center; justify-content:center;
          min-height:48px; box-shadow:0 6px 16px rgba(249,115,22,0.3); margin-top:4px;
        }

        .gl-submit:hover:not(:disabled) { background:#ea6c0a; transform:translateY(-2px); box-shadow:0 8px 24px rgba(249,115,22,0.4); }
        .gl-submit:disabled { opacity:0.7; cursor:not-allowed; transform:none; box-shadow:none; }

        .gl-spinner {
          width:18px; height:18px;
          border:3px solid rgba(255,255,255,0.3); border-top-color:white;
          border-radius:50%; animation:glSpin 0.7s linear infinite; display:inline-block;
        }
      `}</style>
        </div>
    );
}
