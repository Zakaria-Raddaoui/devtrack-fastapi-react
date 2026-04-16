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

function splitTagString(tagString) {
  if (!tagString) return [];
  const seen = new Set();
  return tagString
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .filter((t) => {
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function mergeTagStrings(currentTags, incomingTags) {
  const merged = [...splitTagString(currentTags)];
  const seen = new Set(merged.map(t => t.toLowerCase()));
  for (const tag of incomingTags || []) {
    const clean = String(tag || '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(clean);
  }
  return merged.join(', ');
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
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestDebounceRef = useRef(null);
  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  useEffect(() => {
    clearTimeout(suggestDebounceRef.current);
    const title = form.title.trim();
    if (title.length < 6) {
      setTagSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    suggestDebounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await api.post('/tags/suggest', {
          note_id: null,
          title,
          content: '',
          current_tags: form.tags,
        });
        const existing = new Set(splitTagString(form.tags).map(t => t.toLowerCase()));
        const fresh = (res.data.suggested_tags || []).filter(t => !existing.has(String(t).toLowerCase()));
        setTagSuggestions(fresh);
      } catch (_) {
        setTagSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 900);

    return () => clearTimeout(suggestDebounceRef.current);
  }, [form.title, form.tags]);

  const addSuggestedTag = (tag) => {
    setForm(prev => ({ ...prev, tags: mergeTagStrings(prev.tags, [tag]) }));
    setTagSuggestions(prev => prev.filter(t => t.toLowerCase() !== tag.toLowerCase()));
  };

  const submit = async e => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await api.post('/notes/', {
        ...form,
        tags: mergeTagStrings(form.tags, []),
        content: '',
        is_pinned: false,
        folder_id: form.folder_id ? parseInt(form.folder_id) : null,
      });
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
          {(suggestLoading || tagSuggestions.length > 0) && (
            <div className="nf-tag-suggest-row">
              <span className="nf-tag-suggest-label">Suggested</span>
              {suggestLoading && <span className="nf-tag-suggest-loading">Generating...</span>}
              {tagSuggestions.map(tag => (
                <button type="button" key={tag} className="nf-tag-suggest-chip" onClick={() => addSuggestedTag(tag)}>
                  +{tag}
                </button>
              ))}
            </div>
          )}
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
  const formRef = useRef(form);

  // ── Auto-tag state ──
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestDebounceRef = useRef(null);
  const lastSuggestedLen = useRef(0);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

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
        const currentTags = formRef.current.tags;
        const res = await api.post('/tags/suggest', {
          note_id: note.id,
          title,
          content: content.slice(0, 1000),
          current_tags: currentTags,
        });
        const suggested = res.data.suggested_tags || [];
        const existingSet = new Set(splitTagString(currentTags).map(t => t.toLowerCase()));
        const fresh = suggested.filter(t => !existingSet.has(String(t).toLowerCase()));

        const autoTags = fresh.slice(0, 2);
        if (autoTags.length > 0) {
          const mergedTags = mergeTagStrings(formRef.current.tags, autoTags);
          if (mergedTags !== formRef.current.tags) {
            const updated = { ...formRef.current, tags: mergedTags };
            formRef.current = updated;
            setForm(updated);
            clearTimeout(debounceRef.current);
            autoSave(updated);
            try {
              const query = autoTags.map(t => `tags=${encodeURIComponent(t)}`).join('&');
              await api.post(`/tags/apply-to-note?note_id=${note.id}&${query}`);
            } catch (_) { /* non-critical */ }
            if (onTagsUpdated) onTagsUpdated();
          }
        }

        setTagSuggestions(fresh.filter(t => !autoTags.includes(t)));
        lastSuggestedLen.current = combined.length;
      } catch (e) { /* silently fail */ }
      finally { setSuggestLoading(false); }
    }, 2200);
  }, [note.id, autoSave, onTagsUpdated]);

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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const uploadedUrl = res.data.url;
      const url = uploadedUrl?.startsWith('http')
        ? uploadedUrl
        : `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${uploadedUrl}`;

      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = form.content || '';
      const insert = `\n![${file.name}](${url})\n`;

      const newContent = text.substring(0, start) + insert + text.substring(end);
      const updated = { ...form, content: newContent };
      setForm(updated);
      clearTimeout(debounceRef.current);
      autoSave(updated);

      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = start + insert.length;
        textarea.selectionEnd = start + insert.length;
      }, 50);
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const acceptTag = useCallback(async (tag) => {
    const existing = splitTagString(form.tags).map(t => t.toLowerCase());
    if (existing.includes(tag.toLowerCase())) return;
    const newTags = mergeTagStrings(form.tags, [tag]);
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

          {mode === 'edit' && (
            <label className="ne-tool-btn" title="Insert Image" style={{ cursor: 'pointer', margin: 0, padding: 6, display: 'flex' }}>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <rect x="3" y="3" width="14" height="14" rx="2" />
                <circle cx="7" cy="7" r="1.5" />
                <polyline points="3,14 8,9 13,14" />
                <polyline points="11,12 13,10 17,14" />
              </svg>
            </label>
          )}

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
        .notes-ring { width:48px; height:48px; border:4px solid var(--border); border-top-color:#f97316; border-radius:50%; animation:nSpin 0.8s linear infinite; }
        @keyframes nSpin { to { transform:rotate(360deg); } }

        .tag-chip { display:inline-flex; align-items:center; font-size:12px; font-weight:800; font-family:var(--font-heading); padding:4px 12px; border-radius:99px; letter-spacing:0.3px; line-height:1.6; white-space:nowrap; cursor:default; }
        .tag-chip-xs { font-size:10px; padding:2px 8px; }
        .tag-chip-sm { font-size:11px; padding:3px 10px; }

        .merge-banner { display:flex; align-items:center; gap:16px; background:linear-gradient(135deg,rgba(249,115,22,0.08),rgba(249,115,22,0.03)); border-bottom:1px solid rgba(249,115,22,0.15); padding:16px 24px; flex-shrink:0; animation:nSlideDown 0.3s ease; }
        .merge-banner-icon { color:#f97316; font-size:16px; flex-shrink:0; }
        .merge-banner-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:6px; }
        .merge-banner-reason { font-size:14px; font-weight:700; color:var(--text); margin:0; font-family:var(--font-heading); }
        .merge-banner-tags { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .merge-arrow { font-size:12px; color:var(--muted); font-weight:700; }
        .merge-parent { font-size:12px; font-weight:800; background:rgba(249,115,22,0.12); color:#f97316; padding:4px 10px; border-radius:99px; border:1px solid rgba(249,115,22,0.25); font-family:var(--font-heading); }
        .merge-banner-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .merge-accept-btn { background:#f97316; color:white; border:none; border-radius:8px; padding:8px 16px; font-size:14px; font-weight:700; cursor:pointer; font-family:var(--font-heading); transition:all 0.2s; box-shadow:0 4px 12px rgba(249,115,22,0.3); }
        .merge-accept-btn:hover { background:#ea6c0a; transform:translateY(-1px); box-shadow:0 6px 16px rgba(249,115,22,0.4); }
        .merge-dismiss-btn { background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:8px 14px; font-size:13px; font-weight:600; color:var(--muted); cursor:pointer; font-family:var(--font-body); transition:all 0.2s; box-shadow:0 2px 6px var(--shadow); }
        .merge-dismiss-btn:hover { border-color:var(--muted); color:var(--text); box-shadow:0 4px 10px var(--shadow); }
        .merge-nav-btn { background:var(--card-bg); border:1px solid var(--border); border-radius:6px; padding:4px 10px; font-size:14px; color:var(--muted); font-weight:700; cursor:pointer; font-family:var(--font-body); transition:all 0.2s; box-shadow:0 2px 6px var(--shadow); }
        .merge-nav-btn:hover { color:var(--text); background:var(--bg); transform:translateY(-1px); }
        .merge-counter { font-size:12px; color:var(--text); font-weight:700; min-width:32px; text-align:center; font-family:var(--font-heading); }

        .tag-suggest-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:10px 32px; background:rgba(249,115,22,0.03); border-bottom:1px solid rgba(249,115,22,0.08); flex-shrink:0; animation:nSlideDown 0.2s ease; }
        .tag-suggest-icon { color:#f97316; font-size:13px; }
        .tag-suggest-label { font-size:12px; color:var(--muted); font-weight:700; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.5px; }
        .tag-suggest-loading { font-size:13px; color:var(--placeholder); font-weight:500; }
        .tag-suggest-pulse { width:10px; height:10px; background:#f97316; border-radius:50%; animation:tsPulse 1s ease-in-out infinite; }
        @keyframes tsPulse { 0%,100%{opacity:0.3;transform:scale(0.8);} 50%{opacity:1;transform:scale(1);} }
        .tag-suggest-chip { font-size:12px; font-weight:700; background:var(--card-bg); border:1px dashed rgba(249,115,22,0.4); color:#f97316; border-radius:99px; padding:4px 12px; cursor:pointer; font-family:var(--font-body); transition:all 0.2s; box-shadow:0 2px 6px var(--shadow); }
        .tag-suggest-chip:hover { background:rgba(249,115,22,0.1); border-style:solid; transform:translateY(-1px); box-shadow:0 4px 10px rgba(249,115,22,0.15); }

        .notes-sidebar { width:320px; min-width:320px; height:100vh; background:var(--card-bg); border-right:1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; z-index:10; box-shadow:8px 0 32px var(--shadow); }
        .nsb-header { padding:24px 20px 0; flex-shrink:0; display:flex; flex-direction:column; gap:16px; }
        .nsb-header-top { display:flex; align-items:center; justify-content:space-between; }
        .nsb-title { font-family:var(--font-heading); font-size:20px; font-weight:800; color:var(--text); letter-spacing:-0.5px; }
        .nsb-header-actions { display:flex; align-items:center; gap:8px; }
        .nsb-icon-btn { width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:var(--bg); border:1px solid var(--border); border-radius:10px; color:var(--muted); cursor:pointer; transition:all 0.2s; box-shadow:0 2px 8px var(--shadow); }
        .nsb-icon-btn svg { width:18px; height:18px; }
        .nsb-icon-btn:hover { border-color:rgba(249,115,22,0.4); color:#f97316; transform:translateY(-1px); box-shadow:0 4px 12px rgba(249,115,22,0.1); }
        .nsb-new-btn { display:flex; align-items:center; gap:8px; background:#f97316; color:white; border:none; border-radius:10px; padding:8px 16px; font-size:14px; font-weight:700; font-family:var(--font-heading); cursor:pointer; transition:all 0.2s cubic-bezier(0.16,1,0.3,1); box-shadow:0 4px 16px rgba(249,115,22,0.3); }
        .nsb-new-btn svg { width:16px; height:16px; }
        .nsb-new-btn:hover { background:#ea6c0a; transform:translateY(-2px); box-shadow:0 6px 20px rgba(249,115,22,0.4); }
        .nsb-search { display:flex; align-items:center; gap:10px; background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:12px 14px; transition:all 0.2s; box-shadow:0 2px 8px var(--shadow); }
        .nsb-search:focus-within { border-color:#f97316; box-shadow:0 4px 12px rgba(249,115,22,0.15); }
        .nsb-search-ico { width:16px; height:16px; color:var(--placeholder); flex-shrink:0; }
        .nsb-search input { flex:1; background:none; border:none; outline:none; font-size:14px; font-weight:500; color:var(--text); font-family:var(--font-body); }
        .nsb-search input::placeholder { color:var(--placeholder); font-weight:400; }
        .nsb-search-clear { background:none; border:none; color:var(--placeholder); cursor:pointer; font-size:12px; font-weight:700; padding:0; transition:color 0.2s; }
        .nsb-search-clear:hover { color:var(--text); }
        .nsb-tabs { display:flex; gap:4px; background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:4px; margin-bottom:4px; box-shadow:inset 0 1px 3px rgba(0,0,0,0.02); }
        .nsb-tab { flex:1; background:none; border:none; border-radius:8px; padding:8px 12px; font-size:13px; font-weight:600; color:var(--muted); cursor:pointer; font-family:var(--font-body); transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:6px; }
        .nsb-tab:hover { color:var(--text); }
        .nsb-tab.active { background:var(--card-bg); color:var(--text); box-shadow:0 2px 8px var(--shadow); font-weight:700; color:#f97316; }
        .nsb-tab-count { font-size:11px; font-weight:700; background:rgba(0,0,0,0.05); color:var(--muted); padding:2px 8px; border-radius:99px; }
        .nsb-tab.active .nsb-tab-count { background:rgba(249,115,22,0.15); color:#f97316; }
        .nsb-body { overflow-y:auto; flex-shrink:0; max-height:400px; border-bottom:1px solid var(--border); }
        .nsb-tags-body { max-height:unset; flex:1; border-bottom:none; display:flex; flex-direction:column; overflow-y:auto; }
        .nsb-section { padding:12px 12px 8px; }
        .nsb-section-label { display:flex; align-items:center; justify-content:space-between; font-size:11px; font-weight:800; font-family:var(--font-heading); color:var(--placeholder); text-transform:uppercase; letter-spacing:1px; padding:6px 10px 10px; }
        .nsb-tag-count-label { font-size:11px; color:var(--placeholder); font-weight:600; text-transform:none; letter-spacing:0; font-family:var(--font-body); }
        .nsb-nav-btn { display:flex; align-items:center; gap:10px; width:100%; background:none; border:none; border-radius:10px; padding:10px 12px; font-size:14px; font-weight:500; color:var(--muted); cursor:pointer; font-family:var(--font-body); transition:all 0.2s; text-align:left; }
        .nsb-nav-btn:hover { background:var(--bg); color:var(--text); }
        .nsb-nav-btn.active { background:rgba(249,115,22,0.08); color:#f97316; font-weight:700; }
        .nsb-nav-ico { width:16px; height:16px; flex-shrink:0; }
        .nsb-nav-btn span:nth-child(2) { flex:1; }
        .nsb-nav-count { font-size:11px; font-weight:700; color:var(--placeholder); margin-left:auto; background:rgba(0,0,0,0.05); padding:2px 8px; border-radius:99px; }
        .nsb-nav-btn.active .nsb-nav-count { background:rgba(249,115,22,0.15); color:#f97316; }
        .nsb-folder-btn { display:flex; align-items:center; gap:10px; width:100%; background:none; border:none; border-radius:10px; padding:10px 12px; font-size:14px; font-weight:500; color:var(--muted); cursor:pointer; font-family:var(--font-body); transition:all 0.2s; text-align:left; position:relative; }
        .nsb-folder-btn:hover { background:var(--bg); color:var(--text); }
        .nsb-folder-btn.active { background:rgba(249,115,22,0.08); color:#f97316; font-weight:700; }
        .nsb-folder-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .nsb-folder-actions { display:flex; gap:4px; opacity:0; transition:opacity 0.2s; }
        .nsb-folder-btn:hover .nsb-folder-actions { opacity:1; }
        .nsb-folder-action { background:var(--card-bg); box-shadow:0 2px 6px var(--shadow); border:1px solid var(--border); border-radius:6px; padding:4px 8px; font-size:12px; color:var(--muted); cursor:pointer; transition:all 0.2s; }
        .nsb-folder-action:hover { background:var(--bg); color:var(--text); transform:translateY(-1px); }
        .nsb-folder-action.danger:hover { color:var(--danger-text); border-color:var(--danger-border); }

        .nsb-tag-search { display:flex; align-items:center; gap:10px; background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:10px 14px; margin:16px 12px 8px; transition:all 0.2s; box-shadow:0 2px 8px var(--shadow); }
        .nsb-tag-search:focus-within { border-color:#f97316; box-shadow:0 4px 12px rgba(249,115,22,0.15); }
        .nsb-tag-search input { flex:1; background:none; border:none; outline:none; font-size:14px; font-weight:500; color:var(--text); font-family:var(--font-body); }
        .nsb-tag-search input::placeholder { color:var(--placeholder); font-weight:400; }
        .nsb-active-tag-row { display:flex; align-items:center; gap:8px; padding:6px 20px 12px; font-size:12px; font-weight:600; color:var(--muted); flex-shrink:0; }
        .nsb-tag-clear-btn { background:var(--bg); border:1px solid var(--border); border-radius:6px; padding:4px 8px; font-size:11px; font-weight:700; color:var(--muted); cursor:pointer; font-family:var(--font-body); transition:all 0.2s; margin-left:auto; box-shadow:0 2px 4px var(--shadow); }
        .nsb-tag-clear-btn:hover { color:var(--danger-text); border-color:var(--danger-border); transform:translateY(-1px); }
        .nsb-tag-row { display:flex; align-items:center; gap:10px; width:100%; background:none; border:none; border-radius:10px; padding:10px 12px; font-size:14px; font-weight:500; color:var(--muted); cursor:pointer; font-family:var(--font-body); transition:all 0.2s; text-align:left; }
        .nsb-tag-row:hover { background:var(--bg); color:var(--text); }
        .nsb-tag-row.active { background:rgba(249,115,22,0.08); color:#f97316; font-weight:700; }
        .nsb-tag-label { flex:1; }
        .nsb-tag-no-results { font-size:13px; font-weight:500; color:var(--placeholder); padding:20px; text-align:center; }
        .nsb-empty-tags { padding:32px 20px; text-align:center; display:flex; flex-direction:column; gap:8px; align-items:center; }
        .nsb-empty-tags p { font-family:var(--font-heading); font-size:16px; font-weight:800; color:var(--text); margin:0; }
        .nsb-empty-tags span { font-size:13px; color:var(--muted); line-height:1.6; font-weight:500; }

        .sidebar-tag-btn { display:flex; align-items:center; gap:10px; width:100%; background:none; border:none; border-radius:10px; padding:8px 12px; font-size:14px; font-weight:500; color:var(--muted); cursor:pointer; font-family:var(--font-body); transition:all 0.2s; text-align:left; }
        .sidebar-tag-btn:hover { background:var(--bg); color:var(--text); }
        .sidebar-tag-btn.active { color:#f97316; font-weight:700; background:rgba(249,115,22,0.08); }
        .sidebar-tag-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .sidebar-tag-name { flex:1; }
        .sidebar-tag-expand { font-size:12px; font-weight:700; color:var(--placeholder); padding:0 4px; line-height:1; }
        .sidebar-tag-count { font-size:11px; font-weight:700; color:var(--placeholder); }

        .nsb-list { flex:1; overflow-y:auto; padding:12px 12px 24px; min-height:0; }
        .nsb-list-group { margin-bottom:8px; }
        .nsb-list-section { font-family:var(--font-heading); font-size:11px; font-weight:800; color:var(--placeholder); text-transform:uppercase; letter-spacing:1px; padding:12px 10px 8px; }
        .nsb-list-empty { padding:32px 16px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px; font-size:14px; font-weight:500; color:var(--muted); }
        .nsb-empty-new { background:var(--card-bg); box-shadow:0 4px 12px var(--shadow); border:1px solid var(--border); border-radius:10px; padding:10px 20px; font-size:13px; font-weight:700; color:var(--text); cursor:pointer; font-family:var(--font-body); transition:all 0.2s; }
        .nsb-empty-new:hover { border-color:#f97316; color:#f97316; transform:translateY(-1px); }

        .nl-item { border-radius:12px; padding:14px; cursor:pointer; transition:all 0.2s; margin-bottom:4px; border:1px solid transparent; }
        .nl-item:hover { background:var(--bg); border-color:var(--border); box-shadow:0 4px 12px var(--shadow); transform:translateY(-1px); }
        .nl-item.selected { background:rgba(249,115,22,0.05); border-color:rgba(249,115,22,0.2); box-shadow:0 4px 12px rgba(249,115,22,0.1); }
        .nl-item.pinned { border-left:3px solid #f97316; padding-left:11px; }
        .nl-item-main { display:flex; flex-direction:column; gap:6px; }
        .nl-item-top { display:flex; align-items:center; gap:8px; }
        .nl-pin-dot { width:6px; height:6px; border-radius:50%; background:#f97316; flex-shrink:0; }
        .nl-item-title { font-family:var(--font-heading); font-size:15px; font-weight:700; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; line-height:1.3; }
        .nl-item.selected .nl-item-title { color:#f97316; }
        .nl-item-tags { display:flex; gap:6px; flex-wrap:wrap; }
        .nl-tag-more { font-size:11px; font-weight:600; color:var(--placeholder); }
        .nl-item-time { font-size:11px; font-weight:600; color:var(--placeholder); margin-top:2px; }

        .notes-main { flex:1; min-width:0; display:flex; flex-direction:column; height:100vh; overflow:hidden; background:var(--bg); position:relative; }
        .notes-empty-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; color:var(--muted); text-align:center; padding:60px; }
        .notes-empty-icon svg { width:72px; height:72px; opacity:0.8; }
        .notes-empty-state h2 { font-family:var(--font-heading); font-size:26px; font-weight:800; color:var(--text); margin:0; letter-spacing:-0.5px; }
        .notes-empty-state p { font-size:15px; font-weight:500; color:var(--muted); margin:0; }
        .notes-empty-btn { display:flex; align-items:center; gap:10px; background:#f97316; color:white; border:none; border-radius:12px; padding:14px 28px; font-size:15px; font-weight:700; font-family:var(--font-heading); cursor:pointer; transition:all 0.2s cubic-bezier(0.16,1,0.3,1); box-shadow:0 8px 24px rgba(249,115,22,0.3); margin-top:8px; }
        .notes-empty-btn svg { width:18px; height:18px; }
        .notes-empty-btn:hover { background:#ea6c0a; transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,0.4); }

        .ne-root { display:flex; flex-direction:column; height:100%; overflow:hidden; }
        .ne-toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px 32px; border-bottom:1px solid var(--border); flex-shrink:0; background:var(--card-bg); box-shadow:0 4px 24px var(--shadow); z-index:5; }
        .ne-toolbar-left { flex:1; min-width:0; }
        .ne-toolbar-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .ne-title { font-family:var(--font-heading); font-size:28px; font-weight:800; color:var(--text); margin:0; letter-spacing:-0.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ne-title-input { font-family:var(--font-heading); font-size:28px; font-weight:800; color:var(--text); background:none; border:none; outline:none; width:100%; letter-spacing:-0.5px; }
        .ne-status { font-family:var(--font-heading); font-size:12px; padding:6px 14px; border-radius:99px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; }
        .ne-status.saving { color:var(--muted); background:var(--bg); border:1px solid var(--border); }
        .ne-status.saved { color:#16a34a; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2); }
        .ne-tool-btn { width:40px; height:40px; display:flex; align-items:center; justify-content:center; background:var(--bg); border:1px solid var(--border); border-radius:10px; color:var(--muted); cursor:pointer; transition:all 0.2s; box-shadow:0 2px 8px var(--shadow); }
        .ne-tool-btn svg { width:18px; height:18px; }
        .ne-tool-btn:hover { border-color:rgba(249,115,22,0.4); color:#f97316; transform:translateY(-1px); box-shadow:0 4px 12px rgba(249,115,22,0.1); }
        .ne-tool-btn.pinned { border-color:#f97316; color:#f97316; background:rgba(249,115,22,0.05); }
        .ne-tool-btn.danger:hover { border-color:var(--danger-border); color:var(--danger-text); background:var(--danger-bg); }
        .ne-mode-toggle { display:flex; background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:4px; box-shadow:inset 0 1px 3px rgba(0,0,0,0.02); }
        .ne-mode-btn { background:none; border:none; border-radius:6px; padding:6px 16px; font-size:13px; font-weight:600; color:var(--muted); cursor:pointer; font-family:var(--font-body); transition:all 0.2s; }
        .ne-mode-btn.active { background:var(--card-bg); color:var(--text); box-shadow:0 2px 8px var(--shadow); font-weight:700; color:#f97316; }
        .ne-tags-bar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 32px; border-bottom:1px solid var(--border); flex-shrink:0; background:var(--card-bg); z-index:4; }
        .ne-tags-left { flex:1; min-width:0; display:flex; align-items:center; }
        .ne-tags-edit-wrap { display:flex; align-items:center; gap:10px; width:100%; }
        .ne-tags-input { flex:1; background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:8px 16px; font-size:13px; font-weight:500; color:var(--text); font-family:var(--font-body); transition:all 0.2s; box-shadow:inset 0 2px 6px rgba(0,0,0,0.02); outline:none; }
        .ne-tags-input:focus { border-color:#f97316; box-shadow:0 0 0 3px rgba(249,115,22,0.15), inset 0 2px 6px rgba(0,0,0,0.02); }
        .ne-tags-input::placeholder { color:var(--placeholder); font-weight:400; }
        .ne-tags-display { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .ne-add-tags-btn { background:var(--bg); border:1px dashed var(--border); border-radius:99px; padding:6px 14px; font-size:12px; font-weight:700; color:var(--muted); cursor:pointer; font-family:var(--font-heading); transition:all 0.2s; box-shadow:0 2px 6px var(--shadow); }
        .ne-add-tags-btn:hover { border-color:#f97316; color:#f97316; transform:translateY(-1px); box-shadow:0 4px 10px rgba(249,115,22,0.1); }
        .ne-meta { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:var(--placeholder); flex-shrink:0; white-space:nowrap; font-family:var(--font-body); }
        .ne-meta-dot { color:var(--border); }
        .ne-shortcut { background:var(--bg); border:1px solid var(--border); border-radius:6px; padding:2px 8px; font-size:11px; font-family:var(--font-heading); font-weight:800; color:var(--muted); }
        .ne-content { flex:1; overflow:hidden; display:flex; flex-direction:column; background:var(--bg); }
        .ne-textarea { flex:1; width:100%; height:100%; background:none; border:none; outline:none; padding:48px 60px; font-size:16px; color:var(--text); font-family:'JetBrains Mono','Courier New',monospace; line-height:2; resize:none; box-sizing:border-box; overflow-y:auto; }
        .ne-textarea::placeholder { color:var(--placeholder); line-height:2; }
        .ne-preview { flex:1; overflow-y:auto; padding:48px 60px; font-size:16px; color:var(--text); line-height:1.8; max-width:840px; margin:0 auto; width:100%; }
        .ne-preview p { margin:0 0 18px; font-weight:400; } .ne-preview p:last-child { margin:0; }
        .ne-preview h1 { font-family:var(--font-heading); font-size:36px; font-weight:800; color:var(--text); margin:40px 0 20px; letter-spacing:-1px; padding-bottom:12px; border-bottom:2px solid var(--border); }
        .ne-preview h2 { font-family:var(--font-heading); font-size:28px; font-weight:800; color:var(--text); margin:32px 0 16px; letter-spacing:-0.5px; }
        .ne-preview h3 { font-family:var(--font-heading); font-size:22px; font-weight:700; color:var(--text); margin:24px 0 12px; }
        .ne-preview ul, .ne-preview ol { padding-left:32px; margin:16px 0; }
        .ne-preview li { margin-bottom:8px; line-height:1.8; }
        .ne-preview code { background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:4px 8px; font-size:14px; color:#f97316; font-family:'JetBrains Mono',monospace; box-shadow:0 2px 6px var(--shadow); }
        .ne-preview pre { background:var(--card-bg); border:1px solid var(--border); border-radius:24px; padding:32px; box-shadow:0 12px 32px var(--shadow); transition:transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s cubic-bezier(0.16,1,0.3,1); overflow-x:auto; margin:24px 0; }
        .ne-preview pre:hover { box-shadow:0 16px 40px var(--shadow); }
        .ne-preview pre code { background:none; border:none; padding:0; color:var(--text); font-size:14px; box-shadow:none; }
        .ne-preview strong { font-weight:700; color:var(--text); } .ne-preview em { font-style:italic; color:var(--muted); }
        .ne-preview blockquote { border-left:4px solid #f97316; padding-left:24px; margin:24px 0; color:var(--muted); font-style:italic; background:rgba(249,115,22,0.05); padding:16px 24px; border-radius:0 16px 16px 0; }
        .ne-preview a { color:#f97316; text-decoration:underline; font-weight:600; text-underline-offset:2px; }
        .ne-preview a:hover { color:#ea6c0a; }
        .ne-preview hr { border:none; border-top:2px solid var(--border); margin:32px 0; }
        .ne-preview table { width:100%; border-collapse:separate; border-spacing:0; border:1px solid var(--border); border-radius:16px; overflow:hidden; margin:24px 0; background:var(--card-bg); box-shadow:0 8px 24px var(--shadow); }
        .ne-preview th, .ne-preview td { border-bottom:1px solid var(--border); border-right:1px solid var(--border); padding:14px 20px; font-size:14px; }
        .ne-preview th:last-child, .ne-preview td:last-child { border-right:none; }
        .ne-preview tr:last-child td { border-bottom:none; }
        .ne-preview th { background:var(--bg); font-family:var(--font-heading); font-weight:800; font-size:14px; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted); text-align:left; }
        .ne-preview input[type="checkbox"] { margin-right:8px; accent-color:#f97316; width:16px; height:16px; }
        .ne-blank { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:16px; color:var(--muted); text-align:center; }
        .ne-blank-icon { font-size:56px; color:var(--border); }
        .ne-blank p { font-size:16px; font-weight:500; margin:0; }
        .ne-blank-btn { background:var(--card-bg); border:1px dashed var(--border); border-radius:12px; padding:12px 24px; font-size:14px; font-weight:600; color:var(--muted); cursor:pointer; font-family:var(--font-body); transition:all 0.2s; box-shadow:0 4px 12px var(--shadow); }
        .ne-blank-btn:hover { border-color:#f97316; color:#f97316; transform:translateY(-1px); box-shadow:0 6px 16px rgba(249,115,22,0.1); }

        .ctx-menu { position:fixed; z-index:9999; background:var(--card-bg); border:1px solid var(--border); border-radius:16px; padding:8px; box-shadow:0 24px 80px rgba(0,0,0,0.3); min-width:220px; animation:nSlideDown 0.2s cubic-bezier(0.16,1,0.3,1); }
        .ctx-section-label { font-family:var(--font-heading); font-size:11px; font-weight:800; color:var(--placeholder); text-transform:uppercase; letter-spacing:1px; padding:10px 12px 6px; }
        .ctx-item { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:10px; font-size:14px; font-weight:600; color:var(--text); cursor:pointer; transition:all 0.15s; font-family:var(--font-body); }
        .ctx-item:hover { background:var(--bg); color:#f97316; }
        .ctx-item.danger:hover { background:var(--danger-bg); color:var(--danger-text); }
        .ctx-icon { font-size:16px; width:20px; text-align:center; opacity:0.8; }
        .ctx-check { margin-left:auto; font-size:12px; color:#f97316; font-weight:800; }
        .ctx-divider { height:1px; background:var(--border); margin:6px 0; }

        .notes-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:1000; padding:24px; }
        .notes-modal { background:var(--card-bg); border:1px solid var(--border); border-radius:32px; padding:48px; width:100%; max-width:520px; box-shadow: 0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px var(--border); animation:nSlideDown 0.4s cubic-bezier(0.16,1,0.3,1); }
        .notes-modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:32px; }
        .notes-modal-header h2 { font-family:var(--font-heading); font-size:28px; font-weight:800; color:var(--text); letter-spacing:-0.5px; margin:0; }
        .notes-modal-close { background:var(--bg); border:1px solid var(--border); color:var(--muted); font-size:18px; font-weight:700; cursor:pointer; padding:8px 12px; border-radius:12px; transition:all 0.2s; box-shadow:0 2px 8px var(--shadow); }
        .notes-modal-close:hover { background:var(--hover-bg); color:var(--text); border-color:var(--muted); transform:translateY(-2px); }
        .notes-modal-form { display:flex; flex-direction:column; gap:24px; }
        .nf { display:flex; flex-direction:column; gap:10px; }
        .nf label { font-family:var(--font-heading); font-size:14px; font-weight:800; color:var(--text); text-transform:uppercase; letter-spacing:0.5px; }
        .nf-opt { font-weight:500; font-family:var(--font-body); color:var(--placeholder); text-transform:none; font-size:13px; letter-spacing:0; }
        .nf input, .nf select { background:var(--input-bg); border:2px solid var(--border); border-radius:16px; padding:16px 20px; font-size:16px; font-weight:500; color:var(--text); font-family:var(--font-body); outline:none; transition:all 0.2s; box-shadow:inset 0 2px 6px var(--shadow); }
        .nf input:focus, .nf select:focus { border-color:#f97316; background:var(--bg); box-shadow:0 0 0 4px rgba(249,115,22,0.15), inset 0 2px 6px rgba(0,0,0,0.02); }
        .nf select option { background:var(--card-bg); font-weight:500; }
        .nf-tag-suggest-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:-6px; }
        .nf-tag-suggest-label { font-size:12px; color:var(--muted); font-weight:700; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.5px; }
        .nf-tag-suggest-loading { font-size:13px; color:var(--placeholder); font-weight:500; }
        .nf-tag-suggest-chip { background:var(--card-bg); border:1px dashed rgba(249,115,22,0.4); color:#f97316; border-radius:99px; padding:6px 14px; font-size:12px; font-weight:700; cursor:pointer; font-family:var(--font-body); transition:all 0.2s; box-shadow:0 2px 6px var(--shadow); }
        .nf-tag-suggest-chip:hover { background:rgba(249,115,22,0.1); border-style:solid; transform:translateY(-1px); box-shadow:0 4px 10px rgba(249,115,22,0.15); }
        .nf-error { font-size:14px; font-weight:600; color:var(--danger-text); background:var(--danger-bg); border-radius:12px; padding:12px 16px; border:1px solid rgba(239,68,68,0.2); }
        .nf-submit { background:#f97316; color:white; border:none; border-radius:16px; padding:16px; font-size:16px; font-weight:700; font-family:var(--font-heading); cursor:pointer; transition:all 0.2s cubic-bezier(0.16,1,0.3,1); display:flex; align-items:center; justify-content:center; min-height:56px; box-shadow:0 8px 24px rgba(249,115,22,0.3); margin-top:8px; }
        .nf-submit:hover:not(:disabled) { background:#ea6c0a; transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,0.4); }
        .nf-submit:disabled { opacity:0.7; cursor:not-allowed; transform:none; box-shadow:none; }
        .nf-spinner { width:20px; height:20px; border:3px solid rgba(255,255,255,0.3); border-top-color:white; border-radius:50%; animation:nSpin 0.7s linear infinite; display:inline-block; }

        @keyframes nSlideDown { from{opacity:0;transform:translateY(24px) scale(0.98);} to{opacity:1;transform:translateY(0) scale(1);} }
      `}</style>
    </div>
  );
}
