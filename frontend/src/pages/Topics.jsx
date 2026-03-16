import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';

const DIFFICULTY_COLORS = {
    beginner: { bg: 'rgba(34,197,94,0.12)', text: '#16a34a', label: 'Beginner' },
    intermediate: { bg: 'rgba(249,115,22,0.12)', text: '#ea580c', label: 'Intermediate' },
    advanced: { bg: 'rgba(239,68,68,0.12)', text: '#dc2626', label: 'Advanced' },
};

const STATUS_COLORS = {
    learning: { bg: 'rgba(59,130,246,0.12)', text: '#2563eb', label: 'Learning' },
    mastered: { bg: 'rgba(34,197,94,0.12)', text: '#16a34a', label: 'Mastered' },
};

function Badge({ type, value }) {
    const map = type === 'difficulty' ? DIFFICULTY_COLORS : STATUS_COLORS;
    const c = map[value] || {};
    return (
        <span style={{
            background: c.bg, color: c.text,
            fontSize: 11, fontWeight: 600, padding: '3px 10px',
            borderRadius: 99, letterSpacing: '0.3px',
            textTransform: 'uppercase',
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
        status: topic?.status || 'learning',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async e => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (editing) {
                await api.put(`/topics/${topic.id}`, form);
            } else {
                await api.post('/topics/', form);
            }
            onSaved();
            onClose();
        } catch (err) {
            setError(err.response?.data?.detail || 'Something went wrong');
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
                                <option value="learning">Learning</option>
                                <option value="mastered">Mastered</option>
                            </select>
                        </div>
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

function TopicCard({ topic, onEdit, onDelete }) {
    const [deleting, setDeleting] = useState(false);
    const [confirm, setConfirm] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await api.delete(`/topics/${topic.id}`);
            onDelete();
        } catch (e) {
            console.error(e);
        } finally {
            setDeleting(false);
            setConfirm(false);
        }
    };

    return (
        <div className="topic-card">
            <div className="topic-top">
                <div className="topic-badges">
                    <Badge type="difficulty" value={topic.difficulty} />
                    <Badge type="status" value={topic.status} />
                </div>
                <div className="topic-actions">
                    <button className="icon-btn edit-btn" onClick={() => onEdit(topic)} title="Edit">✎</button>
                    <button className="icon-btn del-btn" onClick={() => setConfirm(true)} disabled={deleting} title="Delete">
                        {deleting ? '...' : '✕'}
                    </button>
                </div>
            </div>
            <h3 className="topic-title">{topic.title}</h3>
            {topic.description && <p className="topic-desc">{topic.description}</p>}
            <p className="topic-date">
                Added {new Date(topic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            {confirm && (
                <ConfirmDialog
                    title="Delete topic"
                    message={`Are you sure you want to delete "${topic.title}"? This will also remove all associated logs.`}
                    onConfirm={handleDelete}
                    onCancel={() => setConfirm(false)}
                />
            )}
        </div>
    );
}

export default function Topics() {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | {} (new) | topic (edit)
    const [filter, setFilter] = useState('all'); // all | learning | mastered
    const [search, setSearch] = useState('');

    const fetchTopics = async () => {
        try {
            const res = await api.get('/topics/');
            setTopics(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTopics(); }, []);

    const filtered = topics
        .filter(t => filter === 'all' || t.status === filter)
        .filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

    if (loading) return (
        <div className="page-loading">
            <div className="loading-ring" />
        </div>
    );

    return (
        <div className="topics-root">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Topics</h1>
                    <p className="page-sub">{topics.length} topic{topics.length !== 1 ? 's' : ''} tracked</p>
                </div>
                <button className="primary-btn" onClick={() => setModal({})}>
                    <span>+</span> New topic
                </button>
            </div>

            {/* Filters */}
            <div className="filter-bar">
                <div className="filter-tabs">
                    {['all', 'learning', 'mastered'].map(f => (
                        <button
                            key={f}
                            className={`filter-tab ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                            <span className="filter-count">
                                {f === 'all' ? topics.length : topics.filter(t => t.status === f).length}
                            </span>
                        </button>
                    ))}
                </div>
                <input
                    className="search-input"
                    placeholder="Search topics..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">◈</div>
                    <p className="empty-title">{search ? 'No topics found' : 'No topics yet'}</p>
                    <p className="empty-sub">{search ? 'Try a different search' : 'Create your first topic to start tracking'}</p>
                    {!search && (
                        <button className="primary-btn" onClick={() => setModal({})}>+ New topic</button>
                    )}
                </div>
            ) : (
                <div className="topics-grid">
                    {filtered.map(t => (
                        <TopicCard
                            key={t.id}
                            topic={t}
                            onEdit={setModal}
                            onDelete={fetchTopics}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            {modal !== null && (
                <TopicModal
                    topic={modal}
                    onClose={() => setModal(null)}
                    onSaved={fetchTopics}
                />
            )}

            <style>{`
        .topics-root {
          padding: 40px 44px;
          max-width: 1100px;
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
          display: flex; align-items: center;
          justify-content: space-between;
          gap: 16px; margin-bottom: 28px; flex-wrap: wrap;
        }

        .filter-tabs {
          display: flex; gap: 4px;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 4px;
        }

        .filter-tab {
          display: flex; align-items: center; gap: 6px;
          background: none; border: none;
          border-radius: 7px; padding: 7px 14px;
          font-size: 13px; font-weight: 500;
          color: var(--muted); cursor: pointer;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
        }

        .filter-tab:hover { color: var(--text); }

        .filter-tab.active {
          background: var(--bg);
          color: var(--text);
          box-shadow: 0 1px 4px var(--shadow);
        }

        .filter-count {
          background: var(--border);
          color: var(--muted);
          font-size: 11px; font-weight: 600;
          padding: 1px 7px; border-radius: 99px;
          min-width: 20px; text-align: center;
        }

        .filter-tab.active .filter-count {
          background: rgba(249,115,22,0.12);
          color: #f97316;
        }

        .search-input {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 16px;
          font-size: 14px;
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          width: 220px;
        }

        .search-input:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .search-input::placeholder { color: var(--placeholder); }

        .topics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .topic-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 22px;
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .topic-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px var(--shadow);
        }

        .topic-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .topic-badges { display: flex; gap: 6px; flex-wrap: wrap; }

        .topic-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; }
        .topic-card:hover .topic-actions { opacity: 1; }

        .icon-btn {
          background: none; border: none;
          border-radius: 6px; padding: 4px 8px;
          font-size: 14px; cursor: pointer;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
        }

        .edit-btn { color: var(--muted); }
        .edit-btn:hover { background: var(--hover-bg); color: #f97316; }
        .del-btn { color: var(--muted); }
        .del-btn:hover { background: var(--danger-bg); color: var(--danger-text); }

        .topic-title {
          font-family: 'Syne', sans-serif;
          font-size: 17px; font-weight: 700;
          color: var(--text); letter-spacing: -0.3px;
          margin: 0;
        }

        .topic-desc {
          font-size: 13px; color: var(--muted);
          line-height: 1.5; margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .topic-date { font-size: 11px; color: var(--placeholder); margin-top: auto; }

        /* Empty state */
        .empty-state {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 80px 20px; gap: 12px; text-align: center;
        }

        .empty-icon {
          font-size: 48px; color: var(--border);
          margin-bottom: 8px;
        }

        .empty-title {
          font-family: 'Syne', sans-serif;
          font-size: 18px; font-weight: 700;
          color: var(--text);
        }

        .empty-sub { font-size: 14px; color: var(--muted); margin-bottom: 8px; }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex; align-items: center;
          justify-content: center; z-index: 1000;
          animation: fadeIn 0.2s ease;
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
          background: none; border: none;
          color: var(--muted); font-size: 16px;
          cursor: pointer; padding: 4px 8px;
          border-radius: 6px; transition: all 0.2s;
        }

        .modal-close:hover { background: var(--hover-bg); color: var(--text); }

        .modal-form { display: flex; flex-direction: column; gap: 18px; }

        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        .field { display: flex; flex-direction: column; gap: 7px; }

        .field label {
          font-size: 13px; font-weight: 500; color: var(--muted);
        }

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