import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';

const TYPE_META = {
    github_pr: { icon: '⬡', label: 'GitHub PR', color: '#22c55e' },
    github_commit: { icon: '⬡', label: 'GitHub Commit', color: '#22c55e' },
    github_issue: { icon: '⬡', label: 'GitHub Issue', color: '#22c55e' },
    github_repo: { icon: '⬡', label: 'GitHub Repo', color: '#22c55e' },
    youtube: { icon: '▶', label: 'YouTube Video', color: '#ef4444' },
    leetcode: { icon: '◎', label: 'LeetCode', color: '#f59e0b' },
    course: { icon: '◈', label: 'Course', color: '#a855f7' },
    article: { icon: '◇', label: 'Article', color: '#3b82f6' },
    docs: { icon: '⊞', label: 'Documentation', color: '#14b8a6' },
    stackoverflow: { icon: '⊟', label: 'Stack Overflow', color: '#f97316' },
    generic: { icon: '⊞', label: 'Resource', color: '#6b7280' },
};

const DIFF_COLORS = {
    Easy: '#22c55e',
    Medium: '#f59e0b',
    Hard: '#ef4444',
};

export default function QuickCapture({ topics, onClose, onSaved }) {
    const [step, setStep] = useState('paste');   // 'paste' | 'loading' | 'confirm'
    const [url, setUrl] = useState('');
    const [captured, setCaptured] = useState(null);
    const [error, setError] = useState('');

    // Confirm form state
    const [form, setForm] = useState({
        topic_id: '',
        time_spent: '',
        notes: '',
        date: new Date().toISOString().split('T')[0],
    });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (step === 'paste') setTimeout(() => inputRef.current?.focus(), 80);
    }, [step]);

    // Auto-paste from clipboard on open
    useEffect(() => {
        navigator.clipboard?.readText?.().then(text => {
            if (text?.startsWith('http')) setUrl(text.trim());
        }).catch(() => { });
    }, []);

    const analyze = async () => {
        if (!url.trim()) return;
        setStep('loading');
        setError('');
        try {
            const res = await api.post('/capture/analyze', { url: url.trim() });
            const data = res.data;
            setCaptured(data);
            setForm(f => ({
                ...f,
                topic_id: data.suggested_topic_id || '',
                time_spent: data.suggested_minutes || '',
                notes: buildDefaultNote(data),
            }));
            setStep('confirm');
        } catch (err) {
            setError(err.response?.data?.detail || 'Could not analyze this URL. Try a different one.');
            setStep('paste');
        }
    };

    const buildDefaultNote = (data) => {
        const parts = [];
        if (data.capture_type === 'github_pr') {
            parts.push(`Reviewed PR: **${data.title}**`);
            if (data.metadata?.repo) parts.push(`Repo: \`${data.metadata.repo}\``);
            if (data.metadata?.files_changed) parts.push(`Files changed: ${data.metadata.files_changed}`);
        } else if (data.capture_type === 'github_commit') {
            parts.push(`Studied commit: **${data.title}**`);
            if (data.metadata?.repo) parts.push(`Repo: \`${data.metadata.repo}\``);
        } else if (data.capture_type === 'youtube') {
            parts.push(`Watched: **${data.title}**`);
        } else if (data.capture_type === 'leetcode') {
            const diff = data.metadata?.difficulty;
            parts.push(`Solved: **${data.title}**${diff ? ` (${diff})` : ''}`);
        } else if (data.capture_type === 'article') {
            parts.push(`Read: **${data.title}**`);
        } else if (data.capture_type === 'course') {
            parts.push(`Completed lesson: **${data.title}**`);
        } else {
            parts.push(`Studied: **${data.title}**`);
        }
        parts.push('');
        parts.push(`[Source](${data.url})`);
        return parts.join('\n');
    };

    const save = async (e) => {
        e.preventDefault();
        if (!form.topic_id) {
            setSaveError('Please select a topic before saving.');
            return;
        }
        setSaving(true);
        setSaveError('');
        try {
            await api.post('/logs/', {
                topic_id: form.topic_id ? parseInt(form.topic_id) : null,
                time_spent: form.time_spent ? parseInt(form.time_spent) : 1,
                notes: form.notes,
                date: form.date,
            });
            // Also save as resource if it has a URL
            if (captured?.url && form.topic_id) {
                try {
                    await api.post('/resources/', {
                        title: captured.title,
                        url: captured.url,
                        resource_type: mapTypeToResource(captured.capture_type),
                        topic_id: parseInt(form.topic_id),
                    });
                } catch (_) { /* resource save is best-effort */ }
            }
            onSaved();
            onClose();
        } catch (err) {
            setSaveError(err.response?.data?.detail || 'Failed to save log');
        } finally {
            setSaving(false);
        }
    };

    const mapTypeToResource = (type) => {
        const map = {
            youtube: 'video', github_pr: 'docs', github_commit: 'docs',
            github_repo: 'docs', leetcode: 'other', course: 'course',
            article: 'article', docs: 'docs',
        };
        return map[type] || 'other';
    };

    const typeMeta = captured ? (TYPE_META[captured.capture_type] || TYPE_META.generic) : null;

    return createPortal(
        <div className="qc-overlay" onClick={onClose}>
            <div className="qc-modal" onClick={e => e.stopPropagation()}>

                {/* ── Step 1: Paste URL ── */}
                {(step === 'paste' || step === 'loading') && (
                    <>
                        <div className="qc-header">
                            <div className="qc-header-left">
                                <span className="qc-icon">⚡</span>
                                <div>
                                    <h2 className="qc-title">Quick Capture</h2>
                                    <p className="qc-sub">Paste a URL and DevTrack logs it for you</p>
                                </div>
                            </div>
                            <button className="qc-close" onClick={onClose}>✕</button>
                        </div>

                        <div className="qc-paste-area">
                            <div className="qc-url-row">
                                <input
                                    ref={inputRef}
                                    className="qc-url-input"
                                    placeholder="https://github.com/... or youtube.com/... or leetcode.com/..."
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && analyze()}
                                    disabled={step === 'loading'}
                                />
                                <button
                                    className="qc-analyze-btn"
                                    onClick={analyze}
                                    disabled={!url.trim() || step === 'loading'}
                                >
                                    {step === 'loading' ? <span className="qc-spinner" /> : '→ Analyze'}
                                </button>
                            </div>

                            {error && <p className="qc-error">{error}</p>}

                            <div className="qc-supported">
                                <span className="qc-supported-label">Supports:</span>
                                {[
                                    { icon: '⬡', label: 'GitHub', color: '#22c55e' },
                                    { icon: '▶', label: 'YouTube', color: '#ef4444' },
                                    { icon: '◎', label: 'LeetCode', color: '#f59e0b' },
                                    { icon: '◈', label: 'Courses', color: '#a855f7' },
                                    { icon: '◇', label: 'Articles', color: '#3b82f6' },
                                    { icon: '⊞', label: 'Any URL', color: '#6b7280' },
                                ].map(({ icon, label, color }) => (
                                    <span key={label} className="qc-chip" style={{ '--chip-color': color }}>
                                        <span style={{ color }}>{icon}</span> {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* ── Step 2: Confirm ── */}
                {step === 'confirm' && captured && (
                    <>
                        <div className="qc-header">
                            <div className="qc-header-left">
                                <span className="qc-icon" style={{ color: typeMeta.color }}>{typeMeta.icon}</span>
                                <div>
                                    <h2 className="qc-title">Confirm log</h2>
                                    <p className="qc-sub">Review and save your learning session</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button className="qc-back-btn" onClick={() => { setStep('paste'); setCaptured(null); }}>
                                    ← Back
                                </button>
                                <button className="qc-close" onClick={onClose}>✕</button>
                            </div>
                        </div>

                        {/* Captured card */}
                        <div className="qc-captured-card">
                            <div className="qc-captured-top">
                                <span className="qc-type-badge" style={{ background: typeMeta.color + '20', color: typeMeta.color }}>
                                    {typeMeta.icon} {typeMeta.label}
                                </span>
                                {captured.metadata?.difficulty && (
                                    <span className="qc-diff-badge" style={{
                                        color: DIFF_COLORS[captured.metadata.difficulty] || '#f97316',
                                        background: (DIFF_COLORS[captured.metadata.difficulty] || '#f97316') + '20',
                                    }}>
                                        {captured.metadata.difficulty}
                                    </span>
                                )}
                            </div>
                            <p className="qc-captured-title">{captured.title}</p>
                            {captured.subtitle && <p className="qc-captured-sub">{captured.subtitle}</p>}
                            {captured.description && <p className="qc-captured-desc">{captured.description}</p>}
                            <a href={captured.url} target="_blank" rel="noopener noreferrer" className="qc-captured-url">
                                {captured.url.length > 60 ? captured.url.slice(0, 58) + '…' : captured.url} ↗
                            </a>
                        </div>

                        {/* Form */}
                        <form onSubmit={save} className="qc-form">
                            <div className="qc-form-row">
                                <div className="qc-field">
                                    <label>Topic <span style={{ color: '#ef4444' }}>*</span></label>
                                    <select
                                        value={form.topic_id}
                                        onChange={e => setForm(f => ({ ...f, topic_id: e.target.value }))}
                                        required
                                        style={!form.topic_id ? { borderColor: 'rgba(239,68,68,0.5)' } : {}}
                                    >
                                        <option value="">— Select a topic —</option>
                                        {topics.map(t => (
                                            <option key={t.id} value={t.id}>
                                                {t.id === captured.suggested_topic_id ? `✓ ${t.title}` : t.title}
                                            </option>
                                        ))}
                                    </select>
                                    {!form.topic_id && (
                                        <span className="qc-required-hint">Required to save the log</span>
                                    )}
                                    {captured.suggested_topic_title && form.topic_id && (
                                        <span className="qc-suggestion">
                                            💡 Suggested: {captured.suggested_topic_title}
                                        </span>
                                    )}
                                </div>
                                <div className="qc-field">
                                    <label>Time spent (min)</label>
                                    <input
                                        type="number"
                                        value={form.time_spent}
                                        onChange={e => setForm(f => ({ ...f, time_spent: e.target.value }))}
                                        placeholder="e.g. 30"
                                        min={1}
                                        required
                                    />
                                    {captured.suggested_minutes && (
                                        <span className="qc-suggestion">💡 Estimated: ~{captured.suggested_minutes} min</span>
                                    )}
                                </div>
                            </div>

                            <div className="qc-field">
                                <label>Date</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="qc-field">
                                <label>Takeaway / notes</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    rows={4}
                                    placeholder="What did you learn?"
                                />
                            </div>

                            {saveError && <p className="qc-error">{saveError}</p>}

                            <div className="qc-form-actions">
                                <p className="qc-save-note">
                                    {form.topic_id ? '✓ Will also save as a resource in that topic' : ''}
                                </p>
                                <button type="submit" className="qc-save-btn" disabled={saving || !form.topic_id}>
                                    {saving ? <span className="qc-spinner" /> : '⚡ Save log'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>

            <style>{`
        .qc-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: qcFade 0.2s ease;
        }

        @keyframes qcFade { from{opacity:0} to{opacity:1} }

        .qc-modal {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 20px; width: 100%; max-width: 540px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.4);
          animation: qcSlide 0.3s cubic-bezier(0.16,1,0.3,1);
          overflow: hidden;
        }

        @keyframes qcSlide {
          from{opacity:0;transform:translateY(20px) scale(0.98)}
          to  {opacity:1;transform:translateY(0)    scale(1)}
        }

        .qc-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 22px 24px 16px; border-bottom: 1px solid var(--border);
        }

        .qc-header-left { display: flex; align-items: center; gap: 14px; }

        .qc-icon {
          font-size: 28px; line-height: 1;
          color: #f97316;
        }

        .qc-title {
          font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700;
          color: var(--text); margin: 0 0 3px;
        }

        .qc-sub { font-size: 12px; color: var(--muted); margin: 0; }

        .qc-close {
          background: none; border: none; color: var(--muted);
          font-size: 16px; cursor: pointer; padding: 4px 8px;
          border-radius: 6px; transition: all 0.15s;
        }

        .qc-close:hover { background: var(--hover-bg); color: var(--text); }

        .qc-back-btn {
          background: none; border: 1px solid var(--border); border-radius: 8px;
          padding: 5px 12px; font-size: 13px; color: var(--muted);
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }

        .qc-back-btn:hover { border-color: var(--muted); color: var(--text); }

        /* Paste step */
        .qc-paste-area { padding: 24px; display: flex; flex-direction: column; gap: 16px; }

        .qc-url-row { display: flex; gap: 10px; }

        .qc-url-input {
          flex: 1; background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: 12px 16px; font-size: 14px; color: var(--text);
          font-family: 'DM Sans', sans-serif; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .qc-url-input:focus {
          border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .qc-url-input:disabled { opacity: 0.6; }

        .qc-analyze-btn {
          background: #f97316; color: white; border: none;
          border-radius: 10px; padding: 12px 20px; font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s;
          white-space: nowrap; box-shadow: 0 4px 14px rgba(249,115,22,0.3);
          display: flex; align-items: center; gap: 8px; min-width: 120px;
          justify-content: center;
        }

        .qc-analyze-btn:hover:not(:disabled) { background: #ea6c0a; transform: translateY(-1px); }
        .qc-analyze-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .qc-supported {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }

        .qc-supported-label { font-size: 11px; color: var(--placeholder); }

        .qc-chip {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 500; color: var(--muted);
          background: var(--bg); border: 1px solid var(--border);
          border-radius: 99px; padding: 3px 10px;
        }

        /* Captured card */
        .qc-captured-card {
          margin: 0 24px 0; padding: 16px;
          background: var(--bg); border: 1px solid var(--border);
          border-radius: 12px; display: flex; flex-direction: column; gap: 6px;
        }

        .qc-captured-top { display: flex; align-items: center; gap: 8px; }

        .qc-type-badge, .qc-diff-badge {
          font-size: 11px; font-weight: 700; padding: 3px 10px;
          border-radius: 99px; text-transform: uppercase; letter-spacing: 0.3px;
        }

        .qc-captured-title {
          font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700;
          color: var(--text); margin: 0;
        }

        .qc-captured-sub { font-size: 12px; color: var(--muted); margin: 0; }

        .qc-captured-desc {
          font-size: 12px; color: var(--muted); margin: 0; line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .qc-captured-url {
          font-size: 11px; color: #f97316; text-decoration: none;
          transition: opacity 0.15s; word-break: break-all;
        }

        .qc-captured-url:hover { opacity: 0.75; }

        /* Form */
        .qc-form { padding: 16px 24px 24px; display: flex; flex-direction: column; gap: 14px; }

        .qc-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        .qc-field { display: flex; flex-direction: column; gap: 6px; }

        .qc-field label { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; }

        .qc-field input, .qc-field select, .qc-field textarea {
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: 10px 14px;
          font-size: 14px; color: var(--text); font-family: 'DM Sans', sans-serif;
          outline: none; resize: vertical;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .qc-field input:focus, .qc-field select:focus, .qc-field textarea:focus {
          border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .qc-field select option { background: var(--card-bg); }

        .qc-suggestion {
          font-size: 11px; color: #f97316; font-weight: 500;
        }

        .qc-error {
          font-size: 13px; color: var(--danger-text);
          background: var(--danger-bg); border-radius: 8px; padding: 10px 14px;
        }

        .qc-form-actions {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }

        .qc-save-note { font-size: 11px; color: #22c55e; margin: 0; flex: 1; }

        .qc-save-btn {
          background: #f97316; color: white; border: none;
          border-radius: 10px; padding: 12px 24px; font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 8px; min-width: 140px;
          justify-content: center; box-shadow: 0 4px 14px rgba(249,115,22,0.3);
        }

        .qc-save-btn:hover:not(:disabled) { background: #ea6c0a; transform: translateY(-1px); }
        .qc-save-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

        .qc-required-hint {
          font-size: 11px; color: #ef4444; font-weight: 500;
        }

        .qc-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
          border-radius: 50%; animation: qcSpin 0.7s linear infinite; display: inline-block;
        }

        @keyframes qcSpin { to { transform: rotate(360deg); } }
      `}</style>
        </div>,
        document.body
    );
}