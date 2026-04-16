import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api/axios';

const PRESETS = [
    { label: '25 min', value: 25, desc: 'Pomodoro' },
    { label: '50 min', value: 50, desc: 'Deep work' },
    { label: '90 min', value: 90, desc: 'Flow state' },
];

// ─── Circular progress ring ───────────────────────────────────────────────────

function Ring({ progress, size = 220, stroke = 8, color = '#f97316' }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - progress);
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="var(--border)" strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={color} strokeWidth={stroke}
                strokeDasharray={c} strokeDashoffset={off}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
        </svg>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudySession({ topics, initialTopicId, onClose, onLogSaved }) {
    // ── Stages: setup → running → done → debrief → summary → saving → saved
    const [stage, setStage] = useState('setup');
    const [topicId, setTopicId] = useState(initialTopicId || (topics[0]?.id ?? ''));
    const [duration, setDuration] = useState(25);    // minutes
    const [custom, setCustom] = useState('');
    const [useCustom, setUseCustom] = useState(false);

    // Timer state
    const [totalSecs, setTotalSecs] = useState(0);
    const [remaining, setRemaining] = useState(0);
    const [paused, setPaused] = useState(false);
    const intervalRef = useRef(null);

    // Debrief
    const [brainDump, setBrainDump] = useState('');

    // AI result
    const [aiResult, setAiResult] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');

    // Edited log before saving
    const [editedLog, setEditedLog] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const actualDuration = useCustom ? parseInt(custom) || 25 : duration;
    const topic = topics.find(t => t.id === parseInt(topicId));

    // ── Escape key closes setup stage ────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape' && stage === 'setup') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [stage, onClose]);

    // ── Timer logic ───────────────────────────────────────────────────────────
    const startTimer = useCallback(() => {
        const secs = actualDuration * 60;
        setTotalSecs(secs);
        setRemaining(secs);
        setStage('running');
        setPaused(false);
    }, [actualDuration]);

    useEffect(() => {
        if (stage !== 'running' || paused) {
            clearInterval(intervalRef.current);
            return;
        }
        intervalRef.current = setInterval(() => {
            setRemaining(r => {
                if (r <= 1) {
                    clearInterval(intervalRef.current);
                    setStage('done');
                    // Play a subtle done sound via Web Audio API
                    try {
                        const ctx = new (window.AudioContext || window.webkitAudioContext)();
                        [0, 200, 400].forEach(delay => {
                            const osc = ctx.createOscillator();
                            const gain = ctx.createGain();
                            osc.connect(gain); gain.connect(ctx.destination);
                            osc.frequency.value = delay === 0 ? 523 : delay === 200 ? 659 : 784;
                            gain.gain.setValueAtTime(0.15, ctx.currentTime + delay / 1000);
                            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.6);
                            osc.start(ctx.currentTime + delay / 1000);
                            osc.stop(ctx.currentTime + delay / 1000 + 0.6);
                        });
                    } catch (_) { }
                    return 0;
                }
                return r - 1;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, [stage, paused]);

    // Auto-advance from done → debrief after 2.5s
    useEffect(() => {
        if (stage !== 'done') return;
        const t = setTimeout(() => setStage('debrief'), 2500);
        return () => clearTimeout(t);
    }, [stage]);

    // ── AI summarize ──────────────────────────────────────────────────────────
    const summarize = useCallback(async () => {
        setAiLoading(true);
        setAiError('');
        setStage('summary');
        try {
            const res = await api.post('/session/summarize', {
                topic_id: parseInt(topicId),
                duration: actualDuration,
                brain_dump: brainDump,
            });
            setAiResult(res.data);
            setEditedLog(res.data.log_entry);
        } catch (err) {
            setAiError(err.response?.data?.detail || 'AI summarization failed');
        } finally {
            setAiLoading(false);
        }
    }, [topicId, actualDuration, brainDump]);

    // ── Save log ──────────────────────────────────────────────────────────────
    const saveLog = async () => {
        setSaving(true);
        setSaveError('');
        try {
            const res = await api.post('/logs/', {
                topic_id: parseInt(topicId),
                time_spent: actualDuration,
                notes: editedLog,
                date: new Date().toISOString().split('T')[0],
            });
            if (onLogSaved) onLogSaved(res.data);
            setStage('saved');
        } catch (err) {
            setSaveError(err.response?.data?.detail || 'Failed to save log');
        } finally {
            setSaving(false);
        }
    };

    // ── Timer display helpers ─────────────────────────────────────────────────
    const progress = totalSecs > 0 ? (totalSecs - remaining) / totalSecs : 0;
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');

    // ── Render ────────────────────────────────────────────────────────────────
    return createPortal(
        <div className="ss-root">

            {/* ── Setup ── */}
            {stage === 'setup' && (
                <div className="ss-setup">
                    <button className="ss-x" onClick={onClose}>✕</button>
                    <div className="ss-setup-inner">
                        <div className="ss-logo">⬡</div>
                        <h1 className="ss-setup-title">Study Session</h1>
                        <p className="ss-setup-sub">Pick your topic and duration — DevTrack handles the rest</p>

                        <div className="ss-setup-form">
                            <div className="ss-field">
                                <label>Topic</label>
                                <select value={topicId} onChange={e => setTopicId(e.target.value)}>
                                    {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                                </select>
                            </div>

                            <div className="ss-field">
                                <label>Duration</label>
                                <div className="ss-presets">
                                    {PRESETS.map(p => (
                                        <button
                                            key={p.value}
                                            className={`ss-preset ${!useCustom && duration === p.value ? 'active' : ''}`}
                                            onClick={() => { setDuration(p.value); setUseCustom(false); }}
                                        >
                                            <span className="ss-preset-label">{p.label}</span>
                                            <span className="ss-preset-desc">{p.desc}</span>
                                        </button>
                                    ))}
                                    <button
                                        className={`ss-preset ${useCustom ? 'active' : ''}`}
                                        onClick={() => setUseCustom(true)}
                                    >
                                        <span className="ss-preset-label">Custom</span>
                                        <span className="ss-preset-desc">Your own</span>
                                    </button>
                                </div>
                                {useCustom && (
                                    <div className="ss-custom-wrap">
                                        <input
                                            type="number" min={1} max={240}
                                            value={custom}
                                            onChange={e => setCustom(e.target.value)}
                                            placeholder="Minutes"
                                            autoFocus
                                        />
                                        <span className="ss-custom-label">minutes</span>
                                    </div>
                                )}
                            </div>

                            <button
                                className="ss-start-btn"
                                onClick={startTimer}
                                disabled={!topicId || (useCustom && (!custom || parseInt(custom) < 1))}
                            >
                                Start session →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Running ── */}
            {stage === 'running' && (
                <div className="ss-focus">
                    <div className="ss-focus-topic">{topic?.title}</div>

                    <div className="ss-timer-wrap">
                        <Ring progress={progress} />
                        <div className="ss-timer-center">
                            <span className="ss-time">{mm}:{ss}</span>
                            <span className="ss-time-label">remaining</span>
                        </div>
                    </div>

                    <p className="ss-focus-msg">
                        {progress < 0.3 ? 'Just getting started — find your flow' :
                            progress < 0.6 ? 'Deep work mode — stay focused' :
                                progress < 0.85 ? 'Almost there — keep pushing' :
                                    'Final stretch — finish strong!'}
                    </p>

                    <div className="ss-focus-actions">
                        <button
                            className="ss-pause-btn"
                            onClick={() => setPaused(p => !p)}
                        >
                            {paused ? '▶ Resume' : '⏸ Pause'}
                        </button>
                        <button
                            className="ss-end-btn"
                            onClick={() => { clearInterval(intervalRef.current); setStage('done'); }}
                        >
                            End early
                        </button>
                    </div>
                </div>
            )}

            {/* ── Done celebration ── */}
            {stage === 'done' && (
                <div className="ss-done">
                    <div className="ss-done-icon">🎉</div>
                    <h2 className="ss-done-title">Session complete!</h2>
                    <p className="ss-done-sub">{actualDuration} minutes on <strong>{topic?.title}</strong></p>
                    <p className="ss-done-hint">Preparing your debrief…</p>
                </div>
            )}

            {/* ── Debrief ── */}
            {stage === 'debrief' && (
                <div className="ss-debrief">
                    <button className="ss-x" onClick={onClose}>Skip & close</button>
                    <div className="ss-debrief-inner">
                        <div className="ss-debrief-header">
                            <h2 className="ss-debrief-title">What did you accomplish?</h2>
                            <p className="ss-debrief-sub">
                                Jot down anything — keywords, what you learned, what confused you.
                                AI will turn it into a polished log.
                            </p>
                        </div>
                        <textarea
                            className="ss-dump"
                            autoFocus
                            placeholder={`e.g. "Learned about Docker volumes, struggled with bind mounts, got networking working between containers"`}
                            value={brainDump}
                            onChange={e => setBrainDump(e.target.value)}
                            rows={5}
                        />
                        <div className="ss-debrief-actions">
                            <button
                                className="ss-skip-ai"
                                onClick={() => {
                                    setEditedLog(brainDump || `Studied **${topic?.title}** for ${actualDuration} minutes.`);
                                    setAiResult({ log_entry: editedLog, summary: [], next_session: '', topic_title: topic?.title });
                                    setStage('summary');
                                    setAiLoading(false);
                                }}
                            >
                                Skip AI — just save notes
                            </button>
                            <button className="ss-generate-btn" onClick={summarize}>
                                ✦ Generate with AI
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Summary / AI result ── */}
            {stage === 'summary' && (
                <div className="ss-summary">
                    <button className="ss-x" onClick={onClose}>✕</button>

                    {aiLoading ? (
                        <div className="ss-ai-loading">
                            <div className="ss-ai-orb" />
                            <p className="ss-ai-loading-text">AI is writing your log entry…</p>
                        </div>
                    ) : aiError ? (
                        <div className="ss-ai-error">
                            <p>{aiError}</p>
                            <button className="ss-generate-btn" onClick={summarize}>Retry</button>
                        </div>
                    ) : aiResult && (
                        <div className="ss-summary-inner">
                            <h2 className="ss-summary-title">Your session summary</h2>
                            <p className="ss-summary-sub">{actualDuration} min · {topic?.title}</p>

                            {/* 3-bullet summary */}
                            {aiResult.summary?.length > 0 && (
                                <div className="ss-bullets">
                                    {aiResult.summary.map((b, i) => (
                                        <div key={i} className="ss-bullet">
                                            <span className="ss-bullet-dot">{i + 1}</span>
                                            <span>{b}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Next session */}
                            {aiResult.next_session && (
                                <div className="ss-next">
                                    <span className="ss-next-label">Next session →</span>
                                    <span className="ss-next-text">{aiResult.next_session}</span>
                                </div>
                            )}

                            {/* Editable log entry */}
                            <div className="ss-log-section">
                                <div className="ss-log-header">
                                    <span className="ss-log-label">Log entry</span>
                                    <span className="ss-log-hint">Editable — tweak before saving</span>
                                </div>
                                <div className="ss-log-tabs">
                                    <LogEditor value={editedLog} onChange={setEditedLog} />
                                </div>
                            </div>

                            {saveError && <p className="ss-save-error">{saveError}</p>}

                            <div className="ss-summary-actions">
                                <button className="ss-discard-btn" onClick={onClose}>Discard</button>
                                <button
                                    className="ss-save-btn"
                                    onClick={saveLog}
                                    disabled={saving}
                                >
                                    {saving ? <span className="ss-spinner" /> : '✓ Save log'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Saved ── */}
            {stage === 'saved' && (
                <div className="ss-done">
                    <div className="ss-done-icon">✓</div>
                    <h2 className="ss-done-title">Log saved!</h2>
                    <p className="ss-done-sub">Great session on <strong>{topic?.title}</strong></p>
                    <button className="ss-start-btn" style={{ marginTop: 24 }} onClick={onClose}>
                        Done
                    </button>
                </div>
            )}

            <style>{SS_STYLES}</style>
        </div>,
        document.body
    );
}

// ─── Inline log editor with preview tab ──────────────────────────────────────

function LogEditor({ value, onChange }) {
    const [tab, setTab] = useState('edit');
    return (
        <div className="ss-editor">
            <div className="ss-editor-tabs">
                <button className={`ss-etab ${tab === 'edit' ? 'active' : ''}`} onClick={() => setTab('edit')}>Edit</button>
                <button className={`ss-etab ${tab === 'preview' ? 'active' : ''}`} onClick={() => setTab('preview')}>Preview</button>
            </div>
            {tab === 'edit' ? (
                <textarea
                    className="ss-log-textarea"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    rows={6}
                />
            ) : (
                <div className="ss-log-preview">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
                </div>
            )}
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SS_STYLES = `
  .ss-root {
    position: fixed; inset: 0; z-index: 10000;
    background: var(--bg);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-body);
    animation: ssFade 0.35s ease forwards;
  }

  @keyframes ssFade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .ss-x {
    position: absolute; top: 24px; right: 28px;
    background: none; border: 1px solid var(--border);
    border-radius: 8px; padding: 6px 14px;
    font-size: 13px; font-weight: 500; color: var(--muted);
    cursor: pointer; font-family: var(--font-body);
    transition: all 0.15s; z-index: 1;
  }

  .ss-x:hover { border-color: var(--muted); color: var(--text); }

  /* ── Setup ── */
  .ss-setup {
    width: 100%; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }

  .ss-setup-inner {
    display: flex; flex-direction: column; align-items: center;
    gap: 8px; width: 100%; max-width: 520px; padding: 0 24px;
    text-align: center;
  }

  .ss-logo {
    font-size: 40px; color: #f97316; margin-bottom: 4px;
    animation: ssPulse 2s ease-in-out infinite;
  }

  @keyframes ssPulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%       { transform: scale(1.08); opacity: 0.85; }
  }

  .ss-setup-title {
    font-family: var(--font-heading); font-size: 32px; font-weight: 800;
    color: var(--text); letter-spacing: -1px; margin: 0;
  }

  .ss-setup-sub { font-size: 14px; color: var(--muted); margin: 0 0 24px; }

  .ss-setup-form {
    width: 100%; display: flex; flex-direction: column; gap: 20px;
    background: var(--card-bg); border: 1px solid var(--border);
    border-radius: 20px; padding: 28px;
  }

  .ss-field { display: flex; flex-direction: column; gap: 8px; text-align: left; }

  .ss-field label {
    font-size: 12px; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.5px;
  }

  .ss-field select {
    background: var(--input-bg); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 14px; font-size: 15px;
    color: var(--text); font-family: var(--font-body); outline: none;
    transition: border-color 0.2s;
  }

  .ss-field select:focus { border-color: #f97316; }

  .ss-presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }

  .ss-preset {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    background: var(--input-bg); border: 1px solid var(--border);
    border-radius: 12px; padding: 12px 8px;
    cursor: pointer; font-family: var(--font-body);
    transition: all 0.15s;
  }

  .ss-preset:hover { border-color: #f97316; background: rgba(249,115,22,0.06); }

  .ss-preset.active {
    background: rgba(249,115,22,0.12); border-color: #f97316;
  }

  .ss-preset-label {
    font-size: 15px; font-weight: 700; color: var(--text);
  }

  .ss-preset.active .ss-preset-label { color: #f97316; }

  .ss-preset-desc { font-size: 10px; color: var(--muted); }

  .ss-custom-wrap {
    display: flex; align-items: center; gap: 10px; margin-top: 8px;
  }

  .ss-custom-wrap input {
    background: var(--input-bg); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 14px; font-size: 15px;
    color: var(--text); font-family: var(--font-body); outline: none;
    width: 100px; transition: border-color 0.2s;
  }

  .ss-custom-wrap input:focus { border-color: #f97316; }
  .ss-custom-label { font-size: 14px; color: var(--muted); }

  .ss-start-btn {
    background: #f97316; color: white; border: none;
    border-radius: 12px; padding: 14px;
    font-size: 16px; font-weight: 700; font-family: var(--font-body);
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 6px 24px rgba(249,115,22,0.35);
    letter-spacing: -0.3px;
  }

  .ss-start-btn:hover:not(:disabled) {
    background: #ea6c0a; transform: translateY(-2px);
    box-shadow: 0 10px 32px rgba(249,115,22,0.4);
  }

  .ss-start-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Focus / timer ── */
  .ss-focus {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 24px; width: 100%; min-height: 100vh;
    text-align: center;
  }

  .ss-focus-topic {
    font-family: var(--font-heading); font-size: 22px; font-weight: 700;
    color: #f97316; letter-spacing: -0.5px;
  }

  .ss-timer-wrap {
    position: relative; width: 220px; height: 220px;
  }

  .ss-timer-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 4px;
  }

  .ss-time {
    font-family: var(--font-heading); font-size: 52px; font-weight: 800;
    color: var(--text); letter-spacing: -2px; line-height: 1;
  }

  .ss-time-label { font-size: 12px; color: var(--muted); font-weight: 500; }

  .ss-focus-msg {
    font-size: 15px; color: var(--muted); max-width: 340px; margin: 0;
    font-style: italic;
  }

  .ss-focus-actions { display: flex; gap: 12px; }

  .ss-pause-btn {
    background: var(--card-bg); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 28px;
    font-size: 15px; font-weight: 600; color: var(--text);
    cursor: pointer; font-family: var(--font-body);
    transition: all 0.15s;
  }

  .ss-pause-btn:hover { border-color: #f97316; color: #f97316; }

  .ss-end-btn {
    background: none; border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 24px;
    font-size: 14px; color: var(--muted);
    cursor: pointer; font-family: var(--font-body);
    transition: all 0.15s;
  }

  .ss-end-btn:hover { border-color: var(--danger-text); color: var(--danger-text); }

  /* ── Done ── */
  .ss-done {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px; min-height: 100vh;
    text-align: center;
    animation: ssBounce 0.5s cubic-bezier(0.16,1,0.3,1);
  }

  @keyframes ssBounce {
    from { transform: scale(0.8); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  .ss-done-icon { font-size: 72px; }

  .ss-done-title {
    font-family: var(--font-heading); font-size: 36px; font-weight: 800;
    color: var(--text); letter-spacing: -1px; margin: 0;
  }

  .ss-done-sub { font-size: 16px; color: var(--muted); margin: 0; }
  .ss-done-hint { font-size: 13px; color: var(--placeholder); margin: 0; }

  /* ── Debrief ── */
  .ss-debrief {
    width: 100%; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }

  .ss-debrief-inner {
    width: 100%; max-width: 600px; padding: 0 24px;
    display: flex; flex-direction: column; gap: 20px;
  }

  .ss-debrief-header { display: flex; flex-direction: column; gap: 8px; }

  .ss-debrief-title {
    font-family: var(--font-heading); font-size: 28px; font-weight: 800;
    color: var(--text); letter-spacing: -0.5px; margin: 0;
  }

  .ss-debrief-sub {
    font-size: 14px; color: var(--muted); line-height: 1.6; margin: 0;
  }

  .ss-dump {
    background: var(--card-bg); border: 1px solid var(--border);
    border-radius: 14px; padding: 16px 18px;
    font-size: 15px; color: var(--text);
    font-family: var(--font-body); outline: none; resize: vertical;
    line-height: 1.7; transition: border-color 0.2s, box-shadow 0.2s;
  }

  .ss-dump:focus {
    border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
  }

  .ss-dump::placeholder { color: var(--placeholder); }

  .ss-debrief-actions { display: flex; gap: 12px; justify-content: flex-end; }

  .ss-skip-ai {
    background: none; border: 1px solid var(--border); border-radius: 10px;
    padding: 12px 20px; font-size: 14px; color: var(--muted);
    cursor: pointer; font-family: var(--font-body); transition: all 0.15s;
  }

  .ss-skip-ai:hover { border-color: var(--muted); color: var(--text); }

  .ss-generate-btn {
    background: #f97316; color: white; border: none;
    border-radius: 10px; padding: 12px 24px;
    font-size: 14px; font-weight: 700; font-family: var(--font-body);
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 4px 16px rgba(249,115,22,0.3);
  }

  .ss-generate-btn:hover { background: #ea6c0a; transform: translateY(-1px); }

  /* ── AI loading ── */
  .ss-ai-loading {
    display: flex; flex-direction: column;
    align-items: center; gap: 20px;
  }

  .ss-ai-orb {
    width: 56px; height: 56px; border-radius: 50%;
    background: radial-gradient(circle, #f97316, #fb923c);
    animation: ssOrb 1.5s ease-in-out infinite;
    box-shadow: 0 0 40px rgba(249,115,22,0.5);
  }

  @keyframes ssOrb {
    0%, 100% { transform: scale(1);    box-shadow: 0 0 40px rgba(249,115,22,0.5); }
    50%       { transform: scale(1.15); box-shadow: 0 0 60px rgba(249,115,22,0.8); }
  }

  .ss-ai-loading-text {
    font-size: 16px; color: var(--muted); font-style: italic;
  }

  /* ── Summary ── */
  .ss-summary {
    width: 100%; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    overflow-y: auto; position: relative; padding: 60px 24px;
    box-sizing: border-box;
  }

  .ss-summary-inner {
    width: 100%; max-width: 640px;
    display: flex; flex-direction: column; gap: 20px;
  }

  .ss-summary-title {
    font-family: var(--font-heading); font-size: 26px; font-weight: 800;
    color: var(--text); letter-spacing: -0.5px; margin: 0 0 2px;
  }

  .ss-summary-sub { font-size: 13px; color: var(--muted); margin: 0; }

  /* Bullets */
  .ss-bullets {
    display: flex; flex-direction: column; gap: 8px;
    background: var(--card-bg); border: 1px solid var(--border);
    border-radius: 14px; padding: 16px 18px;
  }

  .ss-bullet {
    display: flex; align-items: flex-start; gap: 12px;
    font-size: 14px; color: var(--text); line-height: 1.5;
  }

  .ss-bullet-dot {
    width: 22px; height: 22px; border-radius: 50%;
    background: rgba(249,115,22,0.15); color: #f97316;
    font-size: 11px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 1px;
  }

  /* Next session */
  .ss-next {
    display: flex; align-items: flex-start; gap: 10px;
    background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.2);
    border-radius: 12px; padding: 12px 16px;
  }

  .ss-next-label {
    font-size: 12px; font-weight: 700; color: #f97316;
    white-space: nowrap; padding-top: 1px;
  }

  .ss-next-text { font-size: 14px; color: var(--text); line-height: 1.5; }

  /* Log editor */
  .ss-log-section { display: flex; flex-direction: column; gap: 8px; }

  .ss-log-header {
    display: flex; align-items: center; justify-content: space-between;
  }

  .ss-log-label {
    font-size: 12px; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.5px;
  }

  .ss-log-hint { font-size: 11px; color: var(--placeholder); }

  .ss-editor { display: flex; flex-direction: column; gap: 0; }

  .ss-editor-tabs {
    display: flex; gap: 2px;
    background: var(--bg); border: 1px solid var(--border);
    border-bottom: none; border-radius: 10px 10px 0 0;
    padding: 4px 4px 0;
  }

  .ss-etab {
    background: none; border: none; border-radius: 7px 7px 0 0;
    padding: 6px 16px; font-size: 12px; font-weight: 500;
    color: var(--muted); cursor: pointer; font-family: var(--font-body);
    transition: all 0.15s;
  }

  .ss-etab.active { background: var(--card-bg); color: var(--text); }

  .ss-log-textarea {
    background: var(--card-bg); border: 1px solid var(--border);
    border-radius: 0 0 10px 10px; padding: 14px 16px;
    font-size: 13px; color: var(--text);
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    outline: none; resize: vertical; line-height: 1.7;
    transition: border-color 0.2s;
  }

  .ss-log-textarea:focus { border-color: #f97316; }

  .ss-log-preview {
    background: var(--card-bg); border: 1px solid var(--border);
    border-radius: 0 0 10px 10px; padding: 14px 16px;
    font-size: 14px; color: var(--text); line-height: 1.7;
    min-height: 120px;
  }

  .ss-log-preview p  { margin: 0 0 8px; }
  .ss-log-preview p:last-child { margin-bottom: 0; }
  .ss-log-preview strong { font-weight: 600; }
  .ss-log-preview em { font-style: italic; color: var(--muted); }
  .ss-log-preview code {
    background: var(--input-bg); border: 1px solid var(--border);
    border-radius: 4px; padding: 1px 6px; font-size: 12px; color: #f97316;
  }

  /* Summary actions */
  .ss-summary-actions {
    display: flex; gap: 12px; justify-content: flex-end;
    padding-top: 4px;
  }

  .ss-discard-btn {
    background: none; border: 1px solid var(--border); border-radius: 10px;
    padding: 12px 20px; font-size: 14px; color: var(--muted);
    cursor: pointer; font-family: var(--font-body); transition: all 0.15s;
  }

  .ss-discard-btn:hover { border-color: var(--muted); color: var(--text); }

  .ss-save-btn {
    background: #22c55e; color: white; border: none;
    border-radius: 10px; padding: 12px 28px;
    font-size: 15px; font-weight: 700; font-family: var(--font-body);
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 4px 16px rgba(34,197,94,0.3);
    display: flex; align-items: center; gap: 8px; min-width: 140px;
    justify-content: center;
  }

  .ss-save-btn:hover:not(:disabled) {
    background: #16a34a; transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(34,197,94,0.4);
  }

  .ss-save-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

  .ss-save-error {
    font-size: 13px; color: var(--danger-text);
    background: var(--danger-bg); border-radius: 8px; padding: 10px 14px;
  }

  .ss-ai-error {
    display: flex; flex-direction: column; align-items: center; gap: 16px;
    color: var(--muted); font-size: 14px;
  }

  .ss-spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
    border-radius: 50%; animation: ssSpin 0.7s linear infinite;
    display: inline-block;
  }

  @keyframes ssSpin { to { transform: rotate(360deg); } }
`;
