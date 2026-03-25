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
          padding: 40px 44px; width: 100%; box-sizing: border-box;
          display: flex; flex-direction: column; gap: 20px;
          animation: ccFade 0.4s ease forwards;
        }

        @keyframes ccFade {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }

        .cc-loading { display:flex; align-items:center; justify-content:center; height:100vh; }
        .cc-ring { width:36px; height:36px; border:3px solid var(--border); border-top-color:#f97316; border-radius:50%; animation:ccSpin 0.8s linear infinite; }
        @keyframes ccSpin { to { transform:rotate(360deg); } }

        /* Header */
        .cc-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
        .cc-title { font-family:'Syne',sans-serif; font-size:28px; font-weight:700; color:var(--text); letter-spacing:-0.5px; margin:0 0 4px; }
        .cc-sub { font-size:14px; color:var(--muted); margin:0; }

        /* Explainer */
        .cc-explainer {
          display:flex; align-items:stretch;
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:14px; padding:16px 24px; gap:0;
          flex-wrap: wrap;
        }

        .cc-exp-item {
          display:flex; align-items:flex-start; gap:12px; flex:1; min-width:180px;
          padding: 4px 16px 4px 0;
        }

        .cc-exp-dot {
          width:10px; height:10px; border-radius:50%; flex-shrink:0; margin-top:3px;
        }

        .cc-exp-label {
          display:block; font-size:13px; font-weight:700; color:var(--text); margin-bottom:3px;
        }

        .cc-exp-desc { font-size:11px; color:var(--muted); line-height:1.5; display:block; }

        .cc-exp-divider { width:1px; background:var(--border); margin:0 16px 0 0; align-self:stretch; }

        /* Stats bar */
        .cc-stats-bar {
          display:flex; background:var(--card-bg); border:1px solid var(--border);
          border-radius:14px; padding:16px 28px;
        }

        .cc-stat { display:flex; flex-direction:column; gap:3px; flex:1; align-items:center; }
        .cc-stat-val { font-family:'Syne',sans-serif; font-size:26px; font-weight:800; letter-spacing:-0.5px; }
        .cc-stat-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; text-align:center; }

        /* Filters */
        .cc-filters { display:flex; gap:6px; flex-wrap:wrap; }

        .cc-filter-btn {
          background:none; border:1px solid var(--border); border-radius:8px;
          padding:7px 14px; font-size:12px; font-weight:500; color:var(--muted);
          cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s;
        }

        .cc-filter-btn:hover { border-color:var(--muted); color:var(--text); }
        .cc-filter-btn.active { background:rgba(249,115,22,0.1); border-color:#f97316; color:#f97316; font-weight:600; }

        /* Card grid */
        .cc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px; }

        /* Card */
        .cc-card {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:16px; padding:20px;
          display:flex; flex-direction:column; gap:14px;
          cursor:pointer; transition:transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }

        .cc-card:hover {
          transform:translateY(-2px); box-shadow:0 8px 28px var(--shadow);
          border-color:rgba(249,115,22,0.25);
        }

        .cc-card-header { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }

        .cc-card-title-wrap { display:flex; flex-direction:column; gap:3px; }

        .cc-card-title {
          font-family:'Syne',sans-serif; font-size:16px; font-weight:700;
          color:var(--text); margin:0;
        }

        .cc-hours { font-size:11px; color:var(--muted); }

        .cc-gap-badge {
          font-size:10px; font-weight:700; padding:3px 10px;
          border-radius:99px; text-transform:capitalize;
          white-space:nowrap; flex-shrink:0; letter-spacing:0.3px;
        }

        /* Gauges */
        .cc-gauges { display:flex; align-items:center; gap:20px; }

        .cc-gauge-wrap { position:relative; flex-shrink:0; }

        .cc-gauge-center {
          position:absolute; inset:0; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
        }

        .cc-conf-val {
          font-family:'Syne',sans-serif; font-size:18px; font-weight:800;
          letter-spacing:-0.5px; line-height:1;
        }

        .cc-gauge-label { font-size:9px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; }

        .cc-no-data { font-size:22px; color:var(--placeholder); }

        .cc-scores { display:flex; flex-direction:column; gap:6px; flex:1; }

        .cc-score-row { display:flex; align-items:center; gap:8px; }

        .cc-score-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

        .cc-score-label { font-size:12px; color:var(--muted); flex:1; }

        .cc-score-val { font-size:13px; font-weight:700; }

        .cc-gap-row {
          font-size:11px; font-weight:600; margin-top:4px;
          padding:5px 8px; border-radius:6px;
          background: rgba(128,128,128,0.08);
        }

        /* Sparkline */
        .cc-sparkline-row {
          display:flex; align-items:center; justify-content:space-between;
          padding-top:10px; border-top:1px solid var(--border);
        }

        .cc-sparkline-label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; }

        /* Empty */
        .cc-empty {
          display:flex; flex-direction:column; align-items:center;
          justify-content:center; gap:14px; text-align:center; padding:80px 20px;
        }

        .cc-empty-icon { font-size:52px; color:var(--border); }

        .cc-empty h2 {
          font-family:'Syne',sans-serif; font-size:22px; font-weight:700;
          color:var(--text); margin:0;
        }

        .cc-empty p { font-size:14px; color:var(--muted); max-width:440px; margin:0; }

        .cc-cta {
          background:#f97316; color:white; border:none;
          border-radius:10px; padding:11px 22px;
          font-size:14px; font-weight:600; font-family:'DM Sans',sans-serif;
          cursor:pointer; transition:all 0.2s;
          box-shadow:0 4px 14px rgba(249,115,22,0.3);
        }

        .cc-cta:hover { background:#ea6c0a; transform:translateY(-1px); }
      `}</style>
        </div>
    );
}