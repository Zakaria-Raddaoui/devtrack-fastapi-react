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

// ─── Merge Suggestion Banner ──────────────────────────────────────────────────

function MergeBanner({ suggestions, onAccept, onDismiss }) {
  const [idx, setIdx] = useState(0);
  if (!suggestions || suggestions.length === 0) return null;
  const s = suggestions[idx];

  return (
    <div className="merge-banner">
      <div className="merge-banner-icon">✦</div>
      <div className="merge-banner-body">
        <p className="merge-banner-reason">{s.reason}</p>
        <div className="merge-banner-tags">
          {s.children.map(c => (
            <span key={c} className="merge-banner-tag">{c}</span>
          ))}
          <span className="merge-banner-arrow">→</span>
          <span className="merge-banner-parent">{s.suggested_parent}</span>
        </div>
      </div>
      <div className="merge-banner-actions">
        <button className="merge-accept-btn" onClick={() => onAccept(s)}>
          Merge
        </button>
        <button className="merge-dismiss-btn" onClick={() => {
          onDismiss(s);
          if (idx >= suggestions.length - 1) setIdx(0);
        }}>
          Dismiss
        </button>
        {suggestions.length > 1 && (
          <span className="merge-counter">{idx + 1}/{suggestions.length}</span>
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
      <span className="tag-suggest-loading">Suggesting tags…</span>
    </div>
  );

  if (!suggestions || suggestions.length === 0) return null;

  // Filter out tags already applied
  const current = new Set(
    (currentTags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  );
  const fresh = suggestions.filter(t => !current.has(t.toLowerCase()));
  if (fresh.length === 0) return null;

  return (
    <div className="tag-suggest-row">
      <span className="tag-suggest-icon">✦</span>
      <span className="tag-suggest-label">AI suggests:</span>
      {fresh.map(tag => (
        <button key={tag} className="tag-suggest-chip" onClick={() => onAccept(tag)}>
          +{tag}
        </button>
      ))}
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenu({ x, y, note, folders, onClose, onMove, onDuplicate, onDelete }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="ctx-menu" style={{ top: y, left: x }}>
      <div className="ctx-item ctx-submenu-trigger">
        <span>📁 Move to folder</span>
        <span className="ctx-arrow">›</span>
        <div className="ctx-submenu">
          <div className="ctx-item" onClick={() => { onMove(note, null); onClose(); }}>
            <span>⊘ Unfiled</span>
            {!note.folder_id && <span className="ctx-check">✓</span>}
          </div>
          {folders.map(f => (
            <div key={f.id} className="ctx-item" onClick={() => { onMove(note, f.id); onClose(); }}>
              <span>📁 {f.title}</span>
              {note.folder_id === f.id && <span className="ctx-check">✓</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="ctx-divider" />
      <div className="ctx-item" onClick={() => { onDuplicate(note); onClose(); }}>
        <span>⧉ Duplicate</span>
      </div>
      <div className="ctx-divider" />
      <div className="ctx-item danger" onClick={() => { onDelete(note); onClose(); }}>
        <span>✕ Delete</span>
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
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/notes/', {
        ...form,
        content: '',
        is_pinned: false,
        folder_id: form.folder_id ? parseInt(form.folder_id) : null,
      });
      onCreated(res.data);
      onClose();
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="notes-overlay" onClick={onClose}>
      <div className="notes-modal" onClick={e => e.stopPropagation()}>
        <div className="notes-modal-header">
          <h2>New note</h2>
          <button className="notes-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="notes-modal-form">
          <div className="nf">
            <label>Title</label>
            <input name="title" value={form.title} onChange={handle}
              placeholder="Note title..." required autoFocus />
          </div>
          <div className="nf">
            <label>Folder <span className="nf-opt">(optional)</span></label>
            <select name="folder_id" value={form.folder_id} onChange={handle}>
              <option value="">No folder (Unfiled)</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
          <div className="nf">
            <label>Tags <span className="nf-opt">(optional, comma separated)</span></label>
            <input name="tags" value={form.tags} onChange={handle}
              placeholder="e.g. docker, backend, tips" />
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
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editing) await api.put(`/folders/${folder.id}`, { title });
      else await api.post('/folders/', { title });
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
    <div className="notes-overlay" onClick={onClose}>
      <div className="notes-modal" onClick={e => e.stopPropagation()}>
        <div className="notes-modal-header">
          <h2>{editing ? 'Rename folder' : 'New folder'}</h2>
          <button className="notes-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="notes-modal-form">
          <div className="nf">
            <label>Folder name</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Work, Personal, Ideas" required autoFocus />
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

// ─── Note Editor ──────────────────────────────────────────────────────────────

function NoteEditor({ note, onUpdate, onDelete, onTagsUpdated }) {
  const [mode, setMode] = useState('read');
  const [form, setForm] = useState({
    title: note.title,
    content: note.content || '',
    tags: note.tags || '',
    is_pinned: note.is_pinned
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const debounceRef = useRef(null);
  const textareaRef = useRef(null);

  // AI tag suggestions state
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestDebounceRef = useRef(null);
  const lastSuggestedContent = useRef('');

  useEffect(() => {
    setForm({ title: note.title, content: note.content || '', tags: note.tags || '', is_pinned: note.is_pinned });
    setTagSuggestions([]);
    lastSuggestedContent.current = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const autoSave = useCallback(async (data) => {
    setSaving(true); setSaved(false);
    try {
      const res = await api.put(`/notes/${note.id}`, data);
      onUpdate(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }, [note.id, onUpdate]);

  // Trigger AI tag suggestions after user stops typing (3s debounce, min 80 chars)
  const triggerSuggest = useCallback((title, content) => {
    clearTimeout(suggestDebounceRef.current);
    const combined = title + content;
    if (combined.length < 80) return;
    // Don't re-suggest if content barely changed
    if (Math.abs(combined.length - lastSuggestedContent.current.length) < 40) return;

    suggestDebounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await api.post('/tags/suggest', {
          note_id: note.id,
          title,
          content: content.slice(0, 1000),
        });
        setTagSuggestions(res.data.suggested_tags || []);
        lastSuggestedContent.current = combined;
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

    // Trigger tag suggestions on content/title changes
    if (name === 'content' || name === 'title') {
      triggerSuggest(
        name === 'title' ? val : updated.title,
        name === 'content' ? val : updated.content
      );
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setMode(m => m === 'read' ? 'edit' : 'read');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        clearTimeout(debounceRef.current);
        autoSave(form);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [form, autoSave]);

  useEffect(() => {
    if (mode === 'edit') setTimeout(() => textareaRef.current?.focus(), 50);
  }, [mode]);

  // Accept a single AI-suggested tag
  const acceptTag = useCallback(async (tag) => {
    const existing = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (existing.map(t => t.toLowerCase()).includes(tag.toLowerCase())) return;
    const newTags = [...existing, tag].join(', ');
    const updated = { ...form, tags: newTags };
    setForm(updated);
    setTagSuggestions(prev => prev.filter(t => t !== tag));
    clearTimeout(debounceRef.current);
    autoSave(updated);
    // Also register in Tag table
    try {
      await api.post('/tags/apply-to-note', null, { params: { note_id: note.id, tags: [tag] } });
    } catch (e) { /* not critical */ }
    if (onTagsUpdated) onTagsUpdated();
  }, [form, note.id, autoSave, onTagsUpdated]);

  const handleDelete = async () => {
    try {
      await api.delete(`/notes/${note.id}`);
      onDelete(note.id);
    } catch (e) { console.error(e); }
    finally { setConfirm(false); }
  };

  const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const words = wordCount(form.content);

  return (
    <div className="ne-root">
      <div className="ne-toolbar">
        <div className="ne-toolbar-left">
          {mode === 'edit' ? (
            <input className="ne-title-input" name="title" value={form.title}
              onChange={handleChange} placeholder="Note title..." />
          ) : (
            <h1 className="ne-title">{form.title}</h1>
          )}
        </div>
        <div className="ne-toolbar-right">
          {saving && <span className="ne-status saving">Saving...</span>}
          {saved && <span className="ne-status saved">✓ Saved</span>}
          <button
            className={`ne-btn ${form.is_pinned ? 'active' : ''}`}
            onClick={() => { const u = { ...form, is_pinned: !form.is_pinned }; setForm(u); autoSave(u); }}
            title={form.is_pinned ? 'Unpin' : 'Pin'}
          >{form.is_pinned ? '📌' : '○'}</button>
          <div className="ne-mode-toggle">
            <button className={`ne-mode-btn ${mode === 'read' ? 'active' : ''}`} onClick={() => setMode('read')}>Preview</button>
            <button className={`ne-mode-btn ${mode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}>Edit</button>
          </div>
          <button className="ne-btn danger" onClick={() => setConfirm(true)} title="Delete">✕</button>
        </div>
      </div>

      {/* Tags row */}
      <div className="ne-tags-row">
        {mode === 'edit' ? (
          <div className="ne-tags-edit">
            <span className="ne-tags-icon">#</span>
            <input className="ne-tags-input" name="tags" value={form.tags}
              onChange={handleChange} placeholder="Add tags, comma separated..." />
          </div>
        ) : (
          <div className="ne-tags-display">
            {tags.length > 0
              ? tags.map((t, i) => <span key={i} className="ne-tag">#{t}</span>)
              : <span className="ne-no-tags" onClick={() => setMode('edit')}>+ Add tags</span>
            }
          </div>
        )}
        <div className="ne-meta">
          <span>{words} words</span>
          <span>·</span>
          <span>Edited {timeAgo(note.updated_at)}</span>
          <span>·</span>
          <span className="ne-shortcut">Ctrl+E to {mode === 'read' ? 'edit' : 'preview'}</span>
        </div>
      </div>

      {/* AI tag suggestion row — only shown while editing */}
      {mode === 'edit' && (
        <TagSuggestions
          suggestions={tagSuggestions}
          currentTags={form.tags}
          onAccept={acceptTag}
          loading={suggestLoading}
        />
      )}

      <div className="ne-content">
        {mode === 'edit' ? (
          <textarea ref={textareaRef} className="ne-textarea" name="content"
            value={form.content} onChange={handleChange}
            placeholder={`Write in markdown...\n\n# Heading\n**bold**, *italic*, \`code\``} />
        ) : (
          <div className="ne-preview">
            {form.content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.content}</ReactMarkdown>
            ) : (
              <div className="ne-empty-content" onClick={() => setMode('edit')}>
                <p>This note is empty.</p>
                <button className="ne-start-writing">Start writing →</button>
              </div>
            )}
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title="Delete note"
          message={`Delete "${note.title}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── Note List Item ───────────────────────────────────────────────────────────

function NoteListItem({ note, isSelected, onClick, onContextMenu }) {
  const tags = note.tags ? note.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const preview = note.content?.replace(/[#*`_~[\]]/g, '').trim().slice(0, 80);

  return (
    <div
      className={`nl-item ${isSelected ? 'selected' : ''} ${note.is_pinned ? 'pinned' : ''}`}
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, note); }}
    >
      <div className="nl-item-top">
        <span className="nl-item-title">{note.title}</span>
        {note.is_pinned && <span className="nl-pin">📌</span>}
      </div>
      {tags.length > 0 && (
        <div className="nl-item-tags">
          {tags.slice(0, 3).map((t, i) => <span key={i} className="nl-item-tag">#{t}</span>)}
        </div>
      )}
      {preview && <p className="nl-item-preview">{preview}{note.content?.length > 80 ? '...' : ''}</p>}
      <span className="nl-item-time">{timeAgo(note.updated_at)}</span>
    </div>
  );
}

// ─── Tag Tree View (sidebar) ──────────────────────────────────────────────────

function TagTreeNode({ node, depth = 0, activeTag, onSelect }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ marginLeft: depth * 14 }}>
      <button
        className={`nf-tag-btn ${activeTag === node.name ? 'active' : ''}`}
        onClick={() => onSelect(node.name)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}
      >
        {hasChildren && (
          <span
            style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          >
            {expanded ? '▾' : '▸'}
          </span>
        )}
        <span style={{ flex: 1, textAlign: 'left' }}>#{node.name}</span>
        {node.note_count > 0 && (
          <span style={{ fontSize: 10, color: 'var(--placeholder)' }}>{node.note_count}</span>
        )}
      </button>
      {hasChildren && expanded && node.children.map(child => (
        <TagTreeNode key={child.id} node={child} depth={depth + 1} activeTag={activeTag} onSelect={onSelect} />
      ))}
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
  const [ctxMenu, setCtxMenu] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [notesRes, foldersRes] = await Promise.all([
        api.get('/notes/'),
        api.get('/folders/'),
      ]);
      setNotes(notesRes.data);
      setFolders(foldersRes.data);
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
      const [treeRes, mergeRes] = await Promise.all([
        api.get('/tags/'),
        api.get('/tags/merge-suggestions'),
      ]);
      setTagTree(treeRes.data);
      setMergeSuggestions(mergeRes.data);
    } catch (e) { /* tags are non-critical */ }
  }, []);

  useEffect(() => { fetchAll(); fetchTags(); }, [fetchAll, fetchTags]);

  const handleAcceptMerge = async (suggestion) => {
    try {
      await api.post('/tags/merge-suggestions/accept', {
        suggestion_id: suggestion.id,
        parent_name: suggestion.suggested_parent,
        child_names: suggestion.children,
      });
      setMergeSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      fetchTags();
    } catch (e) { console.error(e); }
  };

  const handleDismissMerge = async (suggestion) => {
    try {
      await api.post('/tags/merge-suggestions/dismiss', { suggestion_id: suggestion.id });
      setMergeSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    } catch (e) { console.error(e); }
  };

  // Build flat tag list for filtering from notes (fast, no extra fetch)
  const allTags = [...new Set(
    notes.flatMap(n => n.tags ? n.tags.split(',').map(t => t.trim()).filter(Boolean) : [])
  )];

  // Determine whether to show tree (from /tags/) or flat fallback
  const useTree = tagTree.length > 0;

  const filtered = notes
    .filter(n => {
      if (activeFolder === 'unfiled') return !n.folder_id;
      if (activeFolder !== null) return n.folder_id === activeFolder;
      return true;
    })
    .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content?.toLowerCase().includes(search.toLowerCase()))
    .filter(n => !activeTag || n.tags?.toLowerCase().includes(activeTag.toLowerCase()));

  const pinned = filtered.filter(n => n.is_pinned);
  const unpinned = filtered.filter(n => !n.is_pinned);

  const handleUpdate = useCallback((updated) => {
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
    setSelected(updated);
  }, []);

  const handleDelete = useCallback((id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setSelected(null);
  }, []);

  const handleCreated = useCallback((note) => {
    setNotes(prev => [note, ...prev]);
    setSelected(note);
  }, []);

  const handleMove = async (note, folderId) => {
    try {
      const res = await api.put(`/notes/${note.id}`, { folder_id: folderId });
      setNotes(prev => prev.map(n => n.id === res.data.id ? res.data : n));
      if (selected?.id === res.data.id) setSelected(res.data);
    } catch (e) { console.error(e); }
  };

  const handleDuplicate = async (note) => {
    try {
      const res = await api.post('/notes/', {
        title: note.title + ' (copy)',
        content: note.content,
        tags: note.tags,
        is_pinned: false,
        folder_id: note.folder_id,
      });
      setNotes(prev => [res.data, ...prev]);
      setSelected(res.data);
    } catch (e) { console.error(e); }
  };

  const handleContextDelete = (note) => setConfirmDelete(note);

  const confirmDeleteNote = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/notes/${confirmDelete.id}`);
      handleDelete(confirmDelete.id);
    } catch (e) { console.error(e); }
    finally { setConfirmDelete(null); }
  };

  const handleDeleteFolder = async () => {
    if (!confirmDeleteFolder) return;
    try {
      await api.delete(`/folders/${confirmDeleteFolder.id}`);
      setFolders(prev => prev.filter(f => f.id !== confirmDeleteFolder.id));
      setNotes(prev => prev.map(n => n.folder_id === confirmDeleteFolder.id ? { ...n, folder_id: null } : n));
      if (activeFolder === confirmDeleteFolder.id) setActiveFolder(null);
    } catch (e) { console.error(e); }
    finally { setConfirmDeleteFolder(null); }
  };

  const onContextMenu = (e, note) => {
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setCtxMenu({ x, y, note });
  };

  if (loading) return (
    <div className="notes-loading"><div className="notes-ring" /></div>
  );

  return (
    <div className="notes-root" onClick={() => setCtxMenu(null)}>
      {/* Sidebar */}
      <div className="notes-sidebar">
        <div className="notes-sidebar-header">
          <h2 className="notes-sidebar-title">Notes <span className="notes-count">{notes.length}</span></h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="notes-icon-btn" onClick={() => setFolderModal({})} title="New folder">📁</button>
            <button className="notes-new-btn" onClick={() => setShowNew(true)} title="New note">+</button>
          </div>
        </div>

        <div className="notes-search-wrap">
          <span className="notes-search-icon">⌕</span>
          <input className="notes-search" placeholder="Search notes..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="notes-views">
          <button className={`notes-view-btn ${activeFolder === null ? 'active' : ''}`} onClick={() => setActiveFolder(null)}>
            <span>◇</span> All notes <span className="notes-view-count">{notes.length}</span>
          </button>
          <button className={`notes-view-btn ${activeFolder === 'unfiled' ? 'active' : ''}`} onClick={() => setActiveFolder('unfiled')}>
            <span>⊘</span> Unfiled <span className="notes-view-count">{notes.filter(n => !n.folder_id).length}</span>
          </button>
        </div>

        {folders.length > 0 && (
          <div className="notes-folders-section">
            <div className="notes-section-label">Folders</div>
            {folders.map(f => (
              <div key={f.id} className={`notes-folder-btn ${activeFolder === f.id ? 'active' : ''}`} onClick={() => setActiveFolder(f.id)}>
                <span className="folder-icon">📁</span>
                <span className="folder-title">{f.title}</span>
                <span className="notes-view-count">{notes.filter(n => n.folder_id === f.id).length}</span>
                <div className="folder-actions" onClick={e => e.stopPropagation()}>
                  <button className="folder-action-btn" onClick={() => setFolderModal(f)} title="Rename">✎</button>
                  <button className="folder-action-btn danger" onClick={() => setConfirmDeleteFolder(f)} title="Delete">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tags — tree view if available, flat fallback */}
        {(useTree ? tagTree.length > 0 : allTags.length > 0) && (
          <div className="notes-tags-filter">
            <div className="notes-section-label">Tags</div>
            <div className="notes-tags-list">
              {useTree
                ? tagTree.map(node => (
                  <TagTreeNode
                    key={node.id}
                    node={node}
                    activeTag={activeTag}
                    onSelect={t => setActiveTag(activeTag === t ? '' : t)}
                  />
                ))
                : allTags.map(tag => (
                  <button key={tag} className={`nf-tag-btn ${activeTag === tag ? 'active' : ''}`}
                    onClick={() => setActiveTag(activeTag === tag ? '' : tag)}>
                    #{tag}
                  </button>
                ))
              }
              {activeTag && (
                <button className="nf-tag-btn clear" onClick={() => setActiveTag('')}>
                  ✕ Clear filter
                </button>
              )}
            </div>
          </div>
        )}

        <div className="notes-list">
          {filtered.length === 0 ? (
            <div className="notes-list-empty">
              <p>{search ? 'No notes found' : 'No notes here'}</p>
              <button className="notes-list-new-btn" onClick={() => setShowNew(true)}>+ New note</button>
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <>
                  <div className="notes-list-section">Pinned</div>
                  {pinned.map(n => (
                    <NoteListItem key={n.id} note={n} isSelected={selected?.id === n.id}
                      onClick={() => setSelected(n)} onContextMenu={onContextMenu} />
                  ))}
                </>
              )}
              {unpinned.length > 0 && (
                <>
                  {pinned.length > 0 && <div className="notes-list-section">Notes</div>}
                  {unpinned.map(n => (
                    <NoteListItem key={n.id} note={n} isSelected={selected?.id === n.id}
                      onClick={() => setSelected(n)} onContextMenu={onContextMenu} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="notes-main">
        {/* Merge suggestion banner — shown at top of main content area */}
        <MergeBanner
          suggestions={mergeSuggestions}
          onAccept={handleAcceptMerge}
          onDismiss={handleDismissMerge}
        />

        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onTagsUpdated={fetchTags}
          />
        ) : (
          <div className="notes-empty-state">
            <div className="notes-empty-icon">◇</div>
            <h2 className="notes-empty-title">Select a note</h2>
            <p className="notes-empty-sub">Or create a new one to get started</p>
            <button className="notes-empty-btn" onClick={() => setShowNew(true)}>+ New note</button>
          </div>
        )}
      </div>

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} note={ctxMenu.note} folders={folders}
          onClose={() => setCtxMenu(null)} onMove={handleMove}
          onDuplicate={handleDuplicate} onDelete={handleContextDelete} />
      )}

      {showNew && (
        <NewNoteModal folders={folders} currentFolderId={typeof activeFolder === 'number' ? activeFolder : null}
          onClose={() => setShowNew(false)} onCreated={handleCreated} />
      )}

      {folderModal !== null && (
        <FolderModal folder={folderModal?.id ? folderModal : null}
          onClose={() => setFolderModal(null)} onSaved={fetchAll} />
      )}

      {confirmDelete && (
        <ConfirmDialog title="Delete note"
          message={`Delete "${confirmDelete.title}"? This cannot be undone.`}
          onConfirm={confirmDeleteNote} onCancel={() => setConfirmDelete(null)} />
      )}

      {confirmDeleteFolder && (
        <ConfirmDialog title="Delete folder"
          message={`Delete "${confirmDeleteFolder.title}"? Notes inside will be moved to Unfiled.`}
          onConfirm={handleDeleteFolder} onCancel={() => setConfirmDeleteFolder(null)} />
      )}

      <style>{`
        .notes-root { display: flex; height: 100vh; width: 100%; overflow: hidden; }

        .notes-loading {
          display: flex; align-items: center;
          justify-content: center; height: 100vh; width: 100%;
        }

        .notes-ring {
          width: 36px; height: 36px;
          border: 3px solid var(--border);
          border-top-color: #f97316; border-radius: 50%;
          animation: nSpin 0.8s linear infinite;
        }

        @keyframes nSpin { to { transform: rotate(360deg); } }

        /* ── Merge Banner ── */
        .merge-banner {
          display: flex; align-items: flex-start; gap: 12px;
          background: linear-gradient(135deg, rgba(249,115,22,0.08), rgba(249,115,22,0.04));
          border-bottom: 1px solid rgba(249,115,22,0.2);
          padding: 12px 20px;
          animation: nSlide 0.3s ease;
          flex-shrink: 0;
        }

        .merge-banner-icon {
          color: #f97316; font-size: 14px; margin-top: 2px; flex-shrink: 0;
        }

        .merge-banner-body { flex: 1; min-width: 0; }

        .merge-banner-reason {
          font-size: 12px; font-weight: 600; color: var(--text);
          margin: 0 0 6px; line-height: 1.4;
        }

        .merge-banner-tags {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        }

        .merge-banner-tag {
          font-size: 11px; font-weight: 600;
          background: var(--tag-bg); color: var(--tag-text);
          padding: 2px 8px; border-radius: 99px;
        }

        .merge-banner-arrow { font-size: 12px; color: var(--muted); }

        .merge-banner-parent {
          font-size: 11px; font-weight: 700;
          background: rgba(249,115,22,0.15); color: #f97316;
          padding: 2px 8px; border-radius: 99px;
          border: 1px solid rgba(249,115,22,0.3);
        }

        .merge-banner-actions {
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }

        .merge-accept-btn {
          background: #f97316; color: white; border: none;
          border-radius: 6px; padding: 5px 12px;
          font-size: 12px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
          box-shadow: 0 2px 8px rgba(249,115,22,0.3);
        }
        .merge-accept-btn:hover { background: #ea6c0a; transform: translateY(-1px); }

        .merge-dismiss-btn {
          background: none; border: 1px solid var(--border);
          border-radius: 6px; padding: 5px 10px;
          font-size: 12px; color: var(--muted);
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
        }
        .merge-dismiss-btn:hover { border-color: var(--muted); color: var(--text); }

        .merge-counter { font-size: 11px; color: var(--placeholder); }

        /* ── Tag suggestions row ── */
        .tag-suggest-row {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          padding: 7px 32px;
          background: rgba(249,115,22,0.04);
          border-bottom: 1px solid rgba(249,115,22,0.1);
          flex-shrink: 0; animation: nSlide 0.2s ease;
        }

        .tag-suggest-icon { color: #f97316; font-size: 12px; }

        .tag-suggest-label { font-size: 11px; color: var(--muted); font-weight: 600; }

        .tag-suggest-loading { font-size: 11px; color: var(--placeholder); }

        .tag-suggest-chip {
          font-size: 11px; font-weight: 600;
          background: none; border: 1px dashed rgba(249,115,22,0.4);
          color: #f97316; border-radius: 99px;
          padding: 2px 10px; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
        }
        .tag-suggest-chip:hover {
          background: rgba(249,115,22,0.1);
          border-style: solid;
        }

        /* ── Sidebar ── */
        .notes-sidebar {
          width: 280px; min-width: 280px; height: 100vh;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column; overflow: hidden;
        }

        .notes-sidebar-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 20px 16px 12px; flex-shrink: 0;
        }

        .notes-sidebar-title {
          font-family: 'Syne', sans-serif;
          font-size: 18px; font-weight: 700; color: var(--text); margin: 0;
          display: flex; align-items: center; gap: 8px;
        }

        .notes-count {
          font-size: 12px; font-weight: 500; color: var(--muted);
          background: var(--bg); border: 1px solid var(--border);
          padding: 1px 7px; border-radius: 99px;
        }

        .notes-icon-btn, .notes-new-btn {
          background: none; border: 1px solid var(--border);
          border-radius: 8px; padding: 6px 10px;
          font-size: 14px; color: var(--muted); cursor: pointer;
          transition: all 0.15s; font-family: 'DM Sans', sans-serif;
        }
        .notes-new-btn { font-size: 18px; }
        .notes-icon-btn:hover, .notes-new-btn:hover { border-color: #f97316; color: #f97316; }

        .notes-search-wrap {
          display: flex; align-items: center; gap: 8px;
          margin: 0 12px 8px;
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: 8px 12px; flex-shrink: 0;
        }
        .notes-search-icon { font-size: 14px; color: var(--placeholder); }
        .notes-search {
          flex: 1; background: none; border: none; outline: none;
          font-size: 13px; color: var(--text); font-family: 'DM Sans', sans-serif;
        }
        .notes-search::placeholder { color: var(--placeholder); }

        .notes-views { padding: 0 8px 4px; flex-shrink: 0; }

        .notes-view-btn {
          display: flex; align-items: center; gap: 8px;
          width: 100%; background: none; border: none;
          border-radius: 8px; padding: 7px 10px;
          font-size: 13px; color: var(--muted);
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s; text-align: left;
        }
        .notes-view-btn:hover { background: var(--hover-bg); color: var(--text); }
        .notes-view-btn.active { background: var(--hover-bg); color: #f97316; font-weight: 600; }

        .notes-view-count {
          margin-left: auto; font-size: 11px; color: var(--placeholder);
        }

        .notes-section-label {
          font-size: 10px; font-weight: 700; color: var(--placeholder);
          text-transform: uppercase; letter-spacing: 0.8px;
          padding: 8px 18px 4px;
        }

        .notes-folders-section { flex-shrink: 0; }

        .notes-folder-btn {
          display: flex; align-items: center; gap: 7px;
          width: 100%; background: none; border: none;
          border-radius: 8px; padding: 7px 10px;
          font-size: 13px; color: var(--muted);
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s; text-align: left; position: relative;
        }
        .notes-folder-btn:hover { background: var(--hover-bg); color: var(--text); }
        .notes-folder-btn.active { background: var(--hover-bg); color: #f97316; }

        .folder-icon { font-size: 13px; }
        .folder-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .folder-actions {
          display: flex; gap: 2px;
          opacity: 0; transition: opacity 0.15s;
        }
        .notes-folder-btn:hover .folder-actions { opacity: 1; }

        .folder-action-btn {
          background: none; border: none; border-radius: 4px;
          padding: 2px 5px; font-size: 11px; color: var(--muted);
          cursor: pointer; transition: all 0.15s;
        }
        .folder-action-btn:hover { background: var(--bg); color: var(--text); }
        .folder-action-btn.danger:hover { color: var(--danger-text); }

        .notes-tags-filter { flex-shrink: 0; max-height: 200px; overflow-y: auto; }

        .notes-tags-list { padding: 2px 8px 8px; display: flex; flex-direction: column; gap: 2px; }

        .nf-tag-btn {
          display: flex; align-items: center;
          width: 100%; background: none; border: none;
          border-radius: 6px; padding: 5px 10px;
          font-size: 12px; color: var(--muted);
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s; text-align: left;
        }
        .nf-tag-btn:hover { background: var(--hover-bg); color: var(--text); }
        .nf-tag-btn.active { background: var(--hover-bg); color: #f97316; font-weight: 600; }
        .nf-tag-btn.clear { color: var(--danger-text); font-size: 11px; margin-top: 4px; }
        .nf-tag-btn.clear:hover { background: var(--danger-bg); }

        .notes-list {
          flex: 1; overflow-y: auto; padding: 4px 8px 16px;
        }

        .notes-list-section {
          font-size: 10px; font-weight: 700; color: var(--placeholder);
          text-transform: uppercase; letter-spacing: 0.8px;
          padding: 8px 8px 4px;
        }

        .notes-list-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 10px; padding: 32px 16px; text-align: center;
          font-size: 13px; color: var(--muted);
        }

        .notes-list-new-btn {
          background: none; border: 1px dashed var(--border);
          border-radius: 8px; padding: 7px 16px;
          font-size: 13px; color: var(--muted); cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .notes-list-new-btn:hover { border-color: #f97316; color: #f97316; }

        /* ── Note list item ── */
        .nl-item {
          border-radius: 10px; padding: 12px;
          cursor: pointer; transition: background 0.15s;
          margin-bottom: 2px;
        }
        .nl-item:hover { background: var(--hover-bg); }
        .nl-item.selected { background: var(--hover-bg); }
        .nl-item.pinned { border-left: 2px solid #f97316; padding-left: 10px; }

        .nl-item-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }

        .nl-item-title {
          font-size: 13px; font-weight: 600; color: var(--text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
        }

        .nl-pin { font-size: 11px; flex-shrink: 0; }

        .nl-item-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 3px; }

        .nl-item-tag {
          font-size: 10px; color: var(--tag-text); background: var(--tag-bg);
          padding: 1px 6px; border-radius: 99px; font-weight: 600;
        }

        .nl-item-preview {
          font-size: 12px; color: var(--muted); line-height: 1.4;
          margin: 0 0 3px; overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }

        .nl-item-time { font-size: 11px; color: var(--placeholder); }

        /* ── Main / Editor area ── */
        .notes-main {
          flex: 1; min-width: 0; display: flex; flex-direction: column; height: 100vh; overflow: hidden;
        }

        .notes-empty-state {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 12px; color: var(--muted); text-align: center;
        }

        .notes-empty-icon { font-size: 48px; color: var(--border); }

        .notes-empty-title {
          font-family: 'Syne', sans-serif;
          font-size: 20px; font-weight: 700; color: var(--text); margin: 0;
        }

        .notes-empty-sub { font-size: 14px; color: var(--muted); margin: 0; }

        .notes-empty-btn {
          background: #f97316; color: white; border: none;
          border-radius: 10px; padding: 10px 20px;
          font-size: 14px; font-weight: 600; cursor: pointer;
          font-family: 'DM Sans', sans-serif; transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(249,115,22,0.3); margin-top: 4px;
        }
        .notes-empty-btn:hover { background: #ea6c0a; transform: translateY(-1px); }

        /* ── Note Editor ── */
        .ne-root {
          display: flex; flex-direction: column; height: 100%; overflow: hidden;
        }

        .ne-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; padding: 14px 32px;
          border-bottom: 1px solid var(--border); flex-shrink: 0;
        }

        .ne-toolbar-left { flex: 1; min-width: 0; }
        .ne-toolbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

        .ne-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px; font-weight: 700; color: var(--text);
          margin: 0; letter-spacing: -0.3px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .ne-title-input {
          font-family: 'Syne', sans-serif;
          font-size: 22px; font-weight: 700; color: var(--text);
          background: none; border: none; outline: none; width: 100%;
          letter-spacing: -0.3px;
        }

        .ne-status {
          font-size: 12px; padding: 3px 10px;
          border-radius: 99px; font-weight: 500;
        }
        .ne-status.saving { color: var(--muted); background: var(--bg); }
        .ne-status.saved { color: var(--success-text); background: var(--success-bg); }

        .ne-btn {
          background: none; border: 1px solid var(--border);
          border-radius: 8px; padding: 6px 10px;
          font-size: 14px; color: var(--muted);
          cursor: pointer; transition: all 0.15s;
        }
        .ne-btn:hover { border-color: #f97316; color: #f97316; }
        .ne-btn.active { color: #f97316; border-color: rgba(249,115,22,0.3); }
        .ne-btn.danger:hover { border-color: var(--danger-text); color: var(--danger-text); }

        .ne-mode-toggle {
          display: flex; background: var(--bg);
          border: 1px solid var(--border); border-radius: 8px; padding: 3px;
        }

        .ne-mode-btn {
          background: none; border: none; border-radius: 6px; padding: 4px 12px;
          font-size: 12px; font-weight: 500; color: var(--muted);
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .ne-mode-btn.active { background: var(--card-bg); color: var(--text); box-shadow: 0 1px 3px var(--shadow); }

        .ne-tags-row {
          display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
          padding: 10px 32px; border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        .ne-tags-edit { display: flex; align-items: center; gap: 6px; flex: 1; }
        .ne-tags-icon { font-size: 13px; color: var(--muted); }

        .ne-tags-input {
          flex: 1; background: none; border: none; outline: none;
          font-size: 13px; color: var(--muted); font-family: 'DM Sans', sans-serif;
        }
        .ne-tags-input::placeholder { color: var(--placeholder); }

        .ne-tags-display { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }

        .ne-tag {
          font-size: 11px; font-weight: 600;
          color: var(--tag-text); background: var(--tag-bg);
          padding: 2px 8px; border-radius: 99px;
        }

        .ne-no-tags {
          font-size: 12px; color: var(--placeholder);
          cursor: pointer; transition: color 0.15s;
        }
        .ne-no-tags:hover { color: #f97316; }

        .ne-meta {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; color: var(--placeholder);
          flex-shrink: 0; white-space: nowrap;
        }

        .ne-shortcut {
          font-size: 10px; color: var(--placeholder);
          background: var(--bg); border: 1px solid var(--border);
          border-radius: 4px; padding: 1px 6px;
        }

        .ne-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

        .ne-textarea {
          flex: 1; width: 100%; height: 100%;
          background: none; border: none; outline: none;
          padding: 28px 32px;
          font-size: 15px; color: var(--text);
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          line-height: 1.8; resize: none; box-sizing: border-box; overflow-y: auto;
        }
        .ne-textarea::placeholder { color: var(--placeholder); }

        .ne-preview {
          flex: 1; overflow-y: auto; padding: 28px 32px;
          font-size: 15px; color: var(--text); line-height: 1.8;
        }

        .ne-preview p  { margin: 0 0 12px; }
        .ne-preview p:last-child { margin: 0; }
        .ne-preview h1 { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; color: var(--text); margin: 24px 0 10px; letter-spacing: -0.5px; padding-bottom: 8px; border-bottom: 2px solid var(--border); }
        .ne-preview h2 { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: var(--text); margin: 20px 0 8px; }
        .ne-preview h3 { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: var(--text); margin: 16px 0 6px; }
        .ne-preview ul, .ne-preview ol { padding-left: 24px; margin: 8px 0; }
        .ne-preview li { margin-bottom: 4px; }
        .ne-preview code { background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px; font-size: 13px; color: #f97316; font-family: monospace; }
        .ne-preview pre { background: var(--input-bg); border: 1px solid var(--border); border-radius: 10px; padding: 16px; overflow-x: auto; margin: 12px 0; }
        .ne-preview pre code { background: none; border: none; padding: 0; color: var(--text); }
        .ne-preview strong { font-weight: 700; }
        .ne-preview em { font-style: italic; color: var(--muted); }
        .ne-preview blockquote { border-left: 3px solid #f97316; padding-left: 16px; margin: 12px 0; color: var(--muted); font-style: italic; }
        .ne-preview a { color: #f97316; text-decoration: underline; }
        .ne-preview hr { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
        .ne-preview table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .ne-preview th, .ne-preview td { border: 1px solid var(--border); padding: 10px 14px; font-size: 14px; }
        .ne-preview th { background: var(--input-bg); font-weight: 600; }

        .ne-empty-content {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 100%; gap: 12px; color: var(--muted); text-align: center;
        }

        .ne-start-writing {
          background: none; border: 1px dashed var(--border);
          border-radius: 8px; padding: 8px 16px;
          font-size: 13px; color: var(--muted);
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .ne-start-writing:hover { border-color: #f97316; color: #f97316; }

        /* ── Context menu ── */
        .ctx-menu {
          position: fixed; z-index: 9999;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 12px; padding: 6px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.25);
          min-width: 180px;
          animation: nSlide 0.15s ease;
        }

        .ctx-item {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 8px 10px; border-radius: 7px;
          font-size: 13px; color: var(--text); cursor: pointer;
          transition: background 0.1s; position: relative;
          font-family: 'DM Sans', sans-serif;
        }
        .ctx-item:hover { background: var(--hover-bg); }
        .ctx-item.danger:hover { background: var(--danger-bg); color: var(--danger-text); }

        .ctx-arrow { font-size: 16px; color: var(--muted); }
        .ctx-check { font-size: 12px; color: #f97316; }

        .ctx-submenu-trigger .ctx-submenu {
          display: none; position: absolute;
          left: 100%; top: 0; z-index: 10000;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 12px; padding: 6px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.25);
          min-width: 180px;
        }
        .ctx-submenu-trigger:hover .ctx-submenu { display: block; }

        .ctx-divider { height: 1px; background: var(--border); margin: 4px 0; }

        /* ── Modals ── */
        .notes-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }

        .notes-modal {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 20px; padding: 32px;
          width: 100%; max-width: 420px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.3);
          animation: nSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes nSlide {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .notes-modal-header {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 24px;
        }

        .notes-modal-header h2 {
          font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: var(--text);
        }

        .notes-modal-close {
          background: none; border: none; color: var(--muted);
          font-size: 16px; cursor: pointer; padding: 4px 8px;
          border-radius: 6px; transition: all 0.2s;
        }
        .notes-modal-close:hover { background: var(--hover-bg); color: var(--text); }

        .notes-modal-form { display: flex; flex-direction: column; gap: 18px; }

        .nf { display: flex; flex-direction: column; gap: 7px; }
        .nf label { font-size: 13px; font-weight: 500; color: var(--muted); }
        .nf-opt { font-weight: 400; color: var(--placeholder); }

        .nf input, .nf select {
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: 11px 14px;
          font-size: 14px; color: var(--text);
          font-family: 'DM Sans', sans-serif; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .nf input:focus, .nf select:focus { border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.12); }
        .nf select option { background: var(--card-bg); }

        .nf-error { font-size: 13px; color: var(--danger-text); background: var(--danger-bg); border-radius: 8px; padding: 10px 14px; }

        .nf-submit {
          background: #f97316; color: white; border: none;
          border-radius: 10px; padding: 12px;
          font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
          min-height: 44px; box-shadow: 0 4px 16px rgba(249,115,22,0.3);
        }
        .nf-submit:hover:not(:disabled) { background: #ea6c0a; transform: translateY(-1px); }
        .nf-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .nf-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: nSpin 0.7s linear infinite; display: inline-block;
        }
      `}</style>
    </div>
  );
}