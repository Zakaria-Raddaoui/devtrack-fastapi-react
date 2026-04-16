import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';

const TYPES = ['all', 'article', 'video', 'course', 'book', 'docs', 'tool', 'other'];

const TYPE_COLORS = {
    article: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
    video: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
    course: { bg: 'rgba(249,115,22,0.12)', text: '#f97316' },
    book: { bg: 'rgba(168,85,247,0.12)', text: '#a855f7' },
    docs: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e' },
    tool: { bg: 'rgba(20,184,166,0.12)', text: '#14b8a6' },
    other: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280' },
};

function StarRating({ value, onChange, readonly }) {
    const [hover, setHover] = useState(0);
    return (
        <div className="rc-stars" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map(i => (
                <button
                    key={i}
                    type="button"
                    className={`rc-star ${(hover || value || 0) >= i ? 'active' : ''}`}
                    onClick={() => !readonly && onChange && onChange(value === i ? null : i)}
                    onMouseEnter={() => !readonly && setHover(i)}
                    disabled={readonly}
                >★</button>
            ))}
        </div>
    );
}

function ResourceModal({ resource, topics, onClose, onSaved }) {
    const editing = !!resource?.id;
    const [form, setForm] = useState({
        title: resource?.title || '',
        url: resource?.url || '',
        resource_type: resource?.resource_type || 'article',
        topic_id: resource?.topic_id || '',
        rating: resource?.rating || null,
        is_read: resource?.is_read || false,
        notes: resource?.notes || '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = e => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm(f => ({ ...f, [e.target.name]: val }));
    };

    const submit = async e => {
        e.preventDefault(); setLoading(true); setError('');
        try {
            const payload = { ...form, topic_id: form.topic_id ? parseInt(form.topic_id) : null };
            if (editing) await api.put(`/resources/${resource.id}`, payload);
            else await api.post('/resources/', payload);
            onSaved(); onClose();
        } catch (err) {
            setError(err.response?.data?.detail || 'Something went wrong');
        } finally { setLoading(false); }
    };

    return createPortal(
        <div className="rc-overlay" onClick={onClose}>
            <div className="rc-modal" onClick={e => e.stopPropagation()}>
                <div className="rc-modal-header">
                    <h2>{editing ? 'Edit resource' : 'Add resource'}</h2>
                    <button className="rc-modal-close" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit} className="rc-modal-form">
                    <div className="rc-field">
                        <label>Title</label>
                        <input name="title" value={form.title} onChange={handle}
                            placeholder="e.g. Docker Deep Dive" required autoFocus />
                    </div>
                    <div className="rc-field">
                        <label>URL</label>
                        <input name="url" value={form.url} onChange={handle}
                            placeholder="https://..." required type="url" />
                    </div>
                    <div className="rc-field-row">
                        <div className="rc-field">
                            <label>Type</label>
                            <select name="resource_type" value={form.resource_type} onChange={handle}>
                                {TYPES.filter(t => t !== 'all').map(t => (
                                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                        <div className="rc-field">
                            <label>Topic <span className="rc-opt">(optional)</span></label>
                            <select name="topic_id" value={form.topic_id} onChange={handle}>
                                <option value="">No topic</option>
                                {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="rc-field">
                        <label>Rating <span className="rc-opt">(optional)</span></label>
                        <StarRating value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} />
                    </div>
                    <div className="rc-field">
                        <label>Notes <span className="rc-opt">(optional)</span></label>
                        <textarea name="notes" value={form.notes} onChange={handle}
                            placeholder="What was useful about this resource?" rows={2} />
                    </div>
                    <label className="rc-check-label">
                        <input type="checkbox" name="is_read" checked={form.is_read} onChange={handle} />
                        Mark as read
                    </label>
                    {error && <p className="rc-error">{error}</p>}
                    <button type="submit" className="rc-submit" disabled={loading}>
                        {loading ? <span className="rc-spinner" /> : (editing ? 'Save changes' : 'Add resource')}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}

function ResourceCard({ resource, topicMap, onEdit, onDelete, onToggleRead, onRate }) {
    const [confirm, setConfirm] = useState(false);
    const type = resource.resource_type || 'other';
    const color = TYPE_COLORS[type] || TYPE_COLORS.other;
    const topic = topicMap[resource.topic_id];

    let domain = '';
    try { domain = new URL(resource.url).hostname.replace('www.', ''); } catch { }

    return (
        <div className={`rc-card ${resource.is_read ? 'read' : ''}`}>
            <div className="rc-card-top">
                <span className="rc-type-badge" style={{ background: color.bg, color: color.text }}>
                    {type}
                </span>
                <div className="rc-card-actions">
                    <button
                        className={`rc-read-btn ${resource.is_read ? 'done' : ''}`}
                        onClick={() => onToggleRead(resource)}
                        title={resource.is_read ? 'Mark unread' : 'Mark as read'}
                    >
                        {resource.is_read ? '✓ Read' : '○ Unread'}
                    </button>
                    <button className="rc-icon-btn" onClick={() => onEdit(resource)} title="Edit">✎</button>
                    <button className="rc-icon-btn del" onClick={() => setConfirm(true)} title="Delete">✕</button>
                </div>
            </div>

            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="rc-title">
                {resource.title}
                <span className="rc-ext-icon">↗</span>
            </a>

            <div className="rc-meta-row">
                {topic && <span className="rc-topic">{topic.title}</span>}
                <span className="rc-domain">{domain}</span>
            </div>

            <StarRating
                value={resource.rating}
                onChange={v => onRate(resource, v)}
            />

            {resource.notes && (
                <p className="rc-notes">"{resource.notes}"</p>
            )}

            {confirm && (
                <ConfirmDialog
                    title="Delete resource"
                    message={`Delete "${resource.title}"?`}
                    onConfirm={() => { onDelete(resource.id); setConfirm(false); }}
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
    const [readFilter, setReadFilter] = useState('all'); // 'all' | 'read' | 'unread'
    const [topicFilter, setTopicFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('date'); // 'date' | 'rating' | 'title'

    const fetchData = useCallback(async () => {
        try {
            const [rRes, tRes] = await Promise.all([api.get('/resources/'), api.get('/topics/?limit=100')]);
            setResources(rRes.data);
            setTopics(tRes.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const topicMap = Object.fromEntries(topics.map(t => [t.id, t]));

    const handleDelete = async (id) => {
        try { await api.delete(`/resources/${id}`); setResources(prev => prev.filter(r => r.id !== id)); }
        catch (e) { console.error(e); }
    };

    const handleToggleRead = async (resource) => {
        try {
            const res = await api.put(`/resources/${resource.id}`, { is_read: !resource.is_read });
            setResources(prev => prev.map(r => r.id === res.data.id ? res.data : r));
        } catch (e) { console.error(e); }
    };

    const handleRate = async (resource, rating) => {
        try {
            const res = await api.put(`/resources/${resource.id}`, { rating });
            setResources(prev => prev.map(r => r.id === res.data.id ? res.data : r));
        } catch (e) { console.error(e); }
    };

    // Filter + sort
    const filtered = resources
        .filter(r => typeFilter === 'all' || r.resource_type === typeFilter)
        .filter(r => readFilter === 'all' || (readFilter === 'read' ? r.is_read : !r.is_read))
        .filter(r => topicFilter === 'all' || String(r.topic_id) === topicFilter)
        .filter(r => !search || r.title.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            if (sort === 'rating') return (b.rating || 0) - (a.rating || 0);
            if (sort === 'title') return a.title.localeCompare(b.title);
            return new Date(b.created_at) - new Date(a.created_at);
        });

    const readCount = resources.filter(r => r.is_read).length;
    const unreadCount = resources.filter(r => !r.is_read).length;
    const ratedCount = resources.filter(r => r.rating).length;
    const avgRating = ratedCount
        ? (resources.filter(r => r.rating).reduce((s, r) => s + r.rating, 0) / ratedCount).toFixed(1)
        : null;

    if (loading) return <div className="rc-loading"><div className="rc-ring" /></div>;

    return (
        <div className="rc-root">
            {/* Header */}
            <div className="rc-header">
                <div>
                    <h1 className="rc-title-h1">Resources</h1>
                    <p className="rc-sub">{resources.length} saved · {readCount} read · {unreadCount} unread</p>
                </div>
                <button className="rc-primary-btn" onClick={() => setModal({})}>
                    <span>+</span> Add resource
                </button>
            </div>

            {/* Stats bar */}
            {resources.length > 0 && (
                <div className="rc-stats-bar">
                    {[
                        { val: resources.length, label: 'Total', color: '#f97316' },
                        { val: readCount, label: 'Read', color: '#22c55e' },
                        { val: unreadCount, label: 'Unread', color: '#3b82f6' },
                        { val: avgRating ? `${avgRating}★` : '—', label: 'Avg rating', color: '#f59e0b' },
                    ].map(({ val, label, color }) => (
                        <div key={label} className="rc-stat">
                            <span className="rc-stat-val" style={{ color }}>{val}</span>
                            <span className="rc-stat-label">{label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="rc-filters">
                {/* Type tabs */}
                <div className="rc-type-tabs">
                    {TYPES.map(t => (
                        <button
                            key={t}
                            className={`rc-type-tab ${typeFilter === t ? 'active' : ''}`}
                            onClick={() => setTypeFilter(t)}
                        >
                            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                            <span className="rc-tab-count">
                                {t === 'all' ? resources.length : resources.filter(r => r.resource_type === t).length}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Second filter row */}
                <div className="rc-filter-row">
                    <div className="rc-search-wrap">
                        <span>⌕</span>
                        <input className="rc-search" placeholder="Search resources..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                        {search && <button className="rc-clear" onClick={() => setSearch('')}>✕</button>}
                    </div>

                    <select className="rc-select" value={topicFilter}
                        onChange={e => setTopicFilter(e.target.value)}>
                        <option value="all">All topics</option>
                        {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>

                    <div className="rc-read-filter">
                        {['all', 'unread', 'read'].map(f => (
                            <button key={f}
                                className={`rc-rf-btn ${readFilter === f ? 'active' : ''}`}
                                onClick={() => setReadFilter(f)}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="rc-sort-toggle">
                        {[['date', 'Recent'], ['rating', 'Top rated'], ['title', 'A–Z']].map(([val, lbl]) => (
                            <button key={val}
                                className={`rc-sort-btn ${sort === val ? 'active' : ''}`}
                                onClick={() => setSort(val)}
                            >{lbl}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="rc-empty">
                    <div className="rc-empty-icon">⊞</div>
                    <h2 className="rc-empty-title">{search ? 'No results found' : 'No resources yet'}</h2>
                    <p className="rc-empty-sub">
                        {search ? 'Try a different search' : 'Save articles, videos, books and more'}
                    </p>
                    {!search && (
                        <button className="rc-primary-btn" onClick={() => setModal({})}>+ Add resource</button>
                    )}
                </div>
            ) : (
                <div className="rc-grid">
                    {filtered.map(r => (
                        <ResourceCard
                            key={r.id}
                            resource={r}
                            topicMap={topicMap}
                            onEdit={setModal}
                            onDelete={handleDelete}
                            onToggleRead={handleToggleRead}
                            onRate={handleRate}
                        />
                    ))}
                </div>
            )}

            {modal !== null && (
                <ResourceModal
                    resource={modal?.id ? modal : null}
                    topics={topics}
                    onClose={() => setModal(null)}
                    onSaved={fetchData}
                />
            )}

            <style>{`
        .rc-root {
          padding: 60px 48px; width: 100%; box-sizing: border-box;
          display: flex; flex-direction: column; gap: 40px;
          animation: rcFade 0.4s ease forwards;
          background: var(--bg);
        }
        @keyframes rcFade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }

        .rc-loading { display:flex; align-items:center; justify-content:center; height:100vh; }
        .rc-ring { width:48px; height:48px; border:4px solid var(--border); border-top-color:#f97316; border-radius:50%; animation:rcSpin 0.8s linear infinite; }
        @keyframes rcSpin { to { transform:rotate(360deg); } }

        .rc-header { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; flex-wrap:wrap; }
        .rc-title-h1 { font-family:var(--font-heading); font-size:38px; font-weight:800; color:var(--text); letter-spacing:-1.5px; margin:0 0 6px; }
        .rc-sub { font-size:15px; color:var(--muted); margin:0; font-weight:500; }

        .rc-primary-btn {
          display:flex; align-items:center; gap:8px;
          background:#f97316; color:white; border:none; border-radius:12px; padding:14px 24px;
          font-size:15px; font-weight:700; font-family:var(--font-heading);
          cursor:pointer; transition:all 0.2s cubic-bezier(0.16,1,0.3,1); box-shadow:0 8px 24px rgba(249,115,22,0.3);
        }
        .rc-primary-btn span { font-size:20px; line-height:1; }
        .rc-primary-btn:hover { background:#ea6c0a; transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,0.4); }

        /* Stats */
        .rc-stats-bar {
          display:flex; background:var(--card-bg); border:1px solid var(--border);
          border-radius:20px; padding:24px 32px; gap:0; box-shadow:0 12px 32px var(--shadow);
        }
        .rc-stat { display:flex; flex-direction:column; gap:4px; flex:1; align-items:center; }
        .rc-stat-val { font-family:var(--font-heading); font-size:32px; font-weight:800; letter-spacing:-1px; }
        .rc-stat-label { font-size:12px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; font-family:var(--font-heading); }

        /* Filters */
        .rc-filters { display:flex; flex-direction:column; gap:16px; margin-bottom:8px; }

        .rc-type-tabs { display:flex; gap:8px; flex-wrap:wrap; }
        .rc-type-tab {
          display:flex; align-items:center; gap:8px;
          background:var(--card-bg); border:1px solid var(--border); border-radius:12px;
          padding:10px 16px; font-size:14px; font-weight:600; color:var(--muted);
          cursor:pointer; font-family:var(--font-body); transition:all 0.2s; box-shadow:0 4px 12px var(--shadow);
        }
        .rc-type-tab:hover { border-color:rgba(249,115,22,0.3); color:#f97316; transform:translateY(-1px); box-shadow:0 6px 16px rgba(249,115,22,0.1); }
        .rc-type-tab.active { background:rgba(249,115,22,0.05); border-color:#f97316; color:#f97316; font-weight:700; box-shadow:inset 0 1px 3px rgba(249,115,22,0.1); }
        .rc-tab-count { font-size:11px; color:var(--placeholder); font-weight:700; background:rgba(0,0,0,0.05); padding:2px 6px; border-radius:99px; }
        .active .rc-tab-count { background:rgba(249,115,22,0.15); color:#f97316; }

        .rc-filter-row { display:flex; gap:16px; flex-wrap:wrap; align-items:center; }

        .rc-search-wrap {
          display:flex; align-items:center; gap:10px;
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:12px; padding:12px 16px; flex:1; max-width:320px;
          transition:all 0.2s; box-shadow:0 4px 12px var(--shadow);
        }
        .rc-search-wrap:focus-within { border-color:#f97316; box-shadow:0 6px 20px rgba(249,115,22,0.15); }
        .rc-search { flex:1; background:none; border:none; outline:none; font-size:14px; color:var(--text); font-family:var(--font-body); font-weight:500; }
        .rc-search::placeholder { color:var(--placeholder); font-weight:400; }
        .rc-clear { background:none; border:none; color:var(--muted); cursor:pointer; font-size:12px; font-weight:700; }

        .rc-select {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:12px; padding:12px 16px; font-size:14px; color:var(--text); font-weight:500;
          font-family:var(--font-body); outline:none; cursor:pointer;
          transition:all 0.2s; box-shadow:0 4px 12px var(--shadow);
        }
        .rc-select:focus { border-color:#f97316; box-shadow:0 6px 20px rgba(249,115,22,0.15); }

        .rc-read-filter, .rc-sort-toggle {
          display:flex; gap:4px; background:var(--card-bg); border:1px solid var(--border);
          border-radius:12px; padding:4px; box-shadow:0 4px 12px var(--shadow);
        }
        .rc-rf-btn, .rc-sort-btn {
          background:none; border:none; border-radius:8px; padding:8px 16px;
          font-size:13px; font-weight:600; color:var(--muted);
          cursor:pointer; font-family:var(--font-body); transition:all 0.2s;
        }
        .rc-rf-btn:hover:not(.active), .rc-sort-btn:hover:not(.active) { color:var(--text); }
        .rc-rf-btn.active, .rc-sort-btn.active {
          background:var(--bg); color:var(--text); box-shadow:0 2px 8px var(--shadow);
        }

        /* Grid */
        .rc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:24px; }

        /* Card */
        .rc-card {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:24px; padding:28px;
          display:flex; flex-direction:column; gap:16px;
          transition:all 0.3s cubic-bezier(0.16,1,0.3,1); box-shadow:0 12px 32px var(--shadow), 0 4px 12px rgba(0,0,0,0.02);
          position:relative; overflow:hidden;
        }
        .rc-card:hover { transform:translateY(-4px); box-shadow:0 16px 40px var(--shadow); border-color:rgba(249,115,22,0.3); }
        .rc-card.read { opacity:0.8; filter:grayscale(20%); }

        .rc-card-top { display:flex; align-items:center; justify-content:space-between; gap:12px; }

        .rc-type-badge {
          font-size:11px; font-weight:800; padding:6px 12px;
          border-radius:99px; text-transform:uppercase; letter-spacing:0.5px; font-family:var(--font-heading);
        }

        .rc-card-actions { display:flex; align-items:center; gap:8px; opacity:0; transition:opacity 0.2s; }
        .rc-card:hover .rc-card-actions { opacity:1; }

        .rc-read-btn {
          background:var(--card-bg); border:2px dashed var(--border); border-radius:10px;
          padding:6px 12px; font-size:12px; font-weight:700; color:var(--muted);
          cursor:pointer; font-family:var(--font-body); transition:all 0.2s;
        }
        .rc-read-btn:hover { border-color:#22c55e; color:#22c55e; background:rgba(34,197,94,0.05); transform:translateY(-1px); }
        .rc-read-btn.done { background:rgba(34,197,94,0.15); border:2px solid rgba(34,197,94,0.3); color:#22c55e; }

        .rc-icon-btn { background:var(--card-bg); border:1px solid var(--border); border-radius:10px; padding:6px 10px; font-size:14px; color:var(--muted); cursor:pointer; transition:all 0.2s; box-shadow:0 2px 6px var(--shadow); }
        .rc-icon-btn:hover { background:rgba(249,115,22,0.1); border-color:rgba(249,115,22,0.3); color:#f97316; transform:translateY(-2px); }
        .rc-icon-btn.del:hover { background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.3); color:#ef4444; }

        .rc-title {
          font-family:var(--font-heading); font-size:18px; font-weight:800;
          color:var(--text); text-decoration:none;
          display:flex; align-items:center; gap:8px; line-height:1.4;
          transition:all 0.2s; letter-spacing:-0.3px;
        }
        .rc-title:hover { color:#f97316; transform:translateX(2px); }
        .rc-ext-icon { font-size:12px; opacity:0; transition:opacity 0.2s; color:#f97316; }
        .rc-title:hover .rc-ext-icon { opacity:1; transform:translate(2px,-2px); }

        .rc-meta-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .rc-topic {
          font-size:12px; font-weight:800; background:rgba(249,115,22,0.15); color:#f97316;
          padding:4px 10px; border-radius:99px; text-transform:uppercase; letter-spacing:0.5px; font-family:var(--font-heading);
        }
        .rc-domain { font-size:13px; color:var(--muted); font-weight:500; background:var(--bg); padding:4px 10px; border-radius:8px; border:1px solid var(--border); }

        /* Stars */
        .rc-stars { display:flex; gap:4px; margin:4px 0; }
        .rc-star {
          background:none; border:none; font-size:22px; cursor:pointer;
          color:var(--border); transition:all 0.2s cubic-bezier(0.16,1,0.3,1); padding:0; line-height:1; text-shadow:0 2px 4px rgba(0,0,0,0.1);
        }
        .rc-star.active { color:#f59e0b; transform:scale(1.1); filter:drop-shadow(0 0 6px rgba(245,158,11,0.4)); }
        .rc-star:disabled { cursor:default; }
        .rc-star:hover:not(:disabled) { transform:scale(1.2); }

        .rc-notes {
          font-size:14px; color:var(--muted); font-style:italic;
          line-height:1.6; margin:0; position:relative; padding-left:16px; font-weight:500;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
        }
        .rc-notes::before { content:'"'; position:absolute; left:0; top:-4px; font-size:32px; color:var(--border); font-family:var(--font-heading); line-height:1; }

        /* Empty */
        .rc-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; text-align:center; padding:100px 20px; }
        .rc-empty-icon { font-size:64px; color:var(--border); }
        .rc-empty-title { font-family:var(--font-heading); font-size:24px; font-weight:800; color:var(--text); margin:0; }
        .rc-empty-sub { font-size:16px; color:var(--muted); margin-bottom:8px; }

        /* Modal */
        .rc-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:1000; padding:24px; }
        .rc-modal { background:var(--card-bg); border:1px solid var(--border); border-radius: 32px; padding: 48px; width:100%; max-width:520px; box-shadow: 0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px var(--border); animation:rcSlide 0.4s cubic-bezier(0.16,1,0.3,1); }
        @keyframes rcSlide { from{opacity:0;transform:translateY(32px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        .rc-modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:32px; }
        .rc-modal-header h2 { font-family:var(--font-heading); font-size:28px; font-weight:800; color:var(--text); letter-spacing:-0.5px; }
        .rc-modal-close { background:var(--card-bg); border:1px solid var(--border); color:var(--muted); font-size:18px; cursor:pointer; padding:8px 12px; border-radius:12px; transition:all 0.2s; box-shadow:0 2px 8px var(--shadow); }
        .rc-modal-close:hover { background:var(--hover-bg); color:var(--text); border-color:var(--muted); transform:translateY(-2px); }
        .rc-modal-form { display:flex; flex-direction:column; gap:24px; }
        .rc-field-row { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .rc-field { display:flex; flex-direction:column; gap:8px; }
        .rc-field label { font-size:14px; font-weight:700; color:var(--text); font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.3px; }
        .rc-opt { font-weight:500; color:var(--placeholder); text-transform:none; letter-spacing:0; font-family:var(--font-body); }
        .rc-field input, .rc-field select, .rc-field textarea { background:var(--input-bg); border:2px solid var(--border); border-radius:16px; padding:16px 20px; font-size:16px; font-weight:500; color:var(--text); font-family:var(--font-body); outline:none; resize:vertical; transition:all 0.2s; box-shadow:inset 0 2px 6px var(--shadow); }
        .rc-field input:focus, .rc-field select:focus, .rc-field textarea:focus { border-color:#f97316; background:var(--bg); box-shadow:0 0 0 4px rgba(249,115,22,0.15), inset 0 2px 6px rgba(0,0,0,0.02); }
        .rc-check-label { display:flex; align-items:center; gap:12px; font-size:15px; font-weight:600; color:var(--text); cursor:pointer; font-family:var(--font-body); background:var(--card-bg); border:1px solid var(--border); padding:16px 20px; border-radius:16px; transition:all 0.2s; }
        .rc-check-label:hover { border-color:rgba(249,115,22,0.3); background:rgba(249,115,22,0.05); }
        .rc-error { font-size:14px; font-weight:600; color:var(--danger-text); background:var(--danger-bg); border-radius:12px; padding:12px 16px; border:1px solid rgba(239,68,68,0.2); }
        .rc-submit { background:#f97316; color:white; border:none; border-radius:16px; padding:16px; font-size:16px; font-weight:700; font-family:var(--font-heading); cursor:pointer; transition:all 0.2s cubic-bezier(0.16,1,0.3,1); display:flex; align-items:center; justify-content:center; min-height:56px; box-shadow:0 8px 24px rgba(249,115,22,0.3); margin-top:8px; }
        .rc-submit:hover:not(:disabled) { background:#ea6c0a; transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,0.4); }
        .rc-submit:disabled { opacity:0.7; cursor:not-allowed; transform:none; box-shadow:none; }
        .rc-spinner { width:20px; height:20px; border:3px solid rgba(255,255,255,0.3); border-top-color:white; border-radius:50%; animation:rcSpin 0.7s linear infinite; display:inline-block; }
      `}</style>
        </div>
    );
}
