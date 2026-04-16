import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';
import PomodoroTimer from '../components/PomodoroTimer';
import QuickCapture from '../components/QuickCapture';

function confidenceColor(val) {
  if (val === null || val === undefined) return '#6b7280';
  if (val >= 75) return '#22c55e';
  if (val >= 50) return '#f97316';
  if (val >= 25) return '#f59e0b';
  return '#ef4444';
}

function LogModal({ log, topics, onClose, onSaved }) {
  const editing = !!log?.id;
  const [form, setForm] = useState({
    topic_id: log?.topic_id || '',
    notes: log?.notes || '',
    time_spent: log?.time_spent || '',
    date: log?.date ? log.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    confidence: log?.confidence ?? null,
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
        confidence: form.confidence !== null ? parseInt(form.confidence) : null,
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

          {/* Confidence slider */}
          <div className="conf-slider-wrap">
            <div className="conf-slider-header">
              <label className="conf-slider-label">
                How confident do you feel about this topic right now?
              </label>
              {form.confidence !== null ? (
                <span className="conf-value-badge" style={{ background: confidenceColor(form.confidence) + '22', color: confidenceColor(form.confidence) }}>
                  {form.confidence}%
                </span>
              ) : (
                <span className="conf-skip">Skip</span>
              )}
            </div>
            <div className="conf-slider-track">
              <input
                type="range" min={0} max={100} step={5}
                value={form.confidence ?? 50}
                onChange={e => setForm(f => ({ ...f, confidence: parseInt(e.target.value) }))}
                onMouseDown={() => { if (form.confidence === null) setForm(f => ({ ...f, confidence: 50 })); }}
                className="conf-range"
                style={{
                  '--conf-color': confidenceColor(form.confidence ?? 50),
                  background: `linear-gradient(to right, ${confidenceColor(form.confidence ?? 50)} 0%, ${confidenceColor(form.confidence ?? 50)} ${form.confidence ?? 50}%, var(--border) ${form.confidence ?? 50}%, var(--border) 100%)`
                }}
              />
              <div className="conf-marks">
                <span>Not confident</span>
                <span>Somewhat</span>
                <span>Very confident</span>
              </div>
            </div>
            {form.confidence !== null && (
              <button
                type="button"
                className="conf-clear"
                onClick={() => setForm(f => ({ ...f, confidence: null }))}
              >
                Clear rating
              </button>
            )}
          </div>

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
  const [expanded, setExpanded] = useState(false);
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

  // Count lines to know if content is long enough to collapse
  const lineCount = (log.notes || '').split('\n').length;
  const charCount = (log.notes || '').length;
  const isLong = lineCount > 4 || charCount > 280;

  const dateStr = new Date(log.date).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <div className={`log-card ${expanded ? 'expanded' : ''}`}>
      {/* ── Header row ── */}
      <div className="log-header">
        <div className="log-header-left">
          {topic && (
            <span className="log-topic-pill">
              <span className="log-topic-dot" />
              {topic.title}
            </span>
          )}
          <span className="log-date-badge">{dateStr}</span>
        </div>
        <div className="log-header-right">
          <span className="log-time-pill">
            <span>◷</span> {timeLabel}
          </span>
          <div className="log-actions">
            <button
              className="icon-btn expand-btn"
              onClick={() => setExpanded(e => !e)}
              title={expanded ? 'Collapse' : 'Read full log'}
            >
              {expanded ? '↑' : '↓'}
            </button>
            <button className="icon-btn edit-btn" onClick={() => onEdit(log)} title="Edit">✎</button>
            <button
              className="icon-btn del-btn"
              onClick={() => setConfirm(true)}
              disabled={deleting}
              title="Delete"
            >
              {deleting ? '…' : '✕'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Notes preview / full ── */}
      <div
        className={`log-notes-wrap ${expanded ? 'full' : 'preview'}`}
        onClick={() => !expanded && setExpanded(true)}
        style={{ cursor: expanded ? 'default' : 'pointer' }}
      >
        <div className="log-notes">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {log.notes}
          </ReactMarkdown>
        </div>
        {!expanded && isLong && (
          <div className="log-fade-overlay">
            <button className="log-read-more" onClick={e => { e.stopPropagation(); setExpanded(true); }}>
              Read full log ↓
            </button>
          </div>
        )}
      </div>

      {/* ── Footer (only when expanded) ── */}
      {expanded && (
        <div className="log-footer-expanded">
          <button className="log-collapse-btn" onClick={() => setExpanded(false)}>
            ↑ Collapse
          </button>
          <button className="icon-btn edit-btn-inline" onClick={() => onEdit(log)}>
            ✎ Edit log
          </button>
        </div>
      )}

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

// ─── Calendar View ────────────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function CalendarView({ logs, topicMap, onEdit, onDelete, onNewLog }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(null); // selected date string YYYY-MM-DD

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday-first: 0=Mon..6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) {
      cells.push(null);
    } else {
      cells.push(dayNum);
    }
  }

  // Group logs by date string
  const logsByDate = {};
  logs.forEach(log => {
    const d = new Date(log.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!logsByDate[key]) logsByDate[key] = [];
    logsByDate[key].push(log);
  });

  const dateKey = (day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const selectedLogs = selected ? (logsByDate[selected] || []) : [];

  // Total hours this month
  const monthLogs = Object.entries(logsByDate)
    .filter(([k]) => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
    .flatMap(([, v]) => v);
  const monthHours = (monthLogs.reduce((s, l) => s + l.time_spent, 0) / 60).toFixed(1);
  const activeDays = new Set(monthLogs.map(l => {
    const d = new Date(l.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })).size;

  return (
    <div className="cal-root">
      {/* Month nav */}
      <div className="cal-header">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <div className="cal-month-label">
          <span className="cal-month">{MONTHS[month]}</span>
          <span className="cal-year">{year}</span>
        </div>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
        <div className="cal-month-stats">
          <span className="cal-stat"><strong>{monthHours}h</strong> this month</span>
          <span className="cal-stat"><strong>{activeDays}</strong> active days</span>
        </div>
      </div>

      <div className="cal-body">
        {/* Left: grid */}
        <div className="cal-grid-wrap">
          {/* Day headers */}
          <div className="cal-day-headers">
            {DAYS.map(d => (
              <div key={d} className="cal-day-header">{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="cal-grid">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="cal-cell empty" />;
              const key = dateKey(day);
              const dayLogs = logsByDate[key] || [];
              const isToday = key === todayKey;
              const isSel = key === selected;
              const mins = dayLogs.reduce((s, l) => s + l.time_spent, 0);
              const hrs = (mins / 60).toFixed(1);
              const intensity = mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 120 ? 3 : 4;

              return (
                <div
                  key={i}
                  className={`cal-cell ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''} ${dayLogs.length > 0 ? 'has-logs' : ''}`}
                  onClick={() => setSelected(isSel ? null : key)}
                >
                  <span className="cal-day-num">{day}</span>
                  {dayLogs.length > 0 && (
                    <>
                      <div className={`cal-intensity i${intensity}`} />
                      <span className="cal-log-count">{dayLogs.length}</span>
                    </>
                  )}
                  {mins > 0 && (
                    <span className="cal-hrs">{hrs}h</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="cal-legend">
            <span className="cal-legend-label">Less</span>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className={`cal-legend-dot i${i}`} />
            ))}
            <span className="cal-legend-label">More</span>
          </div>
        </div>

        {/* Right: selected day logs */}
        <div className="cal-side">
          {!selected ? (
            <div className="cal-side-empty">
              <span className="cal-side-empty-icon">◷</span>
              <p>Click a day to see its logs</p>
            </div>
          ) : (
            <>
              <div className="cal-side-header">
                <h3 className="cal-side-date">
                  {new Date(selected + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric'
                  })}
                </h3>
                <button className="cal-new-btn" onClick={onNewLog}>+ New</button>
              </div>
              {selectedLogs.length === 0 ? (
                <div className="cal-side-empty">
                  <p>No logs on this day</p>
                  <button className="primary-btn-sm" onClick={onNewLog}>+ Add log</button>
                </div>
              ) : (
                <div className="cal-side-logs">
                  {selectedLogs.map(log => {
                    const topic = topicMap[log.topic_id];
                    const h = Math.floor(log.time_spent / 60);
                    const m = log.time_spent % 60;
                    const timeLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;
                    return (
                      <div key={log.id} className="cal-log-item">
                        <div className="cal-log-top">
                          {topic && <span className="cal-log-topic">{topic.title}</span>}
                          <div className="cal-log-actions">
                            <button className="icon-btn edit-btn" onClick={() => onEdit(log)} title="Edit">✎</button>
                          </div>
                        </div>
                        <div className="cal-log-notes">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {log.notes.length > 200 ? log.notes.slice(0, 200) + '...' : log.notes}
                          </ReactMarkdown>
                        </div>
                        <div className="cal-log-footer">
                          <span className="time-badge">
                            <span className="time-icon">◷</span> {timeLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [showCapture, setShowCapture] = useState(false);
  const [topicFilter, setTopicFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list');
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id)));
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selected].map(id => api.delete(`/logs/${id}`)));
      setLogs(prev => prev.filter(l => !selected.has(l.id)));
      setSelected(new Set());
    } catch (e) { console.error(e); }
    finally { setBulkDeleting(false); }
  };

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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="view-toggle">
            <button
              className={`view-btn ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
            >☰ List</button>
            <button
              className={`view-btn ${view === 'calendar' ? 'active' : ''}`}
              onClick={() => setView('calendar')}
            >⊞ Calendar</button>
          </div>
          <button className="capture-btn" onClick={() => setShowCapture(true)} title="Quick Capture — paste a URL">
            ⚡ Quick Capture
          </button>
          <button className="primary-btn" onClick={() => setModal({})}>
            <span>+</span> New log
          </button>
        </div>
      </div>

      {/* Filters — only show in list view */}
      {view === 'list' && (
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
      )}

      {/* Calendar view */}
      {view === 'calendar' && (
        <CalendarView
          logs={logs}
          topicMap={topicMap}
          onEdit={setModal}
          onDelete={fetchData}
          onNewLog={() => setModal({})}
        />
      )}

      {/* List view */}
      {view === 'list' && (
        <>
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
            <>
              {/* Bulk action toolbar */}
              <div className="bulk-toolbar">
                <label className="bulk-select-all">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={selectAll}
                  />
                  <span>{selected.size > 0 ? `${selected.size} selected` : 'Select all'}</span>
                </label>
                {selected.size > 0 && (
                  <div className="bulk-actions">
                    <span className="bulk-count">{selected.size} of {filtered.length} selected</span>
                    <button
                      className="bulk-delete-btn"
                      onClick={bulkDelete}
                      disabled={bulkDeleting}
                    >
                      {bulkDeleting
                        ? <span className="bulk-spinner" />
                        : `🗑 Delete ${selected.size} log${selected.size > 1 ? 's' : ''}`
                      }
                    </button>
                    <button className="bulk-clear-btn" onClick={() => setSelected(new Set())}>
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="logs-list">
                {filtered.map(log => (
                  <div key={log.id} className={`log-select-wrap ${selected.has(log.id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      className="log-checkbox"
                      checked={selected.has(log.id)}
                      onChange={() => toggleSelect(log.id)}
                    />
                    <div className="log-card-wrap">
                      <LogCard
                        log={log}
                        topicMap={topicMap}
                        onEdit={setModal}
                        onDelete={fetchData}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
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

      {showCapture && (
        <QuickCapture
          topics={topics}
          onClose={() => setShowCapture(false)}
          onSaved={() => { setShowCapture(false); fetchData(); }}
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
          font-family: var(--font-heading);
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
          font-family: var(--font-body);
          cursor: pointer; transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(249,115,22,0.3);
          white-space: nowrap;
        }

        .primary-btn span { font-size: 18px; line-height: 1; }
        .primary-btn:hover { background: #ea6c0a; transform: translateY(-1px); }

        .capture-btn {
          display: flex; align-items: center; gap: 7px;
          background: var(--card-bg); color: var(--text);
          border: 1px solid var(--border); border-radius: 10px;
          padding: 11px 18px; font-size: 14px; font-weight: 600;
          font-family: var(--font-body);
          cursor: pointer; transition: all 0.2s; white-space: nowrap;
        }

        .capture-btn:hover {
          border-color: #f97316; color: #f97316;
          background: rgba(249,115,22,0.06);
        }

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
          font-family: var(--font-body);
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
          margin-top: 4px;
        }

        /* ── Log card ── */
        .log-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 0;
          transition: box-shadow 0.2s, border-color 0.2s, transform 0.2s;
          overflow: hidden;
          box-shadow: 0 4px 12px var(--shadow);
        }

        .log-card:hover {
          box-shadow: 0 12px 32px var(--shadow);
          border-color: var(--accent);
          transform: translateY(-2px);
        }

        .log-card.expanded {
          border-color: rgba(249,115,22,0.4);
          box-shadow: 0 16px 40px rgba(249,115,22,0.1);
        }

        /* Header */
        .log-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--border);
          gap: 12px;
          background: var(--bg);
        }

        .log-header-left {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: 1;
        }

        .log-topic-pill {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(249,115,22,0.12); color: #f97316;
          font-size: 12px; font-weight: 800;
          padding: 6px 14px; border-radius: 99px;
          text-transform: uppercase; letter-spacing: 0.5px;
          border: 1px solid rgba(249,115,22,0.2);
          font-family: var(--font-heading);
        }

        .log-topic-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #f97316; flex-shrink: 0;
        }

        .log-date-badge {
          font-size: 13px; font-weight: 600; color: var(--muted);
        }

        .log-header-right {
          display: flex; align-items: center; gap: 12px; flex-shrink: 0;
        }

        .log-time-pill {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 14px; font-weight: 800; color: var(--text);
          background: var(--card-bg); border: 1px solid var(--border);
          padding: 6px 14px; border-radius: 99px;
          font-family: var(--font-heading);
          box-shadow: 0 2px 8px var(--shadow);
        }

        .log-actions {
          display: flex; gap: 4px;
          opacity: 0; transition: opacity 0.2s;
        }

        .log-card:hover .log-actions { opacity: 1; }
        .log-card.expanded .log-actions { opacity: 1; }

        /* Notes area */
        .log-notes-wrap {
          position: relative;
          padding: 24px;
        }

        .log-notes-wrap.preview {
          max-height: 120px;
          overflow: hidden;
        }

        .log-notes-wrap.full {
          max-height: none;
        }

        .log-fade-overlay {
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 60px;
          background: linear-gradient(to bottom, transparent, var(--card-bg));
          display: flex; align-items: flex-end; justify-content: center;
          padding-bottom: 8px;
        }

        .log-read-more {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 99px; padding: 4px 14px;
          font-size: 11px; font-weight: 600; color: #f97316;
          cursor: pointer; font-family: var(--font-body);
          transition: all 0.15s;
        }

        .log-read-more:hover { background: rgba(249,115,22,0.08); border-color: #f97316; }

        /* Footer when expanded */
        .log-footer-expanded {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 20px;
          border-top: 1px solid var(--border);
          background: var(--bg);
        }

        .log-collapse-btn {
          background: none; border: none;
          font-size: 12px; font-weight: 600; color: var(--muted);
          cursor: pointer; font-family: var(--font-body);
          padding: 4px 8px; border-radius: 6px;
          transition: all 0.15s;
        }

        .log-collapse-btn:hover { color: var(--text); background: var(--hover-bg); }

        .edit-btn-inline {
          font-size: 12px !important; font-weight: 600 !important;
          color: #f97316 !important; padding: 4px 10px !important;
          border: 1px solid rgba(249,115,22,0.3) !important;
          border-radius: 6px !important;
        }

        .edit-btn-inline:hover { background: rgba(249,115,22,0.08) !important; }

        .icon-btn {
          background: none; border: none;
          border-radius: 6px; padding: 4px 8px;
          font-size: 14px; cursor: pointer;
          transition: all 0.2s;
          font-family: var(--font-body);
        }

        .expand-btn { color: var(--muted); font-size: 16px; }
        .expand-btn:hover { background: var(--hover-bg); color: var(--text); }
        .edit-btn { color: var(--muted); }
        .edit-btn:hover { background: var(--hover-bg); color: #f97316; }
        .del-btn  { color: var(--muted); }
        .del-btn:hover { background: var(--danger-bg); color: var(--danger-text); }

        .log-notes {
          font-size: 15px; color: var(--text);
          line-height: 1.8; margin: 0;
        }

        .log-notes p  { margin: 0 0 8px; }
        .log-notes p:last-child { margin-bottom: 0; }
        .log-notes h1, .log-notes h2, .log-notes h3 {
          font-family: var(--font-heading);
          font-weight: 700; color: var(--text);
          margin: 12px 0 6px;
        }
        .log-notes h1 { font-size: 22px; margin-bottom: 12px; }
        .log-notes h2 { font-size: 18px; margin-bottom: 10px; }
        .log-notes h3 { font-size: 16px; margin-bottom: 8px; }
        .log-notes ul, .log-notes ol {
          padding-left: 24px; margin: 10px 0;
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
          font-family: var(--font-body);
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
          font-family: var(--font-body);
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
          font-family: var(--font-heading); font-weight: 700;
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

        /* Bulk actions */
        .bulk-toolbar {
          display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
          padding: 10px 14px;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 10px; flex-wrap: wrap;
        }

        .bulk-select-all {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; font-weight: 500; color: var(--muted);
          cursor: pointer;
        }

        .bulk-select-all input {
          cursor: pointer;
          width: 16px;
          height: 16px;
          appearance: none;
          -webkit-appearance: none;
          background: var(--card-bg);
          border: 2px solid var(--border);
          border-radius: 4px;
          transition: all 0.2s ease;
          position: relative;
        }

        .bulk-select-all input:checked {
          background: #f97316;
          border-color: #f97316;
        }

        .bulk-select-all input:checked::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 11px;
          font-weight: bold;
        }

        .bulk-select-all input:hover:not(:checked) {
          border-color: #f97316;
          background: rgba(249,115,22,0.1);
        }

        .log-checkbox:focus,
        .bulk-select-all input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(249,115,22,0.3);
        }

        .bulk-actions { display: flex; align-items: center; gap: 10px; }

        .bulk-count {
          font-size: 12px; font-weight: 600; color: #f97316;
        }

        .bulk-delete-btn {
          display: flex; align-items: center; gap: 6px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
          border-radius: 8px; padding: 6px 14px;
          font-size: 13px; font-weight: 600; color: #ef4444;
          cursor: pointer; font-family: var(--font-body);
          transition: all 0.15s;
        }

        .bulk-delete-btn:hover:not(:disabled) { background: rgba(239,68,68,0.2); }
        .bulk-delete-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .bulk-clear-btn {
          background: none; border: 1px solid var(--border);
          border-radius: 8px; padding: 6px 12px;
          font-size: 13px; color: var(--muted);
          cursor: pointer; font-family: var(--font-body);
          transition: all 0.15s;
        }

        .bulk-clear-btn:hover { border-color: var(--muted); color: var(--text); }

        .bulk-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(239,68,68,0.3); border-top-color: #ef4444;
          border-radius: 50%; animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        .log-select-wrap {
          display: flex; align-items: flex-start; gap: 12px;
        }

        .log-select-wrap.selected .log-card {
          border-color: rgba(249,115,22,0.4);
          background: rgba(249,115,22,0.04);
        }

        .log-checkbox {
          margin-top: 22px;
          cursor: pointer;
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          appearance: none;
          -webkit-appearance: none;
          background: var(--card-bg);
          border: 2px solid var(--border);
          border-radius: 5px;
          transition: all 0.2s ease;
          position: relative;
        }

        .log-checkbox:checked {
          background: #f97316;
          border-color: #f97316;
        }

        .log-checkbox:checked::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 12px;
          font-weight: bold;
        }

        .log-checkbox:hover:not(:checked) {
          border-color: #f97316;
          background: rgba(249,115,22,0.1);
        }

        .log-card-wrap { flex: 1; min-width: 0; }

        .empty-state {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 80px 20px; gap: 12px; text-align: center;
        }

        .empty-icon {
          font-size: 48px; color: var(--border); margin-bottom: 8px;
        }

        .empty-title {
          font-family: var(--font-heading);
          font-size: 18px; font-weight: 700; color: var(--text);
        }

        .empty-sub { font-size: 14px; color: var(--muted); margin-bottom: 8px; }

        /* View toggle */
        .view-toggle {
          display: flex; gap: 2px;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 3px;
        }

        .view-btn {
          background: none; border: none;
          border-radius: 7px; padding: 7px 14px;
          font-size: 13px; font-weight: 500;
          color: var(--muted); cursor: pointer;
          font-family: var(--font-body);
          transition: all 0.15s; white-space: nowrap;
        }

        .view-btn:hover { color: var(--text); }

        .view-btn.active {
          background: var(--bg);
          color: var(--text);
          box-shadow: 0 1px 4px var(--shadow);
        }

        /* Calendar */
        .cal-root {
          width: 100%;
          animation: fadeIn 0.3s ease;
        }

        .cal-header {
          display: flex; align-items: center;
          gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
        }

        .cal-nav-btn {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 8px; padding: 6px 14px;
          font-size: 18px; color: var(--text);
          cursor: pointer; transition: all 0.15s;
          font-family: var(--font-body);
          line-height: 1;
        }

        .cal-nav-btn:hover { border-color: #f97316; color: #f97316; }

        .cal-month-label {
          display: flex; align-items: baseline; gap: 8px;
        }

        .cal-month {
          font-family: var(--font-heading);
          font-size: 22px; font-weight: 700;
          color: var(--text); letter-spacing: -0.5px;
        }

        .cal-year {
          font-size: 16px; color: var(--muted); font-weight: 500;
        }

        .cal-month-stats {
          display: flex; gap: 16px; margin-left: auto;
        }

        .cal-stat {
          font-size: 13px; color: var(--muted);
        }

        .cal-stat strong { color: var(--text); font-weight: 700; }

        .cal-body {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 32px;
          align-items: start;
        }

        .cal-grid-wrap {
          display: flex; flex-direction: column; gap: 12px;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 20px; padding: 24px;
          box-shadow: 0 8px 24px var(--shadow);
        }

        .cal-day-headers {
          display: grid; grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }

        .cal-day-header {
          text-align: center;
          font-size: 11px; font-weight: 700;
          color: var(--muted); text-transform: uppercase;
          letter-spacing: 0.5px; padding: 4px 0;
        }

        .cal-grid {
          display: grid; grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }

        .cal-cell {
          aspect-ratio: 1;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 8px;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 3px; cursor: pointer;
          transition: all 0.15s; position: relative;
          min-height: 64px;
        }

        .cal-cell.empty {
          background: transparent; border-color: transparent;
          cursor: default; pointer-events: none;
        }

        .cal-cell:not(.empty):hover {
          border-color: #f97316;
          background: var(--hover-bg);
        }

        .cal-cell.today {
          border-color: #f97316;
          background: rgba(249,115,22,0.06);
        }

        .cal-cell.selected {
          border-color: #f97316;
          background: rgba(249,115,22,0.12);
          box-shadow: 0 0 0 2px rgba(249,115,22,0.25);
        }

        .cal-day-num {
          font-size: 13px; font-weight: 600;
          color: var(--text); line-height: 1;
        }

        .cal-cell.today .cal-day-num {
          color: #f97316; font-weight: 800;
        }

        .cal-intensity {
          width: 28px; height: 4px; border-radius: 99px;
        }

        .cal-intensity.i0 { background: transparent; }
        .cal-intensity.i1 { background: rgba(249,115,22,0.25); }
        .cal-intensity.i2 { background: rgba(249,115,22,0.45); }
        .cal-intensity.i3 { background: rgba(249,115,22,0.7); }
        .cal-intensity.i4 { background: #f97316; }

        .cal-log-count {
          font-size: 10px; font-weight: 700;
          color: #f97316; line-height: 1;
        }

        .cal-hrs {
          font-size: 10px; color: var(--muted);
          line-height: 1;
        }

        .cal-legend {
          display: flex; align-items: center; gap: 4px;
          justify-content: flex-end; padding-top: 4px;
        }

        .cal-legend-label { font-size: 11px; color: var(--placeholder); }

        .cal-legend-dot {
          width: 12px; height: 12px; border-radius: 3px;
        }

        .cal-legend-dot.i0 { background: var(--border); }
        .cal-legend-dot.i1 { background: rgba(249,115,22,0.25); }
        .cal-legend-dot.i2 { background: rgba(249,115,22,0.45); }
        .cal-legend-dot.i3 { background: rgba(249,115,22,0.7); }
        .cal-legend-dot.i4 { background: #f97316; }

        .cal-side {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px; padding: 24px;
          min-height: 400px;
          display: flex; flex-direction: column; gap: 16px;
          position: sticky; top: 24px;
          box-shadow: 0 8px 32px var(--shadow);
        }

        .cal-side-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 10px; text-align: center;
          color: var(--muted); font-size: 13px;
        }

        .cal-side-empty-icon { font-size: 32px; color: var(--border); }

        .cal-side-header {
          display: flex; align-items: center;
          justify-content: space-between; gap: 8px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 16px;
        }

        .cal-side-date {
          font-family: var(--font-heading);
          font-size: 20px; font-weight: 800; color: var(--text);
          margin: 0; letter-spacing: -0.5px;
        }

        .cal-new-btn {
          background: rgba(249,115,22,0.12);
          border: 1px solid rgba(249,115,22,0.3);
          border-radius: 8px; padding: 5px 12px;
          font-size: 12px; font-weight: 600;
          color: #f97316; cursor: pointer;
          font-family: var(--font-body);
          transition: all 0.15s;
        }

        .cal-new-btn:hover { background: rgba(249,115,22,0.2); }

        .cal-side-logs {
          display: flex; flex-direction: column; gap: 16px;
          overflow-y: auto; max-height: 600px; padding-right: 4px;
        }

        .cal-log-item {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px; padding: 16px;
          display: flex; flex-direction: column; gap: 10px;
        }

        .cal-log-top {
          display: flex; align-items: center;
          justify-content: space-between; gap: 8px;
        }

        .cal-log-topic {
          font-family: var(--font-heading); font-size: 11px; font-weight: 800;
          color: #f97316; text-transform: uppercase; letter-spacing: 0.5px;
          background: rgba(249,115,22,0.12); padding: 4px 10px; border-radius: 99px;
        }

        .cal-log-actions { display: flex; gap: 4px; }

        .cal-log-notes {
          font-size: 13px; color: var(--text); line-height: 1.6;
        }

        .cal-log-notes p { margin: 0 0 4px; }
        .cal-log-notes p:last-child { margin: 0; }

        .cal-log-footer {
          padding-top: 6px;
          border-top: 1px solid var(--border);
        }

        .primary-btn-sm {
          background: #f97316; color: white; border: none;
          border-radius: 8px; padding: 8px 16px;
          font-size: 13px; font-weight: 600;
          font-family: var(--font-body);
          cursor: pointer; transition: all 0.2s;
          box-shadow: 0 3px 10px rgba(249,115,22,0.3);
        }

        .primary-btn-sm:hover { background: #ea6c0a; transform: translateY(-1px); }

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
          border-radius: 24px; padding: 36px; width: 100%; max-width: 500px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px var(--border);
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
          font-family: var(--font-heading);
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
          font-family: var(--font-body);
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

        /* ── Confidence slider ── */
        .conf-slider-wrap {
          background: var(--bg); border: 1px solid var(--border);
          border-radius: 12px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 10px;
        }

        .conf-slider-header {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }

        .conf-slider-label {
          font-size: 13px; font-weight: 500; color: var(--text); line-height: 1.4;
        }

        .conf-value-badge {
          font-size: 13px; font-weight: 800;
          padding: 3px 10px; border-radius: 99px; flex-shrink: 0;
          font-family: var(--font-heading);
        }

        .conf-skip { font-size: 11px; color: var(--placeholder); }

        .conf-slider-track { display: flex; flex-direction: column; gap: 5px; }

        .conf-range {
          -webkit-appearance: none; width: 100%; height: 5px;
          border-radius: 99px; outline: none;
          background: linear-gradient(
            to right,
            var(--conf-color, #f97316) 0%,
            var(--conf-color, #f97316) var(--value, 50%),
            var(--border) var(--value, 50%),
            var(--border) 100%
          );
          transition: background 0.2s;
        }

        .conf-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--conf-color, #f97316);
          cursor: pointer; border: 2px solid var(--card-bg);
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          transition: transform 0.15s;
        }

        .conf-range::-webkit-slider-thumb:hover { transform: scale(1.2); }

        .conf-range::-moz-range-thumb {
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--conf-color, #f97316);
          cursor: pointer; border: 2px solid var(--card-bg);
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }

        .conf-marks {
          display: flex; justify-content: space-between;
          font-size: 10px; color: var(--placeholder);
        }

        .conf-clear {
          background: none; border: none; font-size: 11px;
          color: var(--placeholder); cursor: pointer;
          font-family: var(--font-body); padding: 0;
          transition: color 0.15s; align-self: flex-start;
        }

        .conf-clear:hover { color: var(--muted); }

        .submit-btn {
          background: #f97316; color: white; border: none;
          border-radius: 10px; padding: 12px;
          font-size: 14px; font-weight: 600;
          font-family: var(--font-body);
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
