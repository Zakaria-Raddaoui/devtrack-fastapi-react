import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';

const TYPE_COLORS = {
    video: { bg: 'rgba(239,68,68,0.12)', text: '#dc2626', label: 'Video' },
    article: { bg: 'rgba(59,130,246,0.12)', text: '#2563eb', label: 'Article' },
    docs: { bg: 'rgba(34,197,94,0.12)', text: '#16a34a', label: 'Docs' },
    course: { bg: 'rgba(168,85,247,0.12)', text: '#9333ea', label: 'Course' },
    other: { bg: 'rgba(107,114,128,0.12)', text: '#4b5563', label: 'Other' },
};

function TypeBadge({ type }) {
    const t = TYPE_COLORS[type] || TYPE_COLORS.other;
    return (
        <span style={{
            background: t.bg, color: t.text,
            fontSize: 11, fontWeight: 600,
            padding: '3px 10px', borderRadius: 99,
            letterSpacing: '0.3px', textTransform: 'uppercase',
        }}>
            {t.label}
        </span>
    );
}

function ResourceModal({ resource, topics, onClose, onSaved }) {
    const editing = !!resource?.id;
    const [form, setForm] = useState({
        title: resource?.title || '',
        url: resource?.url || '',
        resource_type: resource?.resource_type || 'article',
        topic_id: resource?.topic_id || '',
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
                topic_id: form.topic_id ? parseInt(form.topic_id) : null,
            };
            if (editing) {
                await api.put(`/resources/${resource.id}`, payload);
            } else {
                await api.post('/resources/', payload);
            }
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
                    <h2>{editing ? 'Edit resource' : 'New resource'}</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit} className="modal-form">
                    <div className="field">
                        <label>Title</label>
                        <input
                            name="title" value={form.title} onChange={handle}
                            placeholder="e.g. Docker Crash Course" required
                        />
                    </div>
                    <div className="field">
                        <label>URL</label>
                        <input
                            name="url" value={form.url} onChange={handle}
                            placeholder="https://..." required
                        />
                    </div>
                    <div className="field-row">
                        <div className="field">
                            <label>Type</label>
                            <select name="resource_type" value={form.resource_type} onChange={handle}>
                                <option value="article">Article</option>
                                <option value="video">Video</option>
                                <option value="docs">Docs</option>
                                <option value="course">Course</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div className="field">
                            <label>Topic (optional)</label>
                            <select name="topic_id" value={form.topic_id} onChange={handle}>
                                <option value="">No topic</option>
                                {topics.map(t => (
                                    <option key={t.id} value={t.id}>{t.title}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {error && <p className="form-error">{error}</p>}
                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? <span className="spinner" /> : (editing ? 'Save changes' : 'Add resource')}
                    </button>
                </form>
            </div>
        </div>
    );
}

function ResourceCard({ resource, topicMap, onEdit, onDelete }) {
    const [deleting, setDeleting] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const topic = resource.topic_id ? topicMap[resource.topic_id] : null;

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await api.delete(`/resources/${resource.id}`);
            onDelete();
        } catch (e) {
            console.error(e);
        } finally {
            setDeleting(false);
            setConfirm(false);
        }
    };

    const getDomain = (url) => {
        try { return new URL(url).hostname.replace('www.', ''); }
        catch { return url; }
    };

    return (
        <div className="resource-card">
            <div className="resource-top">
                <div className="resource-badges">
                    <TypeBadge type={resource.resource_type} />
                    {topic && <span className="topic-badge">{topic.title}</span>}
                </div>
                <div className="resource-actions">
                    <button className="icon-btn edit-btn" onClick={() => onEdit(resource)} title="Edit">✎</button>
                    <button className="icon-btn del-btn" onClick={() => setConfirm(true)} disabled={deleting} title="Delete">
                        {deleting ? '...' : '✕'}
                    </button>
                </div>
            </div>

            <h3 className="resource-title">{resource.title}</h3>

            <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="resource-url"
            >
                <span className="url-icon">↗</span>
                {getDomain(resource.url)}
            </a>

            <p className="resource-date">
                Added {new Date(resource.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                })}
            </p>
            {confirm && (
                <ConfirmDialog
                    title="Delete resource"
                    message={`Are you sure you want to delete "${resource.title}"?`}
                    onConfirm={handleDelete}
                    onCancel={() => setConfirm(false)}
                />
            )}
        </div>
    );
}

export default function Resources() {
    const [resources, setResources] = useState([]);
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [typeFilter, setTypeFilter] = useState('all');
    const [topicFilter, setTopicFilter] = useState('all');
    const [search, setSearch] = useState('');

    const fetchData = async () => {
        try {
            const [resRes, topicsRes] = await Promise.all([
                api.get('/resources/'),
                api.get('/topics/'),
            ]);
            setResources(resRes.data);
            setTopics(topicsRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const topicMap = Object.fromEntries(topics.map(t => [t.id, t]));

    const filtered = resources
        .filter(r => typeFilter === 'all' || r.resource_type === typeFilter)
        .filter(r => topicFilter === 'all' || r.topic_id === parseInt(topicFilter))
        .filter(r => r.title.toLowerCase().includes(search.toLowerCase()));

    if (loading) return (
        <div className="page-loading">
            <div className="loading-ring" />
        </div>
    );

    return (
        <div className="resources-root">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Resources</h1>
                    <p className="page-sub">{resources.length} saved resource{resources.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="primary-btn" onClick={() => setModal({})}>
                    <span>+</span> Add resource
                </button>
            </div>

            {/* Filters */}
            <div className="filter-bar">
                <div className="filter-tabs">
                    {['all', 'article', 'video', 'docs', 'course', 'other'].map(f => (
                        <button
                            key={f}
                            className={`filter-tab ${typeFilter === f ? 'active' : ''}`}
                            onClick={() => setTypeFilter(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
                <div className="filter-right">
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
                        placeholder="Search resources..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">⊞</div>
                    <p className="empty-title">{search ? 'No resources found' : 'No resources yet'}</p>
                    <p className="empty-sub">
                        {search ? 'Try a different search' : 'Save useful links, videos, and docs'}
                    </p>
                    {!search && (
                        <button className="primary-btn" onClick={() => setModal({})}>+ Add resource</button>
                    )}
                </div>
            ) : (
                <div className="resources-grid">
                    {filtered.map(r => (
                        <ResourceCard
                            key={r.id}
                            resource={r}
                            topicMap={topicMap}
                            onEdit={setModal}
                            onDelete={fetchData}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            {modal !== null && (
                <ResourceModal
                    resource={modal}
                    topics={topics}
                    onClose={() => setModal(null)}
                    onSaved={fetchData}
                />
            )}

            <style>{`
        .resources-root {
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
          flex-wrap: wrap;
        }

        .filter-tab {
          background: none; border: none;
          border-radius: 7px; padding: 7px 14px;
          font-size: 13px; font-weight: 500;
          color: var(--muted); cursor: pointer;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
        }

        .filter-tab:hover { color: var(--text); }
        .filter-tab.active {
          background: var(--bg); color: var(--text);
          box-shadow: 0 1px 4px var(--shadow);
        }

        .filter-right { display: flex; gap: 10px; flex-wrap: wrap; }

        .topic-select, .search-input {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 10px 16px;
          font-size: 14px; color: var(--text);
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .topic-select { min-width: 160px; }
        .search-input { width: 200px; }

        .topic-select:focus, .search-input:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .search-input::placeholder { color: var(--placeholder); }
        .topic-select option { background: var(--card-bg); }

        .resources-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .resource-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px; padding: 22px;
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex; flex-direction: column; gap: 10px;
        }

        .resource-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px var(--shadow);
        }

        .resource-top {
          display: flex; align-items: center;
          justify-content: space-between; gap: 8px;
        }

        .resource-badges { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }

        .topic-badge {
          font-size: 11px; font-weight: 600;
          background: var(--tag-bg); color: var(--tag-text);
          padding: 3px 10px; border-radius: 99px;
          text-transform: uppercase; letter-spacing: 0.3px;
        }

        .resource-actions {
          display: flex; gap: 4px;
          opacity: 0; transition: opacity 0.2s;
        }

        .resource-card:hover .resource-actions { opacity: 1; }

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

        .resource-title {
          font-family: 'Syne', sans-serif;
          font-size: 16px; font-weight: 700;
          color: var(--text); letter-spacing: -0.3px;
          margin: 0; line-height: 1.3;
        }

        .resource-url {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 13px; color: #f97316;
          text-decoration: none; font-weight: 500;
          transition: opacity 0.2s;
          word-break: break-all;
        }

        .resource-url:hover { opacity: 0.75; }
        .url-icon { font-size: 14px; flex-shrink: 0; }

        .resource-date {
          font-size: 11px; color: var(--placeholder);
          margin-top: auto;
        }

        /* Empty state */
        .empty-state {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 80px 20px; gap: 12px; text-align: center;
        }

        .empty-icon { font-size: 48px; color: var(--border); margin-bottom: 8px; }

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