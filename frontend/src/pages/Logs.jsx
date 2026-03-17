import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';
import PomodoroTimer from '../components/PomodoroTimer';

function LogModal({ log, topics, onClose, onSaved }) {
    const editing = !!log?.id;
    const [form, setForm] = useState({
        topic_id: log?.topic_id || '',
        notes: log?.notes || '',
        time_spent: log?.time_spent || '',
        date: log?.date ? log.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    const [tab, setTab] = useState('write');
    const [showTimer, setShowTimer] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async e => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const payload = {
                topic_id: parseInt(form.topic_id),
                notes: form.notes,
                time_spent: parseInt(form.time_spent),
                date: new Date(form.date).toISOString(),
            };
            if (editing) await api.put(`/logs/${log.id}`, payload);
            else await api.post('/logs/', payload);
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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card modal-card-wide" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{editing ? 'Edit log' : 'New log'}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            type="button"
                            className={`timer-toggle-btn ${showTimer ? 'active' : ''}`}
                            onClick={() => setShowTimer(s => !s)}
                            title="Pomodoro timer"
                        >
                            ⏱ Timer
                        </button>
                        <button className="modal-close" onClick={onClose}>✕</button>
                    </div>
                </div>
                <form onSubmit={submit} className="modal-form">
                    <div className="field-row">
                        <div className="field">
                            <label>Topic</label>
                            <select name="topic_id" value={form.topic_id} onChange={handle} required>
                                <option value="">Select topic...</option>
                                {topics.map(t => (
                                    <option key={t.id} value={t.id}>{t.title}</option>
                                ))}
                            </select>
                        </div>
                        <div className="field">
                            <label>Date</label>
                            <input type="date" name="date" value={form.date} onChange={handle} required />
                        </div>
                    </div>

                    {/* Markdown editor */}
                    <div className="field">
                        <div className="editor-header">
                            <label>Notes</label>
                            <div className="editor-tabs">
                                <button
                                    type="button"
                                    className={`editor-tab ${tab === 'write' ? 'active' : ''}`}
                                    onClick={() => setTab('write')}
                                >Write</button>
                                <button
                                    type="button"
                                    className={`editor-tab ${tab === 'preview' ? 'active' : ''}`}
                                    onClick={() => setTab('preview')}
                                    disabled={!form.notes}
                                >Preview</button>
                            </div>
                        </div>
                        {tab === 'write' ? (
                            <textarea
                                name="notes"
                                value={form.notes}
                                onChange={handle}
                                placeholder={`## What I learned today\n\n- Point 1\n- Point 2\n\n**Key insight:** ...`}
                                required
                                rows={10}
                                className="md-textarea"
                            />
                        ) : (
                            <div className="md-preview">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {form.notes}
                                </ReactMarkdown>
                            </div>
                        )}
                        <p className="md-hint">Supports **bold**, *italic*, `code`, lists, headers</p>
                    </div>

                    <div className="field">
                        <label>Time spent (minutes)</label>
                        <input
                            type="number" name="time_spent" value={form.time_spent}
                            onChange={handle} placeholder="e.g. 45" min={1} required
                        />
                    </div>

                    {showTimer && (
                        <PomodoroTimer
                            onSessionComplete={(mins) => {
                                setForm(f => ({ ...f, time_spent: String(parseInt(f.time_spent || 0) + mins) }));
                            }}
                        />
                    )}
                    {error && <p className="form-error">{error}</p>}
                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? <span className="spinner" /> : (editing ? 'Save changes' : 'Save log')}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}

function LogCard({ log, topicMap, onEdit, onDelete }) {
    const [deleting, setDeleting] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const topic = topicMap[log.topic_id];

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await api.delete(`/logs/${log.id}`);
            onDelete();
        } catch (e) {
            console.error(e);
        } finally {
            setDeleting(false);
            setConfirm(false);
        }
    };

    const hours = Math.floor(log.time_spent / 60);
    const mins = log.time_spent % 60;
    const timeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return (
        <div className="log-card">
            <div className="log-top">
                <div className="log-meta">
                    <span className="log-date">
                        {new Date(log.date).toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                        })}
                    </span>
                    {topic && (
                        <span className="log-topic">{topic.title}</span>
                    )}
                </div>
                <div className="log-actions">
                    <button className="icon-btn edit-btn" onClick={() => onEdit(log)} title="Edit">✎</button>
                    <button className="icon-btn del-btn" onClick={() => setConfirm(true)} disabled={deleting} title="Delete">
                        {deleting ? '...' : '✕'}
                    </button>
                </div>
            </div>

            <div className="log-notes">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {log.notes}
                </ReactMarkdown>
            </div>

            <div className="log-footer">
                <span className="time-badge">
                    <span className="time-icon">◷</span> {timeLabel}
                </span>
            </div>
            {confirm && (
                <ConfirmDialog
                    title="Delete log"
                    message="Are you sure you want to delete this log entry? This action cannot be undone."
                    onConfirm={handleDelete}
                    onCancel={() => setConfirm(false)}
                />
            )}
        </div>
    );
}

export default function Logs() {
    const [logs, setLogs] = useState([]);
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [topicFilter, setTopicFilter] = useState('all');
    const [search, setSearch] = useState('');

    const fetchData = async () => {
        try {
            const [logsRes, topicsRes] = await Promise.all([
                api.get('/logs/'),
                api.get('/topics/'),
            ]);
            setLogs(logsRes.data);
            setTopics(topicsRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const topicMap = Object.fromEntries(topics.map(t => [t.id, t]));

    const filtered = logs
        .filter(l => topicFilter === 'all' || l.topic_id === parseInt(topicFilter))
        .filter(l => l.notes.toLowerCase().includes(search.toLowerCase()));

    const totalMinutes = filtered.reduce((s, l) => s + l.time_spent, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    if (loading) return (
        <div className="page-loading">
            <div className="loading-ring" />
        </div>
    );

    return (
        <div className="logs-root">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Logs</h1>
                    <p className="page-sub">{logs.length} entr{logs.length !== 1 ? 'ies' : 'y'} · {totalHours}h total</p>
                </div>
                <button className="primary-btn" onClick={() => setModal({})}>
                    <span>+</span> New log
                </button>
            </div>

            {/* Filters */}
            <div className="filter-bar">
                <select
                    className="topic-select"
                    value={topicFilter}
                    onChange={e => setTopicFilter(e.target.value)}
                >
                    <option value="all">All topics</option>
                    {topics.map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                </select>
                <input
                    className="search-input"
                    placeholder="Search logs..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Logs list */}
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">◷</div>
                    <p className="empty-title">{search ? 'No logs found' : 'No logs yet'}</p>
                    <p className="empty-sub">
                        {search ? 'Try a different search' : 'Start logging your daily learning sessions'}
                    </p>
                    {!search && (
                        <button className="primary-btn" onClick={() => setModal({})}>+ New log</button>
                    )}
                </div>
            ) : (
                <div className="logs-list">
                    {filtered.map(log => (
                        <LogCard
                            key={log.id}
                            log={log}
                            topicMap={topicMap}
                            onEdit={setModal}
                            onDelete={fetchData}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            {modal !== null && (
                <LogModal
                    log={modal}
                    topics={topics}
                    onClose={() => setModal(null)}
                    onSaved={fetchData}
                />
            )}

            <style>{`
        .logs-root {
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
          margin-bottom: 32px; gap: 16px; flex-wrap: wrap;
        }

        .page-title {
          font-family: 'Syne', sans-serif;
          font-size: 28px; font-weight: 700;
          color: var(--text); letter-spacing: -0.5px;
          margin-bottom: 4px;
        }

        .page-sub { font-size: 14px; color: var(--muted); }

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

        .filter-bar {
          display: flex; gap: 12px;
          margin-bottom: 28px; flex-wrap: wrap;
        }

        .topic-select, .search-input {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 16px;
          font-size: 14px; color: var(--text);
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .topic-select { min-width: 180px; }
        .search-input { flex: 1; min-width: 200px; }

        .topic-select:focus, .search-input:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .search-input::placeholder { color: var(--placeholder); }
        .topic-select option { background: var(--card-bg); }

        .logs-list {
          display: flex; flex-direction: column; gap: 14px;
        }

        .log-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px; padding: 22px;
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex; flex-direction: column; gap: 12px;
        }

        .log-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px var(--shadow);
        }

        .log-top {
          display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
        }

        .log-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        .log-date {
          font-size: 12px; font-weight: 600;
          color: var(--muted); letter-spacing: 0.3px;
        }

        .log-topic {
          font-size: 11px; font-weight: 600;
          background: var(--tag-bg); color: var(--tag-text);
          padding: 3px 10px; border-radius: 99px;
          text-transform: uppercase; letter-spacing: 0.3px;
        }

        .log-actions {
          display: flex; gap: 4px;
          opacity: 0.4;
          transition: opacity 0.2s;
        }

        .log-card:hover .log-actions { opacity: 1; }

        .icon-btn {
          background: none; border: none;
          border-radius: 6px; padding: 4px 8px;
          font-size: 14px; cursor: pointer;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
        }

        .edit-btn { color: var(--muted); }
        .edit-btn:hover { background: var(--hover-bg); color: #f97316; }
        .del-btn  { color: var(--muted); }
        .del-btn:hover { background: var(--danger-bg); color: var(--danger-text); }

        .log-notes {
          font-size: 14px; color: var(--text);
          line-height: 1.65; margin: 0;
        }

        .log-notes p  { margin: 0 0 8px; }
        .log-notes p:last-child { margin-bottom: 0; }
        .log-notes h1, .log-notes h2, .log-notes h3 {
          font-family: 'Syne', sans-serif;
          font-weight: 700; color: var(--text);
          margin: 12px 0 6px;
        }
        .log-notes h1 { font-size: 18px; }
        .log-notes h2 { font-size: 16px; }
        .log-notes h3 { font-size: 14px; }
        .log-notes ul, .log-notes ol {
          padding-left: 20px; margin: 6px 0;
        }
        .log-notes li { margin-bottom: 3px; }
        .log-notes code {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 1px 6px;
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          color: #f97316;
        }
        .log-notes pre {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          overflow-x: auto;
          margin: 8px 0;
        }
        .log-notes pre code {
          background: none; border: none;
          padding: 0; color: var(--text);
        }
        .log-notes strong { font-weight: 600; color: var(--text); }
        .log-notes em { font-style: italic; color: var(--muted); }
        .log-notes blockquote {
          border-left: 3px solid #f97316;
          padding-left: 12px;
          margin: 8px 0;
          color: var(--muted);
          font-style: italic;
        }
        .log-notes a { color: #f97316; text-decoration: underline; }
        .log-notes hr {
          border: none;
          border-top: 1px solid var(--border);
          margin: 12px 0;
        }

        .timer-toggle-btn {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 8px; padding: 5px 12px;
          font-size: 12px; font-weight: 500;
          color: var(--muted); cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.2s;
        }

        .timer-toggle-btn:hover,
        .timer-toggle-btn.active {
          background: rgba(249,115,22,0.1);
          border-color: #f97316;
          color: #f97316;
        }

        /* Editor styles */
        .modal-card-wide { max-width: 640px !important; }

        .editor-header {
          display: flex; align-items: center;
          justify-content: space-between;
          margin-bottom: 7px;
        }

        .editor-header label { margin-bottom: 0; }

        .editor-tabs {
          display: flex; gap: 2px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px; padding: 3px;
        }

        .editor-tab {
          background: none; border: none;
          border-radius: 6px; padding: 4px 12px;
          font-size: 12px; font-weight: 500;
          color: var(--muted); cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
        }

        .editor-tab.active {
          background: var(--card-bg);
          color: var(--text);
          box-shadow: 0 1px 3px var(--shadow);
        }

        .editor-tab:disabled {
          opacity: 0.4; cursor: not-allowed;
        }

        .md-textarea {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 12px 14px;
          font-size: 13px; color: var(--text);
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          outline: none; resize: vertical; width: 100%;
          box-sizing: border-box;
          line-height: 1.7;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .md-textarea:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .md-textarea::placeholder { color: var(--placeholder); }

        .md-preview {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 14px;
          min-height: 200px;
          font-size: 14px; color: var(--text);
          line-height: 1.65;
        }

        .md-preview p  { margin: 0 0 8px; }
        .md-preview p:last-child { margin-bottom: 0; }
        .md-preview h1, .md-preview h2, .md-preview h3 {
          font-family: 'Syne', sans-serif; font-weight: 700;
          color: var(--text); margin: 12px 0 6px;
        }
        .md-preview h1 { font-size: 20px; }
        .md-preview h2 { font-size: 17px; }
        .md-preview h3 { font-size: 15px; }
        .md-preview ul, .md-preview ol { padding-left: 20px; margin: 6px 0; }
        .md-preview li { margin-bottom: 3px; }
        .md-preview code {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 4px; padding: 1px 6px;
          font-size: 12px; font-family: monospace; color: #f97316;
        }
        .md-preview pre {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 8px; padding: 12px;
          overflow-x: auto; margin: 8px 0;
        }
        .md-preview pre code { background: none; border: none; padding: 0; color: var(--text); }
        .md-preview strong { font-weight: 600; }
        .md-preview em { font-style: italic; color: var(--muted); }
        .md-preview blockquote {
          border-left: 3px solid #f97316; padding-left: 12px;
          margin: 8px 0; color: var(--muted); font-style: italic;
        }
        .md-preview a { color: #f97316; text-decoration: underline; }

        .md-hint {
          font-size: 11px; color: var(--placeholder);
          margin-top: 6px;
        }

        .log-footer {
          display: flex; align-items: center; gap: 10px;
          padding-top: 8px;
          border-top: 1px solid var(--border);
        }

        .time-badge {
          display: flex; align-items: center; gap: 5px;
          font-size: 13px; font-weight: 600;
          color: #f97316;
        }

        .time-icon { font-size: 15px; }

        /* Empty state */
        .empty-state {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 80px 20px; gap: 12px; text-align: center;
        }

        .empty-icon {
          font-size: 48px; color: var(--border); margin-bottom: 8px;
        }

        .empty-title {
          font-family: 'Syne', sans-serif;
          font-size: 18px; font-weight: 700; color: var(--text);
        }

        .empty-sub { font-size: 14px; color: var(--muted); margin-bottom: 8px; }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex; align-items: flex-start;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
          overflow-y: auto;
          padding: 40px 16px;
        }

        .modal-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px; padding: 32px;
          width: 100%; max-width: 500px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.3);
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          flex-shrink: 0;
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

        .submit-btn:hover:not(:disabled) {
          background: #ea6c0a; transform: translateY(-1px);
        }

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