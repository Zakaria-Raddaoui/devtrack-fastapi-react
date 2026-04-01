import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';

function wordCount(text) {
  if (!text?.trim()) return 0;
  return text.trim().split(/\s+/).length;
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

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Deterministic tag color from name ───────────────────────────────────────
const TAG_COLORS = [
  { bg: 'rgba(249,115,22,0.12)', text: '#f97316' },
  { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
  { bg: 'rgba(168,85,247,0.12)', text: '#a855f7' },
  { bg: 'rgba(34,197,94,0.12)', text: '#22c55e' },
  { bg: 'rgba(236,72,153,0.12)', text: '#ec4899' },
  { bg: 'rgba(20,184,166,0.12)', text: '#14b8a6' },
  { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
  { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
];

function tagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function TagChip({ tag, onClick, size = 'md' }) {
  const c = tagColor(tag);
  return (
    <span className={`tag-chip tag-chip-${size}`} style={{ background: c.bg, color: c.text }} onClick={onClick}>
      #{tag}
    </span>
  );
}

// ─── Merge Suggestion Banner ──────────────────────────────────────────────────

function MergeBanner({ suggestions, onAccept, onDismiss }) {
  const [idx, setIdx] = useState(0);
  if (!suggestions || suggestions.length === 0) return null;
  const safeIdx = Math.min(idx, suggestions.length - 1);
  const s = suggestions[safeIdx];
  return (
    <div className="merge-banner">
      <span className="merge-banner-icon">✦</span>
      <div className="merge-banner-body">
        <p className="merge-banner-reason">{s.reason}</p>
        <div className="merge-banner-tags">
          {s.children.map(c => <TagChip key={c} tag={c} size="sm" />)}
          <span className="merge-arrow">→</span>
          <span className="merge-parent">#{s.suggested_parent}</span>
        </div>
      </div>
      <div className="merge-banner-actions">
        <button className="merge-accept-btn" onClick={() => onAccept(s)}>Merge</button>
        <button className="merge-dismiss-btn" onClick={() => {
          onDismiss(s);
          setIdx(i => (i >= suggestions.length - 1 ? 0 : i));
        }}>Skip</button>
        {suggestions.length > 1 && (
          <>
            <button className="merge-nav-btn" onClick={() => setIdx(i => (i - 1 + suggestions.length) % suggestions.length)}>‹</button>
            <span className="merge-counter">{safeIdx + 1}/{suggestions.length}</span>
            <button className="merge-nav-btn" onClick={() => setIdx(i => (i + 1) % suggestions.length)}>›</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tag Suggestion Chips ─────────────────────────────────────────────────────

function TagSuggestions({ suggestions, currentTags, onAccept, loading }) {
  if (loading) return (
    <div className="tag-suggest-row">
      <span className="tag-suggest-icon">✦</span>
      <span className="tag-suggest-loading">Generating tag suggestions…</span>
      <div className="tag-suggest-pulse" />
    </div>
  );
  if (!suggestions || suggestions.length === 0) return null;
  const current = new Set((currentTags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean));
  const fresh = suggestions.filter(t => !current.has(t.toLowerCase()));
  if (fresh.length === 0) return null;
  return (
    <div className="tag-suggest-row">
      <span className="tag-suggest-icon">✦</span>
      <span className="tag-suggest-label">AI suggests</span>
      {fresh.map(tag => (
        <button key={tag} className="tag-suggest-chip" onClick={() => onAccept(tag)} title={`Add tag: ${tag}`}>
          +{tag}
        </button>
      ))}
    </div>
  );
}

// ─── Tag Tree Node ────────────────────────────────────────────────────────────

function TagTreeNode({ node, depth = 0, activeTag, onSelect, tagSearch }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const c = tagColor(node.name);

  if (tagSearch) {
    const matchesSelf = node.name.toLowerCase().includes(tagSearch.toLowerCase());
    const childrenMatch = hasChildren && node.children.some(ch => ch.name.toLowerCase().includes(tagSearch.toLowerCase()));
    if (!matchesSelf && !childrenMatch) return null;
  }

  return (
    <div>
      <button
        className={`sidebar-tag-btn ${activeTag === node.name ? 'active' : ''}`}
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => onSelect(node.name)}
      >
        <span className="sidebar-tag-dot" style={{ background: c.text }} />
        <span className="sidebar-tag-name">#{node.name}</span>
        {hasChildren && (
          <span className="sidebar-tag-expand" onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}>
            {expanded ? '▾' : '▸'}
          </span>
        )}
        {node.note_count > 0 && <span className="sidebar-tag-count">{node.note_count}</span>}
      </button>
      {hasChildren && expanded && node.children.map(child => (
        <TagTreeNode key={child.id} node={child} depth={depth + 1} activeTag={activeTag} onSelect={onSelect} tagSearch={tagSearch} />
      ))}
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenu({ x, y, note, folders, onClose, onMove, onDuplicate, onDelete }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return createPortal(
    <div ref={ref} className="ctx-menu" style={{ top: y, left: x }}>
      <div className="ctx-section-label">Move to folder</div>
      <div className="ctx-item" onClick={() => { onMove(note, null); onClose(); }}>
        <span className="ctx-icon">⊘</span><span>Unfiled</span>
        {!note.folder_id && <span className="ctx-check">✓</span>}
      </div>
      {folders.map(f => (
        <div key={f.id} className="ctx-item" onClick={() => { onMove(note, f.id); onClose(); }}>
          <span className="ctx-icon">📁</span><span>{f.title}</span>
          {note.folder_id === f.id && <span className="ctx-check">✓</span>}
        </div>
      ))}
      <div className="ctx-divider" />
      <div className="ctx-item" onClick={() => { onDuplicate(note); onClose(); }}>
        <span className="ctx-icon">⧉</span><span>Duplicate note</span>
      </div>
      <div className="ctx-divider" />
      <div className="ctx-item danger" onClick={() => { onDelete(note); onClose(); }}>
        <span className="ctx-icon">✕</span><span>Delete note</span>
      </div>
    </div>,
    document.body
  );
}

// ─── New Note Modal ───────────────────────────────────────────────────────────

function NewNoteModal({ folders, currentFolderId, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', tags: '', folder_id: currentFolderId || '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const submit = async e => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await api.post('/notes/', { ...form, content: '', is_pinned: false, folder_id: form.folder_id ? parseInt(form.folder_id) : null });
      onCreated(res.data); onClose();
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'Something went wrong');
    } finally { setLoading(false); }
  };
  return createPortal(
    <div className="notes-overlay" onClick={onClose}>
      <div className="notes-modal" onClick={e => e.stopPropagation()}>
        <div className="notes-modal-header">
          <h2>New note</h2>
          <button className="notes-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="notes-modal-form">
          <div className="nf"><label>Title</label>
            <input name="title" value={form.title} onChange={handle} placeholder="e.g. Docker volumes explained" required autoFocus />
          </div>
          <div className="nf"><label>Folder <span className="nf-opt">optional</span></label>
            <select name="folder_id" value={form.folder_id} onChange={handle}>
              <option value="">No folder (Unfiled)</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
          <div className="nf"><label>Tags <span className="nf-opt">optional, comma separated</span></label>
            <input name="tags" value={form.tags} onChange={handle} placeholder="docker, backend, tips" />
          </div>
          {error && <p className="nf-error">{error}</p>}
          <button type="submit" className="nf-submit" disabled={loading}>
            {loading ? <span className="nf-spinner" /> : 'Create note'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Folder Modal ─────────────────────────────────────────────────────────────

function FolderModal({ folder, onClose, onSaved }) {
  const editing = !!folder?.id;
  const [title, setTitle] = useState(folder?.title || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      if (editing) await api.put(`/folders/${folder.id}`, { title });
      else await api.post('/folders/', { title });
      onSaved(); onClose();
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'Something went wrong');
    } finally { setLoading(false); }
  };
  return createPortal(
    <div className="notes-overlay" onClick={onClose}>
      <div className="notes-modal" onClick={e => e.stopPropagation()}>
        <div className="notes-modal-header">
          <h2>{editing ? 'Rename folder' : 'New folder'}</h2>
          <button className="notes-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="notes-modal-form">
          <div className="nf"><label>Folder name</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Work, Ideas, Learnings" required autoFocus />
          </div>
          {error && <p className="nf-error">{error}</p>}
          <button type="submit" className="nf-submit" disabled={loading}>
            {loading ? <span className="nf-spinner" /> : (editing ? 'Save' : 'Create folder')}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Note List Item ───────────────────────────────────────────────────────────

function NoteListItem({ note, isSelected, onClick, onContextMenu }) {
  const tags = note.tags ? note.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  return (
    <div
      className={`nl-item ${isSelected ? 'selected' : ''} ${note.is_pinned ? 'pinned' : ''}`}
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, note); }}
    >
      <div className="nl-item-main">
        <div className="nl-item-top">
          {note.is_pinned && <span className="nl-pin-dot" title="Pinned" />}
          <span className="nl-item-title">{note.title}</span>
        </div>
        {tags.length > 0 && (
          <div className="nl-item-tags">
            {tags.slice(0, 2).map((t, i) => <TagChip key={i} tag={t} size="xs" />)}
            {tags.length > 2 && <span className="nl-tag-more">+{tags.length - 2}</span>}
          </div>
        )}
        <span className="nl-item-time">{timeAgo(note.updated_at)}</span>
      </div>
    </div>
  );
}

// ─── Note Editor ──────────────────────────────────────────────────────────────

function NoteEditor({ note, onUpdate, onDelete, onTagsUpdated }) {
  const [mode, setMode] = useState('read');
  const [form, setForm] = useState({
    title: note.title, content: note.content || '',
    tags: note.tags || '', is_pinned: note.is_pinned,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const debounceRef = useRef(null);
  const textareaRef = useRef(null);

  // ── Auto-tag state ──
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestDebounceRef = useRef(null);
  const lastSuggestedLen = useRef(0);

  useEffect(() => {
    setForm({ title: note.title, content: note.content || '', tags: note.tags || '', is_pinned: note.is_pinned });
    setTagSuggestions([]);
    lastSuggestedLen.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const autoSave = useCallback(async (data) => {
    setSaving(true); setSaved(false);
    try {
      const res = await api.put(`/notes/${note.id}`, data);
      onUpdate(res.data); setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }, [note.id, onUpdate]);

  const triggerSuggest = useCallback((title, content) => {
    clearTimeout(suggestDebounceRef.current);
    const combined = title + content;
    if (combined.length < 80) return;
    if (Math.abs(combined.length - lastSuggestedLen.current) < 40) return;
    suggestDebounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await api.post('/tags/suggest', {
          note_id: note.id, title, content: content.slice(0, 1000),
        });
        setTagSuggestions(res.data.suggested_tags || []);
        lastSuggestedLen.current = combined.length;
      } catch (e) { /* silently fail */ }
      finally { setSuggestLoading(false); }
    }, 3000);
  }, [note.id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    const updated = { ...form, [name]: val };
    setForm(updated);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => autoSave(updated), 1000);
    if (name === 'content' || name === 'title') {
      triggerSuggest(name === 'title' ? val : updated.title, name === 'content' ? val : updated.content);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); setMode(m => m === 'read' ? 'edit' : 'read'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); clearTimeout(debounceRef.current); autoSave(form); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [form, autoSave]);

  useEffect(() => { if (mode === 'edit') setTimeout(() => textareaRef.current?.focus(), 50); }, [mode]);

  const acceptTag = useCallback(async (tag) => {
    const existing = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (existing.map(t => t.toLowerCase()).includes(tag.toLowerCase())) return;
    const newTags = [...existing, tag].join(', ');
    const updated = { ...form, tags: newTags };
    setForm(updated);
    setTagSuggestions(prev => prev.filter(t => t !== tag));
    clearTimeout(debounceRef.current);
    autoSave(updated);
    try {
      // Use URLSearchParams to correctly send tag as query param
      await api.post(`/tags/apply-to-note?note_id=${note.id}&tags=${encodeURIComponent(tag)}`);
    } catch (e) { /* non-critical */ }
    if (onTagsUpdated) onTagsUpdated();
  }, [form, note.id, autoSave, onTagsUpdated]);

  const handleDelete = async () => {
    try { await api.delete(`/notes/${note.id}`); onDelete(note.id); }
    catch (e) { console.error(e); } finally { setConfirm(false); }
  };

  const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const words = wordCount(form.content);

  return (
    <div className="ne-root">
      <div className="ne-toolbar">
        <div className="ne-toolbar-left">
          {mode === 'edit' ? (
            <input className="ne-title-input" name="title" value={form.title} onChange={handleChange} placeholder="Note title…" />
          ) : (
            <h1 className="ne-title">{form.title}</h1>
          )}
        </div>
        <div className="ne-toolbar-right">
          {saving && <span className="ne-status saving">Saving…</span>}
          {saved && <span className="ne-status saved">✓ Saved</span>}
          <button
            className={`ne-tool-btn ${form.is_pinned ? 'pinned' : ''}`}
            onClick={() => { const u = { ...form, is_pinned: !form.is_pinned }; setForm(u); autoSave(u); }}
            title={form.is_pinned ? 'Unpin note' : 'Pin note'}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke={form.is_pinned ? '#f97316' : 'currentColor'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3l8 8-2 2-2-2-4 4v3H7l-1-1v-2l4-4-2-2 1-2z" /><line x1="3" y1="17" x2="7" y2="13" />
            </svg>
          </button>
          <div className="ne-mode-toggle">
            <button className={`ne-mode-btn ${mode === 'read' ? 'active' : ''}`} onClick={() => setMode('read')}>Preview</button>
            <button className={`ne-mode-btn ${mode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}>Edit</button>
          </div>
          <button className="ne-tool-btn danger" onClick={() => setConfirm(true)} title="Delete note">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4,6 16,6" /><path d="M8 6V4h4v2" /><path d="M5 6l1 10a1 1 0 001 1h6a1 1 0 001-1l1-10" />
            </svg>
          </button>
        </div>
      </div>

      <div className="ne-tags-bar">
        <div className="ne-tags-left">
          {mode === 'edit' ? (
            <div className="ne-tags-edit-wrap">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                style={{ width: 13, height: 13, color: 'var(--muted)', flexShrink: 0 }}>
                <path d="M3 7a1 1 0 011-1h3l2-2h5a1 1 0 011 1v3l2 2v5a1 1 0 01-1 1H4a1 1 0 01-1-1V7z" />
              </svg>
              <input className="ne-tags-input" name="tags" value={form.tags} onChange={handleChange} placeholder="Add tags separated by commas…" />
            </div>
          ) : (
            <div className="ne-tags-display">
              {tags.length > 0
                ? tags.map((t, i) => <TagChip key={i} tag={t} />)
                : <button className="ne-add-tags-btn" onClick={() => setMode('edit')}>+ Add tags</button>
              }
            </div>
          )}
        </div>
        <div className="ne-meta">
          <span>{words} words</span>
          <span className="ne-meta-dot">·</span>
          <span>Edited {timeAgo(note.updated_at)}</span>
          <span className="ne-meta-dot">·</span>
          <span>{formatDate(note.created_at)}</span>
          <span className="ne-meta-dot">·</span>
          <kbd className="ne-shortcut">Ctrl+E</kbd>
        </div>
      </div>

      {/* AI tag suggestions — only in edit mode */}
      {mode === 'edit' && (
        <TagSuggestions suggestions={tagSuggestions} currentTags={form.tags} onAccept={acceptTag} loading={suggestLoading} />
      )}

      <div className="ne-content">
        {mode === 'edit' ? (
          <textarea ref={textareaRef} className="ne-textarea" name="content" value={form.content} onChange={handleChange}
            placeholder={`Start writing in markdown…\n\n# Heading 1\n## Heading 2\n\n**bold**, *italic*, \`inline code\`\n\n- bullet list\n1. numbered list`} />
        ) : (
          <div className="ne-preview">
            {form.content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.content}</ReactMarkdown>
            ) : (
              <div className="ne-blank">
                <div className="ne-blank-icon">◇</div>
                <p>This note is empty</p>
                <button className="ne-blank-btn" onClick={() => setMode('edit')}>Start writing →</button>
              </div>
            )}
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmDialog title="Delete note" message={`Delete "${note.title}"? This cannot be undone.`}
          onConfirm={handleDelete} onCancel={() => setConfirm(false)} />
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [tagTree, setTagTree] = useState([]);
  const [mergeSuggestions, setMergeSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [activeFolder, setActiveFolder] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [folderModal, setFolderModal] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [ctxMenu, setCtxMenu] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('browse');

  const fetchAll = useCallback(async () => {
    try {
      const [notesRes, foldersRes] = await Promise.all([api.get('/notes/'), api.get('/folders/')]);
      setNotes(notesRes.data); setFolders(foldersRes.data);
      if (selected) {
        const updated = notesRes.data.find(n => n.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const [treeRes, mergeRes] = await Promise.all([api.get('/tags/'), api.get('/tags/merge-suggestions')]);
      setTagTree(treeRes.data); setMergeSuggestions(mergeRes.data);
    } catch (e) { /* tags non-critical */ }
  }, []);

  useEffect(() => { fetchAll(); fetchTags(); }, [fetchAll, fetchTags]);

  const handleAcceptMerge = async (s) => {
    try {
      await api.post('/tags/merge-suggestions/accept', { suggestion_id: s.id, parent_name: s.suggested_parent, child_names: s.children });
      setMergeSuggestions(prev => prev.filter(x => x.id !== s.id)); fetchTags();
    } catch (e) { console.error(e); }
  };

  const handleDismissMerge = async (s) => {
    try {
      await api.post('/tags/merge-suggestions/dismiss', { suggestion_id: s.id });
      setMergeSuggestions(prev => prev.filter(x => x.id !== s.id));
    } catch (e) { console.error(e); }
  };

  const allTags = [...new Set(notes.flatMap(n => n.tags ? n.tags.split(',').map(t => t.trim()).filter(Boolean) : []))];
  const useTree = tagTree.length > 0;

  // FIX: 'pinned' filter added
  const filtered = notes
    .filter(n => {
      if (activeFolder === 'unfiled') return !n.folder_id;
      if (activeFolder === 'pinned') return n.is_pinned;
      if (activeFolder !== null) return n.folder_id === activeFolder;
      return true;
    })
    .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content?.toLowerCase().includes(search.toLowerCase()))
    .filter(n => !activeTag || n.tags?.toLowerCase().includes(activeTag.toLowerCase()));

  const pinned = filtered.filter(n => n.is_pinned);
  const unpinned = filtered.filter(n => !n.is_pinned);

  const handleUpdate = useCallback((u) => { setNotes(prev => prev.map(n => n.id === u.id ? u : n)); setSelected(u); }, []);
  const handleDelete = useCallback((id) => { setNotes(prev => prev.filter(n => n.id !== id)); setSelected(null); }, []);
  const handleCreated = useCallback((note) => { setNotes(prev => [note, ...prev]); setSelected(note); }, []);

  const handleMove = async (note, folderId) => {
    try {
      const res = await api.put(`/notes/${note.id}`, { folder_id: folderId });
      setNotes(prev => prev.map(n => n.id === res.data.id ? res.data : n));
      if (selected?.id === res.data.id) setSelected(res.data);
    } catch (e) { console.error(e); }
  };

  const handleDuplicate = async (note) => {
    try {
      const res = await api.post('/notes/', { title: note.title + ' (copy)', content: note.content, tags: note.tags, is_pinned: false, folder_id: note.folder_id });
      setNotes(prev => [res.data, ...prev]); setSelected(res.data);
    } catch (e) { console.error(e); }
  };

  const confirmDeleteNote = async () => {
    if (!confirmDelete) return;
    try { await api.delete(`/notes/${confirmDelete.id}`); handleDelete(confirmDelete.id); }
    catch (e) { console.error(e); } finally { setConfirmDelete(null); }
  };

  const handleDeleteFolder = async () => {
    if (!confirmDeleteFolder) return;
    try {
      await api.delete(`/folders/${confirmDeleteFolder.id}`);
      setFolders(prev => prev.filter(f => f.id !== confirmDeleteFolder.id));
      setNotes(prev => prev.map(n => n.folder_id === confirmDeleteFolder.id ? { ...n, folder_id: null } : n));
      if (activeFolder === confirmDeleteFolder.id) setActiveFolder(null);
    } catch (e) { console.error(e); } finally { setConfirmDeleteFolder(null); }
  };

  const onContextMenu = (e, note) => {
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 250);
    setCtxMenu({ x, y, note });
  };

  if (loading) return <div className="notes-loading"><div className="notes-ring" /></div>;

  const folderCounts = folders.reduce((acc, f) => { acc[f.id] = notes.filter(n => n.folder_id === f.id).length; return acc; }, {});
  const visibleFlatTags = tagSearch ? allTags.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase())) : allTags;

  return (
    <div className="notes-root" onClick={() => setCtxMenu(null)}>

      {/* ══ Sidebar ══ */}
      <div className="notes-sidebar">
        <div className="nsb-header">
          <div className="nsb-header-top">
            <h2 className="nsb-title">Notes</h2>
            <div className="nsb-header-actions">
              <button className="nsb-icon-btn" onClick={() => setFolderModal({})} title="New folder">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 5a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V5z" />
                  <line x1="9" y1="10" x2="9" y2="14" /><line x1="7" y1="12" x2="11" y2="12" />
                </svg>
              </button>
              <button className="nsb-new-btn" onClick={() => setShowNew(true)}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="10" y1="4" x2="10" y2="16" /><line x1="4" y1="10" x2="16" y2="10" />
                </svg>
                <span>New</span>
              </button>
            </div>
          </div>

          <div className="nsb-search">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="nsb-search-ico">
              <circle cx="9" cy="9" r="6" /><line x1="13.5" y1="13.5" x2="17" y2="17" />
            </svg>
            <input placeholder="Search notes…" value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="nsb-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>

          <div className="nsb-tabs">
            <button className={`nsb-tab ${sidebarTab === 'browse' ? 'active' : ''}`} onClick={() => setSidebarTab('browse')}>Browse</button>
            <button className={`nsb-tab ${sidebarTab === 'tags' ? 'active' : ''}`} onClick={() => setSidebarTab('tags')}>
              Tags {allTags.length > 0 && <span className="nsb-tab-count">{allTags.length}</span>}
            </button>
          </div>
        </div>

        {/* ── Browse tab ── */}
        {sidebarTab === 'browse' && (
          <div className="nsb-body">
            <div className="nsb-section">
              <button className={`nsb-nav-btn ${activeFolder === null && !activeTag ? 'active' : ''}`} onClick={() => { setActiveFolder(null); setActiveTag(''); }}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="nsb-nav-ico"><path d="M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z" /></svg>
                <span>All notes</span><span className="nsb-nav-count">{notes.length}</span>
              </button>
              <button className={`nsb-nav-btn ${activeFolder === 'unfiled' ? 'active' : ''}`} onClick={() => { setActiveFolder('unfiled'); setActiveTag(''); }}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="nsb-nav-ico"><rect x="3" y="5" width="14" height="11" rx="2" /><line x1="7" y1="5" x2="7" y2="3" /><line x1="13" y1="5" x2="13" y2="3" /></svg>
                <span>Unfiled</span><span className="nsb-nav-count">{notes.filter(n => !n.folder_id).length}</span>
              </button>
              <button className={`nsb-nav-btn ${activeFolder === 'pinned' ? 'active' : ''}`} onClick={() => { setActiveFolder('pinned'); setActiveTag(''); }}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="nsb-nav-ico"><path d="M9 3l8 8-2 2-2-2-4 4v3H7l-1-1v-2l4-4-2-2 1-2z" /><line x1="3" y1="17" x2="7" y2="13" /></svg>
                <span>Pinned</span><span className="nsb-nav-count">{notes.filter(n => n.is_pinned).length}</span>
              </button>
            </div>
            {folders.length > 0 && (
              <div className="nsb-section">
                <div className="nsb-section-label">Folders</div>
                {folders.map(f => (
                  <div key={f.id} className={`nsb-folder-btn ${activeFolder === f.id ? 'active' : ''}`} onClick={() => { setActiveFolder(f.id); setActiveTag(''); }}>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="nsb-nav-ico"><path d="M3 7a1 1 0 011-1h4l2 2h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V7z" /></svg>
                    <span className="nsb-folder-name">{f.title}</span>
                    <span className="nsb-nav-count">{folderCounts[f.id] || 0}</span>
                    <div className="nsb-folder-actions" onClick={e => e.stopPropagation()}>
                      <button className="nsb-folder-action" onClick={() => setFolderModal(f)} title="Rename">✎</button>
                      <button className="nsb-folder-action danger" onClick={() => setConfirmDeleteFolder(f)} title="Delete">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tags tab with search ── */}
        {sidebarTab === 'tags' && (
          <div className="nsb-body nsb-tags-body">
            <div className="nsb-tag-search">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="nsb-search-ico">
                <circle cx="9" cy="9" r="6" /><line x1="13.5" y1="13.5" x2="17" y2="17" />
              </svg>
              <input placeholder="Search tags…" value={tagSearch} onChange={e => setTagSearch(e.target.value)} autoFocus />
              {tagSearch && <button className="nsb-search-clear" onClick={() => setTagSearch('')}>✕</button>}
            </div>

            {activeTag && (
              <div className="nsb-active-tag-row">
                <span>Filtering by</span>
                <TagChip tag={activeTag} size="sm" />
                <button className="nsb-tag-clear-btn" onClick={() => setActiveTag('')}>✕ Clear</button>
              </div>
            )}

            {(useTree ? tagTree.length > 0 : allTags.length > 0) ? (
              <div className="nsb-section">
                <div className="nsb-section-label">
                  {useTree ? 'Tag tree' : 'All tags'}
                  <span className="nsb-tag-count-label">{visibleFlatTags.length} tags</span>
                </div>
                {useTree
                  ? tagTree.map(node => (
                    <TagTreeNode key={node.id} node={node} activeTag={activeTag}
                      onSelect={t => { setActiveTag(activeTag === t ? '' : t); setSidebarTab('browse'); }}
                      tagSearch={tagSearch} />
                  ))
                  : visibleFlatTags.map(tag => {
                    const c = tagColor(tag);
                    const count = notes.filter(n => n.tags?.toLowerCase().includes(tag.toLowerCase())).length;
                    return (
                      <button key={tag} className={`nsb-tag-row ${activeTag === tag ? 'active' : ''}`}
                        onClick={() => { setActiveTag(activeTag === tag ? '' : tag); setSidebarTab('browse'); }}>
                        <span className="sidebar-tag-dot" style={{ background: c.text }} />
                        <span className="nsb-tag-label">#{tag}</span>
                        <span className="nsb-nav-count">{count}</span>
                      </button>
                    );
                  })
                }
                {visibleFlatTags.length === 0 && tagSearch && (
                  <div className="nsb-tag-no-results">No tags matching "{tagSearch}"</div>
                )}
              </div>
            ) : (
              <div className="nsb-empty-tags">
                <p>No tags yet</p>
                <span>Tags appear here as you add them to notes</span>
              </div>
            )}
          </div>
        )}

        {/* Note list — always visible */}
        <div className="nsb-list">
          {filtered.length === 0 ? (
            <div className="nsb-list-empty">
              <p>{search ? `No notes matching "${search}"` : activeTag ? `No notes tagged #${activeTag}` : 'No notes here'}</p>
              {!search && !activeTag && <button className="nsb-empty-new" onClick={() => setShowNew(true)}>+ New note</button>}
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <div className="nsb-list-group">
                  <div className="nsb-list-section">Pinned</div>
                  {pinned.map(n => <NoteListItem key={n.id} note={n} isSelected={selected?.id === n.id} onClick={() => setSelected(n)} onContextMenu={onContextMenu} />)}
                </div>
              )}
              {unpinned.length > 0 && (
                <div className="nsb-list-group">
                  {pinned.length > 0 && <div className="nsb-list-section">Notes</div>}
                  {unpinned.map(n => <NoteListItem key={n.id} note={n} isSelected={selected?.id === n.id} onClick={() => setSelected(n)} onContextMenu={onContextMenu} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ Main content ══ */}
      <div className="notes-main">
        <MergeBanner suggestions={mergeSuggestions} onAccept={handleAcceptMerge} onDismiss={handleDismissMerge} />

        {selected ? (
          <NoteEditor key={selected.id} note={selected} onUpdate={handleUpdate} onDelete={handleDelete} onTagsUpdated={fetchTags} />
        ) : (
          <div className="notes-empty-state">
            <div className="notes-empty-icon">
              <svg viewBox="0 0 48 48" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="8" width="32" height="32" rx="3" /><line x1="14" y1="18" x2="34" y2="18" />
                <line x1="14" y1="24" x2="34" y2="24" /><line x1="14" y1="30" x2="24" y2="30" />
              </svg>
            </div>
            <h2>Select a note to read</h2>
            <p>Choose from the list or create something new</p>
            <button className="notes-empty-btn" onClick={() => setShowNew(true)}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="10" y1="4" x2="10" y2="16" /><line x1="4" y1="10" x2="16" y2="10" />
              </svg>
              New note
            </button>
          </div>
        )}
      </div>

      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} note={ctxMenu.note} folders={folders} onClose={() => setCtxMenu(null)} onMove={handleMove} onDuplicate={handleDuplicate} onDelete={setConfirmDelete} />}
      {showNew && <NewNoteModal folders={folders} currentFolderId={typeof activeFolder === 'number' ? activeFolder : null} onClose={() => setShowNew(false)} onCreated={handleCreated} />}
      {folderModal !== null && <FolderModal folder={folderModal?.id ? folderModal : null} onClose={() => setFolderModal(null)} onSaved={fetchAll} />}
      {confirmDelete && <ConfirmDialog title="Delete note" message={`Delete "${confirmDelete.title}"? This cannot be undone.`} onConfirm={confirmDeleteNote} onCancel={() => setConfirmDelete(null)} />}
      {confirmDeleteFolder && <ConfirmDialog title="Delete folder" message={`Delete "${confirmDeleteFolder.title}"? Notes inside will be moved to Unfiled.`} onConfirm={handleDeleteFolder} onCancel={() => setConfirmDeleteFolder(null)} />}

      <style>{`
        .notes-root { display:flex; height:100vh; width:100%; overflow:hidden; background:var(--bg); }
        .notes-loading { display:flex; align-items:center; justify-content:center; height:100vh; width:100%; }
        .notes-ring { width:36px; height:36px; border:3px solid var(--border); border-top-color:#f97316; border-radius:50%; animation:nSpin 0.8s linear infinite; }
        @keyframes nSpin { to { transform:rotate(360deg); } }

        .tag-chip { display:inline-flex; align-items:center; font-size:11px; font-weight:700; padding:2px 8px; border-radius:99px; letter-spacing:0.2px; line-height:1.6; white-space:nowrap; cursor:default; }
        .tag-chip-xs { font-size:10px; padding:1px 6px; }
        .tag-chip-sm { font-size:10px; padding:2px 7px; }

        .merge-banner { display:flex; align-items:center; gap:12px; background:linear-gradient(135deg,rgba(249,115,22,0.08),rgba(249,115,22,0.03)); border-bottom:1px solid rgba(249,115,22,0.15); padding:12px 20px; flex-shrink:0; animation:nSlideDown 0.3s ease; }
        .merge-banner-icon { color:#f97316; font-size:13px; flex-shrink:0; }
        .merge-banner-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }
        .merge-banner-reason { font-size:12px; font-weight:600; color:var(--text); margin:0; }
        .merge-banner-tags { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
        .merge-arrow { font-size:11px; color:var(--muted); }
        .merge-parent { font-size:11px; font-weight:700; background:rgba(249,115,22,0.12); color:#f97316; padding:2px 8px; border-radius:99px; border:1px solid rgba(249,115,22,0.25); }
        .merge-banner-actions { display:flex; align-items:center; gap:5px; flex-shrink:0; }
        .merge-accept-btn { background:#f97316; color:white; border:none; border-radius:6px; padding:5px 12px; font-size:12px; font-weight:600; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; box-shadow:0 2px 8px rgba(249,115,22,0.25); }
        .merge-accept-btn:hover { background:#ea6c0a; transform:translateY(-1px); }
        .merge-dismiss-btn { background:none; border:1px solid var(--border); border-radius:6px; padding:5px 10px; font-size:12px; color:var(--muted); cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
        .merge-dismiss-btn:hover { border-color:var(--muted); color:var(--text); }
        .merge-nav-btn { background:none; border:1px solid var(--border); border-radius:5px; padding:3px 7px; font-size:12px; color:var(--muted); cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
        .merge-nav-btn:hover { color:var(--text); }
        .merge-counter { font-size:10px; color:var(--placeholder); min-width:28px; text-align:center; }

        .tag-suggest-row { display:flex; align-items:center; gap:7px; flex-wrap:wrap; padding:7px 28px; background:rgba(249,115,22,0.03); border-bottom:1px solid rgba(249,115,22,0.08); flex-shrink:0; animation:nSlideDown 0.2s ease; }
        .tag-suggest-icon { color:#f97316; font-size:11px; }
        .tag-suggest-label { font-size:11px; color:var(--muted); font-weight:600; }
        .tag-suggest-loading { font-size:11px; color:var(--placeholder); }
        .tag-suggest-pulse { width:8px; height:8px; background:#f97316; border-radius:50%; animation:tsPulse 1s ease-in-out infinite; }
        @keyframes tsPulse { 0%,100%{opacity:0.3;transform:scale(0.8);} 50%{opacity:1;transform:scale(1);} }
        .tag-suggest-chip { font-size:11px; font-weight:600; background:none; border:1px dashed rgba(249,115,22,0.4); color:#f97316; border-radius:99px; padding:2px 9px; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
        .tag-suggest-chip:hover { background:rgba(249,115,22,0.1); border-style:solid; transform:translateY(-1px); }

        .notes-sidebar { width:272px; min-width:272px; height:100vh; background:var(--sidebar-bg); border-right:1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; }
        .nsb-header { padding:18px 14px 0; flex-shrink:0; display:flex; flex-direction:column; gap:10px; }
        .nsb-header-top { display:flex; align-items:center; justify-content:space-between; }
        .nsb-title { font-family:'Syne',sans-serif; font-size:17px; font-weight:800; color:var(--text); letter-spacing:-0.3px; }
        .nsb-header-actions { display:flex; align-items:center; gap:6px; }
        .nsb-icon-btn { width:30px; height:30px; display:flex; align-items:center; justify-content:center; background:none; border:1px solid var(--border); border-radius:7px; color:var(--muted); cursor:pointer; transition:all 0.15s; }
        .nsb-icon-btn svg { width:15px; height:15px; }
        .nsb-icon-btn:hover { border-color:rgba(249,115,22,0.4); color:#f97316; }
        .nsb-new-btn { display:flex; align-items:center; gap:6px; background:#f97316; color:white; border:none; border-radius:7px; padding:6px 12px; font-size:13px; font-weight:600; font-family:'DM Sans',sans-serif; cursor:pointer; transition:all 0.15s; box-shadow:0 2px 10px rgba(249,115,22,0.25); }
        .nsb-new-btn svg { width:14px; height:14px; }
        .nsb-new-btn:hover { background:#ea6c0a; transform:translateY(-1px); }
        .nsb-search { display:flex; align-items:center; gap:7px; background:var(--input-bg); border:1px solid var(--border); border-radius:9px; padding:8px 10px; transition:border-color 0.2s; }
        .nsb-search:focus-within { border-color:rgba(249,115,22,0.4); }
        .nsb-search-ico { width:13px; height:13px; color:var(--placeholder); flex-shrink:0; }
        .nsb-search input { flex:1; background:none; border:none; outline:none; font-size:12px; color:var(--text); font-family:'DM Sans',sans-serif; }
        .nsb-search input::placeholder { color:var(--placeholder); }
        .nsb-search-clear { background:none; border:none; color:var(--placeholder); cursor:pointer; font-size:10px; padding:0; transition:color 0.15s; }
        .nsb-search-clear:hover { color:var(--text); }
        .nsb-tabs { display:flex; gap:2px; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:3px; margin-bottom:2px; }
        .nsb-tab { flex:1; background:none; border:none; border-radius:5px; padding:5px 8px; font-size:12px; font-weight:500; color:var(--muted); cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; display:flex; align-items:center; justify-content:center; gap:5px; }
        .nsb-tab:hover { color:var(--text); }
        .nsb-tab.active { background:var(--card-bg); color:var(--text); box-shadow:0 1px 3px var(--shadow); font-weight:600; }
        .nsb-tab-count { font-size:10px; background:var(--input-bg); color:var(--muted); padding:1px 5px; border-radius:99px; }
        .nsb-body { overflow-y:auto; flex-shrink:0; max-height:280px; border-bottom:1px solid var(--border); }
        .nsb-tags-body { max-height:unset; flex:1; border-bottom:none; display:flex; flex-direction:column; overflow-y:auto; }
        .nsb-section { padding:8px 8px 4px; }
        .nsb-section-label { display:flex; align-items:center; justify-content:space-between; font-size:10px; font-weight:700; color:var(--placeholder); text-transform:uppercase; letter-spacing:0.8px; padding:4px 6px 6px; }
        .nsb-tag-count-label { font-size:10px; color:var(--placeholder); font-weight:400; text-transform:none; letter-spacing:0; }
        .nsb-nav-btn { display:flex; align-items:center; gap:8px; width:100%; background:none; border:none; border-radius:7px; padding:7px 8px; font-size:12.5px; color:var(--muted); cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.12s; text-align:left; }
        .nsb-nav-btn:hover { background:var(--hover-bg); color:var(--text); }
        .nsb-nav-btn.active { background:rgba(249,115,22,0.1); color:#f97316; font-weight:600; }
        .nsb-nav-ico { width:14px; height:14px; flex-shrink:0; }
        .nsb-nav-btn span:nth-child(2) { flex:1; }
        .nsb-nav-count { font-size:10px; color:var(--placeholder); margin-left:auto; background:var(--input-bg); padding:1px 6px; border-radius:99px; }
        .nsb-nav-btn.active .nsb-nav-count { background:rgba(249,115,22,0.15); color:#f97316; }
        .nsb-folder-btn { display:flex; align-items:center; gap:8px; width:100%; background:none; border:none; border-radius:7px; padding:7px 8px; font-size:12.5px; color:var(--muted); cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.12s; text-align:left; position:relative; }
        .nsb-folder-btn:hover { background:var(--hover-bg); color:var(--text); }
        .nsb-folder-btn.active { background:rgba(249,115,22,0.1); color:#f97316; font-weight:600; }
        .nsb-folder-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .nsb-folder-actions { display:flex; gap:2px; opacity:0; transition:opacity 0.15s; }
        .nsb-folder-btn:hover .nsb-folder-actions { opacity:1; }
        .nsb-folder-action { background:none; border:none; border-radius:4px; padding:2px 5px; font-size:11px; color:var(--muted); cursor:pointer; transition:all 0.12s; }
        .nsb-folder-action:hover { background:var(--bg); color:var(--text); }
        .nsb-folder-action.danger:hover { color:var(--danger-text); }

        .nsb-tag-search { display:flex; align-items:center; gap:7px; background:var(--input-bg); border:1px solid var(--border); border-radius:9px; padding:7px 10px; margin:10px 10px 4px; transition:border-color 0.2s; flex-shrink:0; }
        .nsb-tag-search:focus-within { border-color:rgba(249,115,22,0.4); }
        .nsb-tag-search input { flex:1; background:none; border:none; outline:none; font-size:12px; color:var(--text); font-family:'DM Sans',sans-serif; }
        .nsb-tag-search input::placeholder { color:var(--placeholder); }
        .nsb-active-tag-row { display:flex; align-items:center; gap:6px; padding:4px 14px 8px; font-size:11px; color:var(--muted); flex-shrink:0; }
        .nsb-tag-clear-btn { background:none; border:none; font-size:10px; color:var(--placeholder); cursor:pointer; font-family:'DM Sans',sans-serif; transition:color 0.15s; margin-left:auto; }
        .nsb-tag-clear-btn:hover { color:var(--danger-text); }
        .nsb-tag-row { display:flex; align-items:center; gap:8px; width:100%; background:none; border:none; border-radius:7px; padding:7px 8px; font-size:12px; color:var(--muted); cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.12s; text-align:left; }
        .nsb-tag-row:hover { background:var(--hover-bg); color:var(--text); }
        .nsb-tag-row.active { background:rgba(249,115,22,0.1); color:#f97316; font-weight:600; }
        .nsb-tag-label { flex:1; }
        .nsb-tag-no-results { font-size:12px; color:var(--placeholder); padding:12px 14px; text-align:center; }
        .nsb-empty-tags { padding:24px 16px; text-align:center; display:flex; flex-direction:column; gap:6px; align-items:center; }
        .nsb-empty-tags p { font-size:13px; font-weight:600; color:var(--text); }
        .nsb-empty-tags span { font-size:12px; color:var(--muted); line-height:1.5; }

        .sidebar-tag-btn { display:flex; align-items:center; gap:7px; width:100%; background:none; border:none; border-radius:7px; padding:6px 8px; font-size:12px; color:var(--muted); cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.12s; text-align:left; }
        .sidebar-tag-btn:hover { background:var(--hover-bg); color:var(--text); }
        .sidebar-tag-btn.active { color:#f97316; font-weight:600; background:rgba(249,115,22,0.08); }
        .sidebar-tag-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .sidebar-tag-name { flex:1; }
        .sidebar-tag-expand { font-size:9px; color:var(--placeholder); padding:0 2px; line-height:1; }
        .sidebar-tag-count { font-size:10px; color:var(--placeholder); }

        .nsb-list { flex:1; overflow-y:auto; padding:6px 8px 16px; min-height:0; }
        .nsb-list-group { margin-bottom:4px; }
        .nsb-list-section { font-size:10px; font-weight:700; color:var(--placeholder); text-transform:uppercase; letter-spacing:0.8px; padding:8px 6px 5px; }
        .nsb-list-empty { padding:24px 12px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px; font-size:12px; color:var(--muted); }
        .nsb-empty-new { background:none; border:1px dashed var(--border); border-radius:7px; padding:6px 14px; font-size:12px; color:var(--muted); cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
        .nsb-empty-new:hover { border-color:#f97316; color:#f97316; }

        .nl-item { border-radius:8px; padding:9px 10px 8px; cursor:pointer; transition:background 0.12s; margin-bottom:1px; }
        .nl-item:hover { background:var(--hover-bg); }
        .nl-item.selected { background:rgba(249,115,22,0.08); }
        .nl-item.pinned { border-left:2px solid rgba(249,115,22,0.5); padding-left:8px; }
        .nl-item-main { display:flex; flex-direction:column; gap:4px; }
        .nl-item-top { display:flex; align-items:center; gap:6px; }
        .nl-pin-dot { width:5px; height:5px; border-radius:50%; background:#f97316; flex-shrink:0; }
        .nl-item-title { font-size:13px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; line-height:1.3; }
        .nl-item.selected .nl-item-title { color:#f97316; }
        .nl-item-tags { display:flex; gap:4px; flex-wrap:wrap; }
        .nl-tag-more { font-size:10px; color:var(--placeholder); }
        .nl-item-time { font-size:10px; color:var(--placeholder); }

        .notes-main { flex:1; min-width:0; display:flex; flex-direction:column; height:100vh; overflow:hidden; background:var(--bg); }
        .notes-empty-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; color:var(--muted); text-align:center; padding:40px; }
        .notes-empty-icon svg { width:56px; height:56px; }
        .notes-empty-state h2 { font-family:'Syne',sans-serif; font-size:20px; font-weight:700; color:var(--text); margin:0; }
        .notes-empty-state p { font-size:13px; color:var(--muted); margin:0; }
        .notes-empty-btn { display:flex; align-items:center; gap:7px; background:#f97316; color:white; border:none; border-radius:9px; padding:10px 20px; font-size:13px; font-weight:600; font-family:'DM Sans',sans-serif; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 14px rgba(249,115,22,0.25); margin-top:4px; }
        .notes-empty-btn svg { width:14px; height:14px; }
        .notes-empty-btn:hover { background:#ea6c0a; transform:translateY(-1px); }

        .ne-root { display:flex; flex-direction:column; height:100%; overflow:hidden; }
        .ne-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 28px; border-bottom:1px solid var(--border); flex-shrink:0; background:var(--sidebar-bg); }
        .ne-toolbar-left { flex:1; min-width:0; }
        .ne-toolbar-right { display:flex; align-items:center; gap:6px; flex-shrink:0; }
        .ne-title { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; color:var(--text); margin:0; letter-spacing:-0.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ne-title-input { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; color:var(--text); background:none; border:none; outline:none; width:100%; letter-spacing:-0.5px; }
        .ne-status { font-size:11px; padding:3px 9px; border-radius:99px; font-weight:500; }
        .ne-status.saving { color:var(--muted); background:var(--input-bg); }
        .ne-status.saved { color:var(--success-text); background:var(--success-bg); }
        .ne-tool-btn { width:32px; height:32px; display:flex; align-items:center; justify-content:center; background:none; border:1px solid var(--border); border-radius:7px; color:var(--muted); cursor:pointer; transition:all 0.15s; }
        .ne-tool-btn svg { width:15px; height:15px; }
        .ne-tool-btn:hover { border-color:rgba(249,115,22,0.4); color:#f97316; }
        .ne-tool-btn.pinned { border-color:rgba(249,115,22,0.3); }
        .ne-tool-btn.danger:hover { border-color:rgba(239,68,68,0.4); color:var(--danger-text); }
        .ne-mode-toggle { display:flex; background:var(--input-bg); border:1px solid var(--border); border-radius:7px; padding:2px; }
        .ne-mode-btn { background:none; border:none; border-radius:5px; padding:4px 12px; font-size:12px; font-weight:500; color:var(--muted); cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
        .ne-mode-btn.active { background:var(--card-bg); color:var(--text); box-shadow:0 1px 3px var(--shadow); font-weight:600; }
        .ne-tags-bar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:9px 28px; border-bottom:1px solid var(--border); flex-shrink:0; background:var(--sidebar-bg); min-height:40px; }
        .ne-tags-left { flex:1; min-width:0; display:flex; align-items:center; }
        .ne-tags-edit-wrap { display:flex; align-items:center; gap:7px; width:100%; }
        .ne-tags-input { flex:1; background:none; border:none; outline:none; font-size:12px; color:var(--muted); font-family:'DM Sans',sans-serif; }
        .ne-tags-input::placeholder { color:var(--placeholder); }
        .ne-tags-display { display:flex; gap:5px; flex-wrap:wrap; align-items:center; }
        .ne-add-tags-btn { background:none; border:1px dashed var(--border); border-radius:99px; padding:2px 10px; font-size:11px; color:var(--placeholder); cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
        .ne-add-tags-btn:hover { border-color:rgba(249,115,22,0.4); color:#f97316; }
        .ne-meta { display:flex; align-items:center; gap:5px; font-size:11px; color:var(--placeholder); flex-shrink:0; white-space:nowrap; }
        .ne-meta-dot { color:var(--border); }
        .ne-shortcut { background:var(--input-bg); border:1px solid var(--border); border-radius:4px; padding:1px 5px; font-size:10px; font-family:'DM Sans',sans-serif; }
        .ne-content { flex:1; overflow:hidden; display:flex; flex-direction:column; background:var(--bg); }
        .ne-textarea { flex:1; width:100%; height:100%; background:none; border:none; outline:none; padding:32px 40px; font-size:14px; color:var(--text); font-family:'JetBrains Mono','Courier New',monospace; line-height:1.9; resize:none; box-sizing:border-box; overflow-y:auto; }
        .ne-textarea::placeholder { color:var(--placeholder); line-height:2; }
        .ne-preview { flex:1; overflow-y:auto; padding:32px 40px; font-size:15px; color:var(--text); line-height:1.8; max-width:760px; }
        .ne-preview p { margin:0 0 14px; } .ne-preview p:last-child { margin:0; }
        .ne-preview h1 { font-family:'Syne',sans-serif; font-size:28px; font-weight:800; color:var(--text); margin:32px 0 12px; letter-spacing:-0.8px; padding-bottom:10px; border-bottom:2px solid var(--border); }
        .ne-preview h2 { font-family:'Syne',sans-serif; font-size:21px; font-weight:700; color:var(--text); margin:24px 0 8px; }
        .ne-preview h3 { font-family:'Syne',sans-serif; font-size:17px; font-weight:700; color:var(--text); margin:18px 0 6px; }
        .ne-preview ul, .ne-preview ol { padding-left:24px; margin:8px 0; }
        .ne-preview li { margin-bottom:5px; line-height:1.7; }
        .ne-preview code { background:var(--input-bg); border:1px solid var(--border); border-radius:5px; padding:2px 7px; font-size:13px; color:#f97316; font-family:'JetBrains Mono',monospace; }
        .ne-preview pre { background:var(--input-bg); border:1px solid var(--border); border-radius:12px; padding:20px; overflow-x:auto; margin:14px 0; }
        .ne-preview pre code { background:none; border:none; padding:0; color:var(--text); font-size:13px; }
        .ne-preview strong { font-weight:700; } .ne-preview em { font-style:italic; color:var(--muted); }
        .ne-preview blockquote { border-left:3px solid #f97316; padding-left:18px; margin:14px 0; color:var(--muted); font-style:italic; }
        .ne-preview a { color:#f97316; text-decoration:underline; }
        .ne-preview hr { border:none; border-top:1px solid var(--border); margin:24px 0; }
        .ne-preview table { width:100%; border-collapse:collapse; margin:14px 0; }
        .ne-preview th, .ne-preview td { border:1px solid var(--border); padding:10px 14px; font-size:14px; }
        .ne-preview th { background:var(--input-bg); font-weight:700; font-size:13px; }
        .ne-preview input[type="checkbox"] { margin-right:6px; accent-color:#f97316; }
        .ne-blank { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:12px; color:var(--muted); text-align:center; }
        .ne-blank-icon { font-size:40px; color:var(--border); }
        .ne-blank p { font-size:14px; margin:0; }
        .ne-blank-btn { background:none; border:1px dashed var(--border); border-radius:8px; padding:8px 16px; font-size:13px; color:var(--muted); cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
        .ne-blank-btn:hover { border-color:#f97316; color:#f97316; }

        .ctx-menu { position:fixed; z-index:9999; background:var(--card-bg); border:1px solid var(--border); border-radius:11px; padding:5px; box-shadow:0 20px 60px rgba(0,0,0,0.25); min-width:200px; animation:nSlideDown 0.15s ease; }
        .ctx-section-label { font-size:10px; font-weight:700; color:var(--placeholder); text-transform:uppercase; letter-spacing:0.8px; padding:6px 10px 4px; }
        .ctx-item { display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:7px; font-size:13px; color:var(--text); cursor:pointer; transition:background 0.1s; font-family:'DM Sans',sans-serif; }
        .ctx-item:hover { background:var(--hover-bg); }
        .ctx-item.danger:hover { background:var(--danger-bg); color:var(--danger-text); }
        .ctx-icon { font-size:13px; width:16px; text-align:center; }
        .ctx-check { margin-left:auto; font-size:11px; color:#f97316; }
        .ctx-divider { height:1px; background:var(--border); margin:4px 0; }

        .notes-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:1000; }
        .notes-modal { background:var(--card-bg); border:1px solid var(--border); border-radius:20px; padding:30px; width:100%; max-width:420px; box-shadow:0 24px 64px rgba(0,0,0,0.3); animation:nSlideDown 0.3s cubic-bezier(0.16,1,0.3,1); }
        .notes-modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:22px; }
        .notes-modal-header h2 { font-family:'Syne',sans-serif; font-size:19px; font-weight:700; color:var(--text); }
        .notes-modal-close { background:none; border:none; color:var(--muted); font-size:15px; cursor:pointer; padding:4px 8px; border-radius:6px; transition:all 0.15s; }
        .notes-modal-close:hover { background:var(--hover-bg); color:var(--text); }
        .notes-modal-form { display:flex; flex-direction:column; gap:16px; }
        .nf { display:flex; flex-direction:column; gap:6px; }
        .nf label { font-size:12px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.4px; }
        .nf-opt { font-weight:400; color:var(--placeholder); text-transform:none; font-size:11px; }
        .nf input, .nf select { background:var(--input-bg); border:1px solid var(--border); border-radius:9px; padding:10px 13px; font-size:14px; color:var(--text); font-family:'DM Sans',sans-serif; outline:none; transition:border-color 0.2s; }
        .nf input:focus, .nf select:focus { border-color:rgba(249,115,22,0.5); box-shadow:0 0 0 2px rgba(249,115,22,0.1); }
        .nf select option { background:var(--card-bg); }
        .nf-error { font-size:12px; color:var(--danger-text); background:var(--danger-bg); border-radius:7px; padding:9px 13px; }
        .nf-submit { background:#f97316; color:white; border:none; border-radius:9px; padding:11px; font-size:14px; font-weight:600; font-family:'DM Sans',sans-serif; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; min-height:42px; box-shadow:0 4px 14px rgba(249,115,22,0.25); }
        .nf-submit:hover:not(:disabled) { background:#ea6c0a; transform:translateY(-1px); }
        .nf-submit:disabled { opacity:0.7; cursor:not-allowed; }
        .nf-spinner { width:15px; height:15px; border:2px solid rgba(255,255,255,0.3); border-top-color:white; border-radius:50%; animation:nSpin 0.7s linear infinite; display:inline-block; }

        @keyframes nSlideDown { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
      `}</style>
    </div>
  );
}