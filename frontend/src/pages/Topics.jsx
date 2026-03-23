import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';
import StudySession from '../components/StudySession';

const DIFFICULTY = {
    beginner: { bg: 'rgba(34,197,94,0.12)', text: '#16a34a', label: 'Beginner', border: '#16a34a' },
    intermediate: { bg: 'rgba(249,115,22,0.12)', text: '#ea580c', label: 'Intermediate', border: '#ea580c' },
    advanced: { bg: 'rgba(239,68,68,0.12)', text: '#dc2626', label: 'Advanced', border: '#dc2626' },
};

const STATUS_META = {
    to_learn: { label: 'To Learn', color: '#6b7280', light: 'rgba(107,114,128,0.1)', icon: '○' },
    learning: { label: 'Learning', color: '#3b82f6', light: 'rgba(59,130,246,0.1)', icon: '◑' },
    mastered: { label: 'Mastered', color: '#22c55e', light: 'rgba(34,197,94,0.1)', icon: '●' },
};

const COLUMNS = ['to_learn', 'learning', 'mastered'];

// ─── Modal ────────────────────────────────────────────────────────────────────

function TopicModal({ topic, defaultStatus, onClose, onSaved }) {
    const editing = !!topic?.id;
    const [form, setForm] = useState({
        title: topic?.title || '',
        description: topic?.description || '',
        difficulty: topic?.difficulty || 'beginner',
        status: topic?.status || defaultStatus || 'to_learn',
        goal_hours: topic?.goal_hours || '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async e => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const payload = { ...form, goal_hours: form.goal_hours ? parseFloat(form.goal_hours) : null };
            if (editing) await api.put(`/topics/${topic.id}`, payload);
            else await api.post('/topics/', payload);
            onSaved();
            onClose();
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Validation error — check your inputs');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="tp-overlay" onClick={onClose}>
            <div className="tp-modal" onClick={e => e.stopPropagation()}>
                <div className="tp-modal-header">
                    <h2>{editing ? 'Edit topic' : 'New topic'}</h2>
                    <button className="tp-modal-close" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit} className="tp-modal-form">
                    <div className="tp-field">
                        <label>Title</label>
                        <input name="title" value={form.title} onChange={handle}
                            placeholder="e.g. Docker, React, System Design" required autoFocus />
                    </div>
                    <div className="tp-field">
                        <label>Description <span className="tp-opt">(optional)</span></label>
                        <textarea name="description" value={form.description} onChange={handle}
                            placeholder="What's this topic about?" rows={2} />
                    </div>
                    <div className="tp-field-row">
                        <div className="tp-field">
                            <label>Difficulty</label>
                            <select name="difficulty" value={form.difficulty} onChange={handle}>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>
                        <div className="tp-field">
                            <label>Status</label>
                            <select name="status" value={form.status} onChange={handle}>
                                <option value="to_learn">To Learn</option>
                                <option value="learning">Learning</option>
                                <option value="mastered">Mastered</option>
                            </select>
                        </div>
                    </div>
                    <div className="tp-field">
                        <label>Goal hours <span className="tp-opt">(optional)</span></label>
                        <input type="number" name="goal_hours" value={form.goal_hours} onChange={handle}
                            placeholder="e.g. 20" min={0.5} step={0.5} />
                    </div>
                    {error && <p className="tp-form-error">{error}</p>}
                    <button type="submit" className="tp-submit" disabled={loading}>
                        {loading ? <span className="tp-spinner" /> : (editing ? 'Save changes' : 'Create topic')}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function TopicCard({ topic, index, onEdit, onDelete, loggedMinutes, onStartSession }) {
    const [confirm, setConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const navigate = useNavigate();
    const diff = DIFFICULTY[topic.difficulty] || DIFFICULTY.beginner;

    const handleDelete = async () => {
        setDeleting(true);
        try { await api.delete(`/topics/${topic.id}`); onDelete(); }
        catch (e) { console.error(e); }
        finally { setDeleting(false); setConfirm(false); }
    };

    const hours = (loggedMinutes / 60).toFixed(1);
    const pct = topic.goal_hours ? Math.min(100, Math.round((loggedMinutes / (topic.goal_hours * 60)) * 100)) : null;
    const progressColor = pct === null ? '#f97316' : pct >= 100 ? '#22c55e' : pct >= 60 ? '#f97316' : '#3b82f6';

    return (
        <Draggable draggableId={String(topic.id)} index={index}>
            {(provided, snapshot) => (
                <div
                    className={`tp-card ${snapshot.isDragging ? 'dragging' : ''}`}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{
                        ...provided.draggableProps.style,
                        borderLeft: `3px solid ${diff.border}`,
                    }}
                >
                    {/* Top row */}
                    <div className="tp-card-top">
                        <span className="tp-diff-badge" style={{ background: diff.bg, color: diff.text }}>
                            {diff.label}
                        </span>
                        <div className="tp-card-actions">
                            <button className="tp-icon-btn" onClick={() => onEdit(topic)} title="Edit">✎</button>
                            <button className="tp-icon-btn del" onClick={() => setConfirm(true)} disabled={deleting} title="Delete">
                                {deleting ? '…' : '✕'}
                            </button>
                        </div>
                    </div>

                    {/* Title */}
                    <h3
                        className="tp-card-title"
                        onClick={e => { e.stopPropagation(); navigate(`/topics/${topic.id}`); }}
                    >
                        {topic.title}
                        <span className="tp-card-arrow">↗</span>
                    </h3>

                    {topic.description && (
                        <p className="tp-card-desc">{topic.description}</p>
                    )}

                    {/* Progress bar */}
                    {topic.goal_hours && (
                        <div className="tp-progress-wrap">
                            <div className="tp-progress-bg">
                                <div className="tp-progress-fill" style={{ width: `${pct}%`, background: progressColor }} />
                            </div>
                            <div className="tp-progress-meta">
                                <span style={{ color: progressColor, fontWeight: 600, fontSize: 11 }}>{pct}%</span>
                                <span style={{ color: 'var(--muted)', fontSize: 11 }}>{hours}h / {topic.goal_hours}h</span>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="tp-card-footer">
                        <span className="tp-hours-badge" style={{ color: loggedMinutes > 0 ? '#f97316' : 'var(--placeholder)' }}>
                            ◷ {loggedMinutes > 0 ? `${hours}h logged` : 'No logs yet'}
                        </span>
                        <span className="tp-card-date">
                            {new Date(topic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                    </div>

                    {/* Start session button — appears on hover */}
                    <button
                        className="tp-session-btn"
                        onClick={e => { e.stopPropagation(); onStartSession(topic.id); }}
                        title="Start a study session"
                    >
                        ⏱ Start session
                    </button>

                    {confirm && (
                        <ConfirmDialog
                            title="Delete topic"
                            message={`Delete "${topic.title}"? All logs will also be removed.`}
                            onConfirm={handleDelete}
                            onCancel={() => setConfirm(false)}
                        />
                    )}
                </div>
            )}
        </Draggable>
    );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({ status, topics, onEdit, onDelete, topicMinutes, onAdd, onStartSession }) {
    const meta = STATUS_META[status];
    const totalHours = (topics.reduce((s, t) => s + (topicMinutes[t.id] || 0), 0) / 60).toFixed(1);

    return (
        <div className="tp-col">
            {/* Column header */}
            <div className="tp-col-header" style={{ borderTop: `3px solid ${meta.color}` }}>
                <div className="tp-col-header-left">
                    <span className="tp-col-icon" style={{ color: meta.color }}>{meta.icon}</span>
                    <span className="tp-col-label">{meta.label}</span>
                    <span className="tp-col-count" style={{ background: meta.light, color: meta.color }}>
                        {topics.length}
                    </span>
                </div>
                <div className="tp-col-header-right">
                    {totalHours > 0 && (
                        <span className="tp-col-hours">◷ {totalHours}h</span>
                    )}
                    <button
                        className="tp-col-add-btn"
                        onClick={() => onAdd(status)}
                        title={`Add to ${meta.label}`}
                    >+</button>
                </div>
            </div>

            {/* Droppable body */}
            <Droppable droppableId={status}>
                {(provided, snapshot) => (
                    <div
                        className={`tp-col-body ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{ background: snapshot.isDraggingOver ? meta.light : undefined }}
                    >
                        {topics.map((t, i) => (
                            <TopicCard
                                key={t.id}
                                topic={t}
                                index={i}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                loggedMinutes={topicMinutes[t.id] || 0}
                                onStartSession={onStartSession}
                            />
                        ))}
                        {provided.placeholder}
                        {topics.length === 0 && !snapshot.isDraggingOver && (
                            <div className="tp-col-empty" onClick={() => onAdd(status)}>
                                <span className="tp-col-empty-icon">+</span>
                                <span>Add a topic</span>
                            </div>
                        )}
                    </div>
                )}
            </Droppable>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Topics() {
    const [topics, setTopics] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [defaultStatus, setDefaultStatus] = useState('to_learn');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('date');
    const [sessionTopicId, setSessionTopicId] = useState(null);

    const fetchData = async () => {
        try {
            const [topicsRes, logsRes] = await Promise.all([
                api.get('/topics/?limit=100'),
                api.get('/logs/'),
            ]);
            setTopics(topicsRes.data);
            setLogs(logsRes.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    // Minutes logged per topic
    const topicMinutes = logs.reduce((acc, log) => {
        if (log.topic_id) acc[log.topic_id] = (acc[log.topic_id] || 0) + log.time_spent;
        return acc;
    }, {});

    const onDragEnd = async ({ source, destination, draggableId }) => {
        if (!destination || source.droppableId === destination.droppableId) return;
        const id = parseInt(draggableId);
        const status = destination.droppableId;
        setTopics(prev => prev.map(t => t.id === id ? { ...t, status } : t));
        try { await api.put(`/topics/${id}`, { status }); }
        catch (e) { console.error(e); fetchData(); }
    };

    const openAdd = (status) => {
        setDefaultStatus(status);
        setModal({});
    };

    // Filter + sort
    const filtered = topics
        .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            if (sort === 'hours') return (topicMinutes[b.id] || 0) - (topicMinutes[a.id] || 0);
            return new Date(b.created_at) - new Date(a.created_at);
        });

    const byStatus = status => filtered.filter(t => t.status === status);

    // Stats
    const totalHours = (Object.values(topicMinutes).reduce((s, m) => s + m, 0) / 60).toFixed(1);
    const masteredCount = topics.filter(t => t.status === 'mastered').length;
    const learningCount = topics.filter(t => t.status === 'learning').length;

    if (loading) return (
        <div className="tp-loading"><div className="tp-ring" /></div>
    );

    return (
        <div className="tp-root">
            {/* Header */}
            <div className="tp-header">
                <div>
                    <h1 className="tp-page-title">Topics</h1>
                    <p className="tp-page-sub">{topics.length} topic{topics.length !== 1 ? 's' : ''} tracked</p>
                </div>
                <button className="tp-primary-btn" onClick={() => { setDefaultStatus('to_learn'); setModal({}); }}>
                    <span>+</span> New topic
                </button>
            </div>

            {/* Stats bar */}
            <div className="tp-stats-bar">
                <div className="tp-stat">
                    <span className="tp-stat-val" style={{ color: '#f97316' }}>{totalHours}h</span>
                    <span className="tp-stat-label">Total logged</span>
                </div>
                <div className="tp-stat-divider" />
                <div className="tp-stat">
                    <span className="tp-stat-val" style={{ color: '#3b82f6' }}>{learningCount}</span>
                    <span className="tp-stat-label">In progress</span>
                </div>
                <div className="tp-stat-divider" />
                <div className="tp-stat">
                    <span className="tp-stat-val" style={{ color: '#22c55e' }}>{masteredCount}</span>
                    <span className="tp-stat-label">Mastered</span>
                </div>
                <div className="tp-stat-divider" />
                <div className="tp-stat">
                    <span className="tp-stat-val">{topics.length}</span>
                    <span className="tp-stat-label">Total topics</span>
                </div>
            </div>

            {/* Filter + sort bar */}
            <div className="tp-toolbar">
                <div className="tp-search-wrap">
                    <span className="tp-search-icon">⌕</span>
                    <input
                        className="tp-search"
                        placeholder="Filter topics..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className="tp-search-clear" onClick={() => setSearch('')}>✕</button>
                    )}
                </div>
                <div className="tp-sort-toggle">
                    <button
                        className={`tp-sort-btn ${sort === 'date' ? 'active' : ''}`}
                        onClick={() => setSort('date')}
                    >Recent</button>
                    <button
                        className={`tp-sort-btn ${sort === 'hours' ? 'active' : ''}`}
                        onClick={() => setSort('hours')}
                    >Most logged</button>
                </div>
            </div>

            {/* Kanban board */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="tp-board">
                    {COLUMNS.map(status => (
                        <KanbanColumn
                            key={status}
                            status={status}
                            topics={byStatus(status)}
                            onEdit={t => setModal(t)}
                            onDelete={fetchData}
                            topicMinutes={topicMinutes}
                            onAdd={openAdd}
                            onStartSession={setSessionTopicId}
                        />
                    ))}
                </div>
            </DragDropContext>

            {/* Modal */}
            {modal !== null && (
                <TopicModal
                    topic={modal?.id ? modal : null}
                    defaultStatus={defaultStatus}
                    onClose={() => setModal(null)}
                    onSaved={fetchData}
                />
            )}

            {sessionTopicId !== null && (
                <StudySession
                    topics={topics}
                    initialTopicId={sessionTopicId}
                    onClose={() => setSessionTopicId(null)}
                />
            )}

            <style>{`
        .tp-root {
          padding: 40px 44px;
          width: 100%; box-sizing: border-box;
          animation: tpFade 0.4s ease forwards;
        }

        @keyframes tpFade {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .tp-loading {
          display: flex; align-items: center; justify-content: center; height: 100vh;
        }

        .tp-ring {
          width: 36px; height: 36px;
          border: 3px solid var(--border); border-top-color: #f97316;
          border-radius: 50%; animation: tpSpin 0.8s linear infinite;
        }

        @keyframes tpSpin { to { transform: rotate(360deg); } }

        /* Header */
        .tp-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; margin-bottom: 24px;
          gap: 16px; flex-wrap: wrap;
        }

        .tp-page-title {
          font-family: 'Syne', sans-serif;
          font-size: 28px; font-weight: 700;
          color: var(--text); letter-spacing: -0.5px; margin: 0 0 4px;
        }

        .tp-page-sub { font-size: 14px; color: var(--muted); margin: 0; }

        .tp-primary-btn {
          display: flex; align-items: center; gap: 8px;
          background: #f97316; color: white; border: none;
          border-radius: 10px; padding: 11px 20px;
          font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(249,115,22,0.3);
          white-space: nowrap; flex-shrink: 0;
        }

        .tp-primary-btn span { font-size: 18px; line-height: 1; }
        .tp-primary-btn:hover { background: #ea6c0a; transform: translateY(-1px); }

        /* Stats bar */
        .tp-stats-bar {
          display: flex; align-items: center; gap: 0;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 14px; padding: 16px 24px;
          margin-bottom: 20px;
        }

        .tp-stat {
          display: flex; flex-direction: column; gap: 3px;
          flex: 1; align-items: center;
        }

        .tp-stat-val {
          font-family: 'Syne', sans-serif;
          font-size: 24px; font-weight: 800;
          letter-spacing: -0.5px; line-height: 1; color: var(--text);
        }

        .tp-stat-label {
          font-size: 11px; color: var(--muted);
          text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;
        }

        .tp-stat-divider {
          width: 1px; height: 36px; background: var(--border); flex-shrink: 0; margin: 0 8px;
        }

        /* Toolbar */
        .tp-toolbar {
          display: flex; align-items: center;
          gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
        }

        .tp-search-wrap {
          display: flex; align-items: center; gap: 8px;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: 8px 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          flex: 1; max-width: 320px;
        }

        .tp-search-wrap:focus-within {
          border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.1);
        }

        .tp-search-icon { font-size: 14px; color: var(--muted); }

        .tp-search {
          flex: 1; background: none; border: none; outline: none;
          font-size: 14px; color: var(--text); font-family: 'DM Sans', sans-serif;
        }

        .tp-search::placeholder { color: var(--placeholder); }

        .tp-search-clear {
          background: none; border: none; color: var(--muted);
          cursor: pointer; font-size: 12px; padding: 0 2px;
          transition: color 0.15s;
        }

        .tp-search-clear:hover { color: var(--danger-text); }

        .tp-sort-toggle {
          display: flex; gap: 2px;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: 3px;
        }

        .tp-sort-btn {
          background: none; border: none; border-radius: 7px;
          padding: 6px 14px; font-size: 13px; font-weight: 500;
          color: var(--muted); cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }

        .tp-sort-btn.active {
          background: var(--bg); color: var(--text);
          box-shadow: 0 1px 4px var(--shadow);
        }

        /* Board */
        .tp-board {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 20px; align-items: start; padding-bottom: 40px;
        }

        /* Column */
        .tp-col {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px; overflow: hidden;
        }

        .tp-col-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
        }

        .tp-col-header-left { display: flex; align-items: center; gap: 8px; }
        .tp-col-header-right { display: flex; align-items: center; gap: 8px; }

        .tp-col-icon { font-size: 16px; line-height: 1; }

        .tp-col-label {
          font-family: 'Syne', sans-serif;
          font-size: 14px; font-weight: 700; color: var(--text);
        }

        .tp-col-count {
          font-size: 11px; font-weight: 700;
          padding: 2px 8px; border-radius: 99px;
        }

        .tp-col-hours {
          font-size: 11px; color: var(--muted); font-weight: 500;
        }

        .tp-col-add-btn {
          width: 24px; height: 24px;
          background: var(--bg); border: 1px solid var(--border);
          border-radius: 6px; font-size: 16px; color: var(--muted);
          cursor: pointer; display: flex; align-items: center;
          justify-content: center; transition: all 0.15s; line-height: 1;
        }

        .tp-col-add-btn:hover {
          background: rgba(249,115,22,0.1);
          border-color: #f97316; color: #f97316;
        }

        .tp-col-body {
          padding: 12px; display: flex; flex-direction: column;
          gap: 10px; min-height: 80px;
          transition: background 0.15s;
        }

        .tp-col-empty {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px;
          padding: 28px 16px;
          border: 2px dashed var(--border); border-radius: 10px;
          color: var(--placeholder); font-size: 13px;
          cursor: pointer; transition: all 0.15s;
        }

        .tp-col-empty:hover {
          border-color: #f97316; color: #f97316;
          background: rgba(249,115,22,0.04);
        }

        .tp-col-empty-icon {
          font-size: 20px; line-height: 1; color: var(--border);
          transition: color 0.15s;
        }

        .tp-col-empty:hover .tp-col-empty-icon { color: #f97316; }

        /* Topic card */
        .tp-card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px; padding: 14px 14px 12px;
          display: flex; flex-direction: column; gap: 8px;
          cursor: grab; user-select: none;
          transition: box-shadow 0.2s, transform 0.15s;
          position: relative;
        }

        .tp-card:hover {
          box-shadow: 0 6px 24px var(--shadow);
          transform: translateY(-1px);
        }

        .tp-card.dragging {
          box-shadow: 0 16px 48px var(--shadow);
          cursor: grabbing; opacity: 0.96;
          transform: rotate(1deg);
        }

        .tp-card-top {
          display: flex; align-items: center;
          justify-content: space-between; gap: 8px;
        }

        .tp-diff-badge {
          font-size: 10px; font-weight: 700;
          padding: 3px 8px; border-radius: 99px;
          letter-spacing: 0.4px; text-transform: uppercase;
        }

        .tp-card-actions {
          display: flex; gap: 2px;
          opacity: 0; transition: opacity 0.15s;
        }

        .tp-card:hover .tp-card-actions { opacity: 1; }

        .tp-icon-btn {
          background: none; border: none; border-radius: 6px;
          padding: 3px 7px; font-size: 13px; color: var(--muted);
          cursor: pointer; transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
        }

        .tp-icon-btn:hover { background: var(--hover-bg); color: #f97316; }
        .tp-icon-btn.del:hover { background: var(--danger-bg); color: var(--danger-text); }

        .tp-card-title {
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 700;
          color: var(--text); margin: 0; letter-spacing: -0.3px;
          cursor: pointer; transition: color 0.15s;
          display: flex; align-items: center; gap: 6px;
        }

        .tp-card-title:hover { color: #f97316; }

        .tp-card-arrow {
          font-size: 11px; opacity: 0;
          transition: opacity 0.15s; color: #f97316;
        }

        .tp-card-title:hover .tp-card-arrow { opacity: 1; }

        .tp-card-desc {
          font-size: 12px; color: var(--muted);
          line-height: 1.5; margin: 0;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Progress */
        .tp-progress-wrap { display: flex; flex-direction: column; gap: 4px; }

        .tp-progress-bg {
          height: 5px; border-radius: 99px;
          background: var(--border); overflow: hidden;
        }

        .tp-progress-fill {
          height: 100%; border-radius: 99px;
          transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tp-progress-meta {
          display: flex; justify-content: space-between;
        }

        /* Footer */
        .tp-card-footer {
          display: flex; align-items: center;
          justify-content: space-between;
          padding-top: 6px;
          border-top: 1px solid var(--border);
        }

        .tp-hours-badge {
          font-size: 11px; font-weight: 600; color: #f97316;
        }

        .tp-hours-badge.empty { color: var(--placeholder); font-weight: 400; }

        .tp-card-date {
          font-size: 10px; color: var(--placeholder);
        }
          .tp-session-btn {
  display: none;
  width: 100%;
  background: rgba(34,197,94,0.08);
  border: 1px solid rgba(34,197,94,0.25);
  border-radius: 8px;
  padding: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #22c55e;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: all 0.15s;
  margin-top: 4px;
}

.tp-card:hover .tp-session-btn {
  display: block;
}

.tp-session-btn:hover {
  background: rgba(34,197,94,0.15);
  border-color: #22c55e;
}

        /* ── Modal ── */
        .tp-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }

        .tp-modal {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 20px; padding: 32px; width: 100%; max-width: 460px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.3);
          animation: tpSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes tpSlide {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .tp-modal-header {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 24px;
        }

        .tp-modal-header h2 {
          font-family: 'Syne', sans-serif;
          font-size: 20px; font-weight: 700; color: var(--text);
        }

        .tp-modal-close {
          background: none; border: none; color: var(--muted);
          font-size: 16px; cursor: pointer; padding: 4px 8px;
          border-radius: 6px; transition: all 0.2s;
        }

        .tp-modal-close:hover { background: var(--hover-bg); color: var(--text); }

        .tp-modal-form { display: flex; flex-direction: column; gap: 18px; }
        .tp-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .tp-field { display: flex; flex-direction: column; gap: 7px; }
        .tp-field label { font-size: 13px; font-weight: 500; color: var(--muted); }
        .tp-opt { font-weight: 400; color: var(--placeholder); }

        .tp-field input, .tp-field select, .tp-field textarea {
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: 11px 14px;
          font-size: 14px; color: var(--text);
          font-family: 'DM Sans', sans-serif; outline: none; resize: vertical;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .tp-field input:focus, .tp-field select:focus, .tp-field textarea:focus {
          border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .tp-field select option { background: var(--card-bg); }

        .tp-form-error {
          font-size: 13px; color: var(--danger-text);
          background: var(--danger-bg); border-radius: 8px; padding: 10px 14px;
        }

        .tp-submit {
          background: #f97316; color: white; border: none;
          border-radius: 10px; padding: 12px; font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
          min-height: 44px; box-shadow: 0 4px 16px rgba(249,115,22,0.3);
        }

        .tp-submit:hover:not(:disabled) { background: #ea6c0a; transform: translateY(-1px); }
        .tp-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .tp-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
          border-radius: 50%; animation: tpSpin 0.7s linear infinite; display: inline-block;
        }

        .drag-over { border-radius: 0 0 16px 16px; }
      `}</style>
        </div>
    );
}