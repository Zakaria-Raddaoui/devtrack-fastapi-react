import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

// ─── Mini sparkline ───────────────────────────────────────────────────────────

function Sparkline({ data, color = '#f97316', width = 80, height = 32 }) {
    if (!data || data.length < 2) return (
        <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--placeholder)' }}>No trend</span>
        </div>
    );
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d.value - min) / range) * (height - 6) - 3;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((d, i) => {
                const x = (i / (data.length - 1)) * width;
                const y = height - ((d.value - min) / range) * (height - 6) - 3;
                return i === data.length - 1
                    ? <circle key={i} cx={x} cy={y} r="3" fill={color} />
                    : null;
            })}
        </svg>
    );
}

// ─── Dual gauge ───────────────────────────────────────────────────────────────

function DualGauge({ confidence, evidence, gapColor, size = 100 }) {
    const R = (size - 10) / 2;
    const C = 2 * Math.PI * R;
    const confPct = (confidence ?? 0) / 100;
    const evidPct = evidence / 100;
    const cx = size / 2, cy = size / 2;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
            {/* Evidence track */}
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border)" strokeWidth="5" />
            <circle cx={cx} cy={cy} r={R} fill="none"
                stroke="#3b82f6" strokeWidth="5"
                strokeDasharray={C} strokeDashoffset={C * (1 - evidPct)}
                strokeLinecap="round" />
            {/* Confidence track (inner, slightly smaller) */}
            <circle cx={cx} cy={cy} r={R - 8} fill="none" stroke="var(--border)" strokeWidth="5" />
            {confidence !== null && (
                <circle cx={cx} cy={cy} r={R - 8} fill="none"
                    stroke={gapColor} strokeWidth="5"
                    strokeDasharray={2 * Math.PI * (R - 8)} strokeDashoffset={2 * Math.PI * (R - 8) * (1 - confPct)}
                    strokeLinecap="round" />
            )}
        </svg>
    );
}

// ─── Topic confidence card ────────────────────────────────────────────────────

function ConfidenceCard({ item, onClick }) {
    const hasConf = item.has_confidence_data;
    const gap = item.confidence !== null ? item.confidence - item.evidence : null;

    return (
        <div className="cc-card" onClick={onClick}>
            {/* Header */}
            <div className="cc-card-header">
                <div className="cc-card-title-wrap">
                    <h3 className="cc-card-title">{item.topic_title}</h3>
                    <span className="cc-hours">{item.total_hours}h logged</span>
                </div>
                <span
                    className="cc-gap-badge"
                    style={{ background: item.gap_color + '20', color: item.gap_color }}
                >
                    {hasConf ? item.gap_label : 'No confidence data'}
                </span>
            </div>

            {/* Gauges + scores */}
            <div className="cc-gauges">
                <div className="cc-gauge-wrap">
                    <DualGauge
                        confidence={item.confidence}
                        evidence={item.evidence}
                        gapColor={item.gap_color}
                    />
                    <div className="cc-gauge-center">
                        {hasConf ? (
                            <>
                                <span className="cc-conf-val" style={{ color: item.gap_color }}>
                                    {item.confidence}
                                </span>
                                <span className="cc-gauge-label">conf</span>
                            </>
                        ) : (
                            <span className="cc-no-data">?</span>
                        )}
                    </div>
                </div>

                <div className="cc-scores">
                    <div className="cc-score-row">
                        <div className="cc-score-dot" style={{ background: item.gap_color }} />
                        <span className="cc-score-label">Confidence</span>
                        <span className="cc-score-val" style={{ color: hasConf ? item.gap_color : 'var(--placeholder)' }}>
                            {hasConf ? `${item.confidence}%` : '—'}
                        </span>
                    </div>
                    <div className="cc-score-row">
                        <div className="cc-score-dot" style={{ background: '#3b82f6' }} />
                        <span className="cc-score-label">Evidence</span>
                        <span className="cc-score-val" style={{ color: '#3b82f6' }}>{item.evidence}%</span>
                    </div>
                    {gap !== null && (
                        <div className="cc-gap-row" style={{ color: item.gap_color }}>
                            {gap > 0 ? `+${gap} gap — confidence ahead` : gap < 0 ? `${gap} gap — evidence ahead` : 'Perfectly aligned'}
                        </div>
                    )}
                </div>
            </div>

            {/* Sparkline */}
            {item.trend?.length > 1 && (
                <div className="cc-sparkline-row">
                    <span className="cc-sparkline-label">Confidence trend</span>
                    <Sparkline data={item.trend} color={item.gap_color} />
                </div>
            )}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const GAP_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'overconfident', label: '⚠ Overconfident' },
    { key: 'aligned', label: '✓ Aligned' },
    { key: 'underestimating', label: '↑ Underestimating' },
];

export default function Confidence() {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        api.get('/confidence/overview')
            .then(r => setData(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = filter === 'all'
        ? data
        : data.filter(d => d.gap_label.includes(filter.replace('underestimating', 'underestimat')));

    // Summary counts
    const overconfident = data.filter(d => d.gap_label?.includes('overconfident')).length;
    const aligned = data.filter(d => d.gap_label === 'aligned').length;
    const underestimating = data.filter(d => d.gap_label?.includes('underestimat')).length;
    const noData = data.filter(d => !d.has_confidence_data).length;

    if (loading) return <div className="cc-loading"><div className="cc-ring" /></div>;

    return (
        <div className="cc-root">
            {/* Header */}
            <div className="cc-header">
                <div>
                    <h1 className="cc-title">Confidence & Evidence</h1>
                    <p className="cc-sub">
                        Your subjective confidence vs objective evidence — spot the gaps
                    </p>
                </div>
            </div>

            {/* How it works */}
            <div className="cc-explainer">
                <div className="cc-exp-item">
                    <div className="cc-exp-dot" style={{ background: '#f97316' }} />
                    <div>
                        <span className="cc-exp-label">Confidence</span>
                        <span className="cc-exp-desc">How confident you feel — set via slider when logging</span>
                    </div>
                </div>
                <div className="cc-exp-divider" />
                <div className="cc-exp-item">
                    <div className="cc-exp-dot" style={{ background: '#3b82f6' }} />
                    <div>
                        <span className="cc-exp-label">Evidence</span>
                        <span className="cc-exp-desc">Computed from hours, consistency, depth, resources read, roadmap steps & goals</span>
                    </div>
                </div>
                <div className="cc-exp-divider" />
                <div className="cc-exp-item">
                    <div className="cc-exp-dot" style={{ background: '#a855f7' }} />
                    <div>
                        <span className="cc-exp-label">Gap</span>
                        <span className="cc-exp-desc">Overconfident = feeling ahead of proof. Underestimating = evidence ahead of feeling.</span>
                    </div>
                </div>
            </div>

            {/* Stats bar */}
            {data.length > 0 && (
                <div className="cc-stats-bar">
                    {[
                        { val: overconfident, label: 'Overconfident', color: '#ef4444' },
                        { val: aligned, label: 'Aligned', color: '#22c55e' },
                        { val: underestimating, label: 'Underestimating', color: '#a855f7' },
                        { val: noData, label: 'No confidence data', color: '#6b7280' },
                    ].map(({ val, label, color }) => (
                        <div key={label} className="cc-stat">
                            <span className="cc-stat-val" style={{ color }}>{val}</span>
                            <span className="cc-stat-label">{label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter tabs */}
            {data.length > 0 && (
                <div className="cc-filters">
                    {GAP_FILTERS.map(f => (
                        <button
                            key={f.key}
                            className={`cc-filter-btn ${filter === f.key ? 'active' : ''}`}
                            onClick={() => setFilter(f.key)}
                        >{f.label}</button>
                    ))}
                </div>
            )}

            {/* Cards grid */}
            {data.length === 0 ? (
                <div className="cc-empty">
                    <div className="cc-empty-icon">◎</div>
                    <h2>No data yet</h2>
                    <p>
                        Start adding logs with the confidence slider to track how your
                        self-perception compares to your actual progress.
                    </p>
                    <button className="cc-cta" onClick={() => navigate('/logs')}>
                        Go to Logs →
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="cc-empty">
                    <div className="cc-empty-icon">✓</div>
                    <h2>No topics in this category</h2>
                    <p>Try a different filter.</p>
                </div>
            ) : (
                <div className="cc-grid">
                    {filtered.map(item => (
                        <ConfidenceCard
                            key={item.topic_id}
                            item={item}
                            onClick={() => navigate(`/topics/${item.topic_id}`)}
                        />
                    ))}
                </div>
            )}

            <style>{`
        .cc-root {
          padding: 60px 48px; width: 100%; box-sizing: border-box;
          display: flex; flex-direction: column; gap: 40px;
          animation: ccFade 0.4s ease forwards;
          background: var(--bg);
        }

        @keyframes ccFade {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }

        .cc-loading { display:flex; align-items:center; justify-content:center; height:100vh; }
        .cc-ring { width:48px; height:48px; border:4px solid var(--border); border-top-color:#f97316; border-radius:50%; animation:ccSpin 0.8s linear infinite; }
        @keyframes ccSpin { to { transform:rotate(360deg); } }

        /* Header */
        .cc-header { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; }
        .cc-title { font-family:var(--font-heading); font-size:38px; font-weight:800; color:var(--text); letter-spacing:-1.5px; margin:0 0 6px; }
        .cc-sub { font-size:15px; color:var(--muted); margin:0; font-weight:500; }

        /* Explainer */
        .cc-explainer {
          display:flex; align-items:stretch;
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:24px; padding:24px 32px; gap:0;
          flex-wrap: wrap; box-shadow:0 12px 32px var(--shadow);
        }

        .cc-exp-item {
          display:flex; align-items:flex-start; gap:16px; flex:1; min-width:180px;
          padding: 8px 24px 8px 0;
        }

        .cc-exp-dot {
          width:12px; height:12px; border-radius:50%; flex-shrink:0; margin-top:4px;
        }

        .cc-exp-label {
          display:block; font-size:14px; font-weight:800; color:var(--text); margin-bottom:4px;
          font-family:var(--font-heading); letter-spacing:0.5px; text-transform:uppercase;
        }

        .cc-exp-desc { font-size:13px; color:var(--muted); line-height:1.6; display:block; font-weight:500; }

        .cc-exp-divider { width:1px; background:var(--border); margin:0 24px 0 0; align-self:stretch; }

        /* Stats bar */
        .cc-stats-bar {
          display:flex; background:var(--card-bg); border:1px solid var(--border);
          border-radius:24px; padding:24px 32px; box-shadow:0 12px 32px var(--shadow);
        }

        .cc-stat { display:flex; flex-direction:column; gap:4px; flex:1; align-items:center; }
        .cc-stat-val { font-family:var(--font-heading); font-size:32px; font-weight:800; letter-spacing:-1px; }
        .cc-stat-label { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; text-align:center; font-weight:700; font-family:var(--font-heading); }

        /* Filters */
        .cc-filters { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px; }

        .cc-filter-btn {
          background:var(--card-bg); border:1px solid var(--border); border-radius:12px;
          padding:10px 20px; font-size:14px; font-weight:600; color:var(--muted);
          cursor:pointer; font-family:var(--font-body); transition:all 0.2s cubic-bezier(0.16,1,0.3,1);
          box-shadow:0 4px 12px var(--shadow);
        }

        .cc-filter-btn:hover { border-color:rgba(249,115,22,0.3); color:#f97316; transform:translateY(-1px); box-shadow:0 6px 16px rgba(249,115,22,0.1); }
        .cc-filter-btn.active { background:rgba(249,115,22,0.05); border-color:#f97316; color:#f97316; font-weight:700; box-shadow:inset 0 1px 3px rgba(249,115,22,0.1); }

        /* Card grid */
        .cc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:24px; }

        /* Card */
        .cc-card {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:24px; padding:28px;
          display:flex; flex-direction:column; gap:20px;
          cursor:pointer; transition:all 0.3s cubic-bezier(0.16,1,0.3,1); box-shadow:0 12px 32px var(--shadow), 0 4px 12px rgba(0,0,0,0.02);
        }

        .cc-card:hover {
          transform:translateY(-4px); box-shadow:0 16px 40px var(--shadow);
          border-color:rgba(249,115,22,0.3);
        }

        .cc-card-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }

        .cc-card-title-wrap { display:flex; flex-direction:column; gap:4px; }

        .cc-card-title {
          font-family:var(--font-heading); font-size:20px; font-weight:800;
          color:var(--text); margin:0; letter-spacing:-0.5px;
        }

        .cc-hours { font-size:13px; color:var(--muted); font-weight:500; }

        .cc-gap-badge {
          font-size:11px; font-weight:800; padding:6px 12px; font-family:var(--font-heading);
          border-radius:99px; text-transform:uppercase;
          white-space:nowrap; flex-shrink:0; letter-spacing:0.5px;
        }

        /* Gauges */
        .cc-gauges { display:flex; align-items:center; gap:24px; }

        .cc-gauge-wrap { position:relative; flex-shrink:0; }

        .cc-gauge-center {
          position:absolute; inset:0; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
        }

        .cc-conf-val {
          font-family:var(--font-heading); font-size:24px; font-weight:800;
          letter-spacing:-0.5px; line-height:1;
        }

        .cc-gauge-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; font-weight:700; font-family:var(--font-heading); }

        .cc-no-data { font-size:28px; color:var(--placeholder); font-family:var(--font-heading); font-weight:800; }

        .cc-scores { display:flex; flex-direction:column; gap:8px; flex:1; }

        .cc-score-row { display:flex; align-items:center; gap:10px; }

        .cc-score-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }

        .cc-score-label { font-size:14px; color:var(--muted); flex:1; font-weight:600; }

        .cc-score-val { font-size:15px; font-weight:800; font-family:var(--font-heading); }

        .cc-gap-row {
          font-size:12px; font-weight:700; margin-top:6px;
          padding:8px 12px; border-radius:10px;
          background: var(--bg); border:1px solid var(--border); font-family:var(--font-body);
        }

        /* Sparkline */
        .cc-sparkline-row {
          display:flex; align-items:center; justify-content:space-between;
          padding-top:16px; border-top:1px solid var(--border);
        }

        .cc-sparkline-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; font-weight:700; font-family:var(--font-heading); }

        /* Empty */
        .cc-empty {
          display:flex; flex-direction:column; align-items:center;
          justify-content:center; gap:16px; text-align:center; padding:100px 20px;
        }

        .cc-empty-icon { font-size:64px; color:var(--border); }

        .cc-empty h2 {
          font-family:var(--font-heading); font-size:28px; font-weight:800;
          color:var(--text); margin:0; letter-spacing:-0.5px;
        }

        .cc-empty p { font-size:16px; color:var(--muted); max-width:480px; margin:0; line-height:1.6; font-weight:500; }

        .cc-cta {
          background:#f97316; color:white; border:none;
          border-radius:12px; padding:14px 24px;
          font-size:15px; font-weight:700; font-family:var(--font-heading);
          cursor:pointer; transition:all 0.2s cubic-bezier(0.16,1,0.3,1); box-shadow:0 8px 24px rgba(249,115,22,0.3); margin-top:8px;
        }

        .cc-cta:hover { background:#ea6c0a; transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,0.4); }
      `}</style>
        </div>
    );
}
