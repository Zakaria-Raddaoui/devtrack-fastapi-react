import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';

const DIFFICULTY_COLORS = {
    beginner: { bg: 'rgba(34,197,94,0.12)', text: '#16a34a', label: 'Beginner' },
    intermediate: { bg: 'rgba(249,115,22,0.12)', text: '#ea580c', label: 'Intermediate' },
    advanced: { bg: 'rgba(239,68,68,0.12)', text: '#dc2626', label: 'Advanced' },
};

const STATUS_META = {
    to_learn: { label: 'To Learn', color: '#6b7280', accent: 'rgba(107,114,128,0.08)' },
    learning: { label: 'Learning', color: '#3b82f6', accent: 'rgba(59,130,246,0.08)' },
    mastered: { label: 'Mastered', color: '#22c55e', accent: 'rgba(34,197,94,0.08)' },
};

const COLUMNS = ['to_learn', 'learning', 'mastered'];

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

function TopicModal({ topic, onClose, onSaved }) {
    const editing = !!topic?.id;
    const [form, setForm] = useState({
        title: topic?.title || '',
        description: topic?.description || '',
        difficulty: topic?.difficulty || 'beginner',
        status: topic?.status || 'to_learn',
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
            const payload = {
                ...form,
                goal_hours: form.goal_hours ? parseFloat(form.goal_hours) : null,
            };
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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{editing ? 'Edit topic' : 'New topic'}</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit} className="modal-form">
                    <div className="field">
                        <label>Title</label>
                        <input name="title" value={form.title} onChange={handle}
                            placeholder="e.g. Docker, React, Machine Learning" required />
                    </div>
                    <div className="field">
                        <label>Description</label>
                        <textarea name="description" value={form.description} onChange={handle}
                            placeholder="What's this topic about?" rows={3} />
                    </div>
                    <div className="field-row">
                        <div className="field">
                            <label>Difficulty</label>
                            <select name="difficulty" value={form.difficulty} onChange={handle}>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>
                        <div className="field">
                            <label>Status</label>
                            <select name="status" value={form.status} onChange={handle}>
                                <option value="to_learn">To Learn</option>
                                <option value="learning">Learning</option>
                                <option value="mastered">Mastered</option>
                            </select>
                        </div>
                    </div>
                    <div className="field">
                        <label>Goal hours <span style={{ color: 'var(--placeholder)', fontWeight: 400 }}>(optional)</span></label>
                        <input type="number" name="goal_hours" value={form.goal_hours} onChange={handle}
                            placeholder="e.g. 20" min={0.5} step={0.5} />
                    </div>
                    {error && <p className="form-error">{error}</p>}
                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? <span className="spinner" /> : (editing ? 'Save changes' : 'Create topic')}
                    </button>
                </form>
            </div>
        </div>
    );
}

function ProgressBar({ topic, loggedMinutes }) {
    if (!topic.goal_hours) return null;
    const goalMinutes = topic.goal_hours * 60;
    const pct = Math.min(100, Math.round((loggedMinutes / goalMinutes) * 100));
    const color = pct >= 100 ? '#22c55e' : pct >= 60 ? '#f97316' : '#3b82f6';
    return (
        <div className="progress-wrap">
            <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="progress-label" style={{ color }}>
                {pct}% · {(loggedMinutes / 60).toFixed(1)}h / {topic.goal_hours}h
            </span>
        </div>
    );
}

function TopicCard({ topic, index, onEdit, onDelete, loggedMinutes }) {
    const [confirm, setConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await api.delete(`/topics/${topic.id}`);
            onDelete();
        } catch (e) { console.error(e); }
        finally { setDeleting(false); setConfirm(false); }
    };

    return (
        <Draggable draggableId={String(topic.id)} index={index}>
            {(provided, snapshot) => (
                <div
                    className={`topic-card ${snapshot.isDragging ? 'dragging' : ''}`}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                >
                    <div className="topic-top">
                        <Badge value={topic.difficulty} map={DIFFICULTY_COLORS} />
                        <div className="topic-actions">
                            <button className="icon-btn edit-btn" onClick={() => onEdit(topic)} title="Edit">✎</button>
                            <button className="icon-btn del-btn" onClick={() => setConfirm(true)} disabled={deleting} title="Delete">
                                {deleting ? '...' : '✕'}
                            </button>
                        </div>
                    </div>
                    <h3 className="topic-title">{topic.title}</h3>
                    {topic.description && <p className="topic-desc">{topic.description}</p>}
                    <ProgressBar topic={topic} loggedMinutes={loggedMinutes} />
                    <p className="topic-date">
                        Added {new Date(topic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    {confirm && (
                        <ConfirmDialog
                            title="Delete topic"
                            message={`Delete "${topic.title}"? All associated logs will also be removed.`}
                            onConfirm={handleDelete}
                            onCancel={() => setConfirm(false)}
                        />
                    )}
                </div>
            )}
        </Draggable>
    );
}

function KanbanColumn({ status, topics, onEdit, onDelete, topicMinutes }) {
    const meta = STATUS_META[status];
    return (
        <div className="kanban-col">
            <div className="col-header">
                <div className="col-dot" style={{ background: meta.color }} />
                <span className="col-label">{meta.label}</span>
                <span className="col-count">{topics.length}</span>
            </div>
            <Droppable droppableId={status}>
                {(provided, snapshot) => (
                    <div
                        className={`col-body ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{ background: snapshot.isDraggingOver ? meta.accent : undefined }}
                    >
                        {topics.map((t, i) => (
                            <TopicCard
                                key={t.id}
                                topic={t}
                                index={i}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                loggedMinutes={topicMinutes[t.id] || 0}
                            />
                        ))}
                        {provided.placeholder}
                        {topics.length === 0 && !snapshot.isDraggingOver && (
                            <div className="col-empty">Drop topics here</div>
                        )}
                    </div>
                )}
            </Droppable>
        </div>
    );
}

export default function Topics() {
    const [topics, setTopics] = useState([]);
    const [topicMinutes, setTopicMinutes] = useState({});
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [search, setSearch] = useState('');

    const fetchData = async () => {
        try {
            const [topicsRes, logsRes] = await Promise.all([
                api.get('/topics/'),
                api.get('/logs/'),
            ]);
            setTopics(topicsRes.data);
            const mins = {};
            logsRes.data.forEach(l => {
                mins[l.topic_id] = (mins[l.topic_id] || 0) + l.time_spent;
            });
            setTopicMinutes(mins);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const onDragEnd = async (result) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId;
        const topicId = parseInt(draggableId);

        setTopics(prev => {
            const dragged = { ...prev.find(t => t.id === topicId), status: newStatus };
            const rest = prev.filter(t => t.id !== topicId);
            const sameCol = rest.filter(t => t.status === newStatus);
            const others = rest.filter(t => t.status !== newStatus);
            sameCol.splice(destination.index, 0, dragged);
            return [...others, ...sameCol];
        });

        if (newStatus !== source.droppableId) {
            try {
                await api.put(`/topics/${topicId}`, { status: newStatus });
            } catch (e) {
                console.error(e);
                fetchData();
            }
        }
    };

    const filtered = topics.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase())
    );

    const byStatus = status => filtered.filter(t => t.status === status);

    if (loading) return (
        <div className="page-loading"><div className="loading-ring" /></div>
    );

    return (
        <div className="topics-root">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Topics</h1>
                    <p className="page-sub">{topics.length} topic{topics.length !== 1 ? 's' : ''} tracked</p>
                </div>
                <div className="header-right">
                    <input
                        className="search-input"
                        placeholder="Search topics..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <button className="primary-btn" onClick={() => setModal({})}>
                        <span>+</span> New topic
                    </button>
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="kanban-board">
                    {COLUMNS.map(status => (
                        <KanbanColumn
                            key={status}
                            status={status}
                            topics={byStatus(status)}
                            onEdit={setModal}
                            onDelete={fetchData}
                            topicMinutes={topicMinutes}
                        />
                    ))}
                </div>
            </DragDropContext>

            {modal !== null && (
                <TopicModal
                    topic={modal}
                    onClose={() => setModal(null)}
                    onSaved={fetchData}
                />
            )}

            <style>{`
        .topics-root {
          padding: 40px 44px;
          width: 100%;
          box-sizing: border-box;
          animation: fadeIn 0.4s ease forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .page-loading {
          display: flex; align-items: center;
          justify-content: center; height: 100vh;
        }

        .loading-ring {
          width: 36px; height: 36px;
          border: 3px solid var(--border);
          border-top-color: #f97316;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .page-header {
          display: flex; align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 28px; gap: 16px; flex-wrap: wrap;
        }

        .page-title {
          font-family: 'Syne', sans-serif;
          font-size: 28px; font-weight: 700;
          color: var(--text); letter-spacing: -0.5px;
          margin-bottom: 4px;
        }

        .page-sub { font-size: 14px; color: var(--muted); }

        .header-right {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }

        .search-input {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 10px 16px;
          font-size: 14px; color: var(--text);
          font-family: 'DM Sans', sans-serif;
          outline: none; width: 220px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .search-input:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .search-input::placeholder { color: var(--placeholder); }

        .primary-btn {
          display: flex; align-items: center; gap: 8px;
          background: #f97316; color: white; border: none;
          border-radius: 10px; padding: 11px 20px;
          font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(249,115,22,0.3);
          white-space: nowrap;
        }

        .primary-btn span { font-size: 18px; line-height: 1; }
        .primary-btn:hover { background: #ea6c0a; transform: translateY(-1px); }

        .kanban-board {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          align-items: start;
          padding-bottom: 40px;
        }

        .kanban-col {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
        }

        .col-header {
          display: flex; align-items: center; gap: 8px;
          padding: 16px 18px;
          border-bottom: 1px solid var(--border);
          border-radius: 16px 16px 0 0;
        }

        .col-dot {
          width: 8px; height: 8px;
          border-radius: 50%; flex-shrink: 0;
        }

        .col-label {
          font-family: 'Syne', sans-serif;
          font-size: 14px; font-weight: 700;
          color: var(--text); flex: 1;
        }

        .col-count {
          font-size: 12px; font-weight: 600;
          background: var(--bg); color: var(--muted);
          padding: 2px 8px; border-radius: 99px;
          border: 1px solid var(--border);
        }

        .col-body {
          padding: 12px;
          display: flex; flex-direction: column; gap: 10px;
          min-height: 80px;
          border-radius: 0 0 16px 16px;
          transition: background 0.15s;
        }

        .col-empty {
          text-align: center; padding: 32px 16px;
          color: var(--placeholder); font-size: 13px;
          border: 2px dashed var(--border);
          border-radius: 10px; margin-top: 4px;
        }

        .topic-card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px; padding: 16px;
          display: flex; flex-direction: column; gap: 8px;
          cursor: grab; user-select: none;
        }

        .topic-card:hover { box-shadow: 0 4px 16px var(--shadow); }

        .topic-card.dragging {
          box-shadow: 0 12px 40px var(--shadow);
          cursor: grabbing;
          opacity: 0.95;
        }

        .topic-top {
          display: flex; align-items: center;
          justify-content: space-between; gap: 8px;
        }

        .topic-actions {
          display: flex; gap: 4px;
          opacity: 0.4; transition: opacity 0.2s;
        }

        .topic-card:hover .topic-actions { opacity: 1; }

        .icon-btn {
          background: none; border: none;
          border-radius: 6px; padding: 3px 7px;
          font-size: 13px; cursor: pointer;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
        }

        .edit-btn { color: var(--muted); }
        .edit-btn:hover { background: var(--hover-bg); color: #f97316; }
        .del-btn { color: var(--muted); }
        .del-btn:hover { background: var(--danger-bg); color: var(--danger-text); }

        .topic-title {
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 700;
          color: var(--text); margin: 0; letter-spacing: -0.3px;
        }

        .topic-desc {
          font-size: 12px; color: var(--muted);
          line-height: 1.5; margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .topic-date { font-size: 11px; color: var(--placeholder); margin-top: 2px; }

        .progress-wrap { display: flex; flex-direction: column; gap: 4px; }

        .progress-bar-bg {
          height: 4px; border-radius: 99px;
          background: var(--border); overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%; border-radius: 99px;
          transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .progress-label { font-size: 11px; font-weight: 600; }

        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex; align-items: center;
          justify-content: center; z-index: 1000;
        }

        .modal-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px; padding: 32px;
          width: 100%; max-width: 460px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.3);
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .modal-header {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 24px;
        }

        .modal-header h2 {
          font-family: 'Syne', sans-serif;
          font-size: 20px; font-weight: 700; color: var(--text);
        }

        .modal-close {
          background: none; border: none; color: var(--muted);
          font-size: 16px; cursor: pointer; padding: 4px 8px;
          border-radius: 6px; transition: all 0.2s;
        }

        .modal-close:hover { background: var(--hover-bg); color: var(--text); }

        .modal-form { display: flex; flex-direction: column; gap: 18px; }

        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        .field { display: flex; flex-direction: column; gap: 7px; }

        .field label { font-size: 13px; font-weight: 500; color: var(--muted); }

        .field input, .field select, .field textarea {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 11px 14px;
          font-size: 14px; color: var(--text);
          font-family: 'DM Sans', sans-serif;
          outline: none; resize: vertical;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .field input:focus, .field select:focus, .field textarea:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .field select option { background: var(--card-bg); }

        .form-error {
          font-size: 13px; color: var(--danger-text);
          background: var(--danger-bg);
          border-radius: 8px; padding: 10px 14px;
        }

        .submit-btn {
          background: #f97316; color: white; border: none;
          border-radius: 10px; padding: 12px;
          font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center;
          justify-content: center; min-height: 44px;
          box-shadow: 0 4px 16px rgba(249,115,22,0.3);
        }

        .submit-btn:hover:not(:disabled) { background: #ea6c0a; transform: translateY(-1px); }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
      `}</style>
        </div>
    );
}