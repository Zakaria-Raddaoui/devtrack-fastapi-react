import React, { useEffect, useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import api from '../api/axios';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStreak(logs) {
    if (!logs.length) return { current: 0, longest: 0 };
    const days = new Set(logs.map(l => {
        const d = new Date(l.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }));
    const sorted = [...days].sort();

    // Longest streak
    let longest = 1, cur = 1;
    for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diff === 1) { cur++; longest = Math.max(longest, cur); }
        else cur = 1;
    }

    // Current streak
    let current = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (days.has(key)) current++;
        else if (i > 0) break;
    }

    return { current, longest };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b'];

// ─── Heatmap ─────────────────────────────────────────────────────────────────

function YearHeatmap({ logs }) {
    const today = new Date();
    const yearAgo = new Date(today);
    yearAgo.setFullYear(today.getFullYear() - 1);

    // Build map of date → minutes
    const minutesByDay = {};
    logs.forEach(l => {
        const d = new Date(l.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        minutesByDay[key] = (minutesByDay[key] || 0) + l.time_spent;
    });

    // Build weeks array
    const weeks = [];
    const start = new Date(yearAgo);
    start.setDate(start.getDate() - start.getDay()); // align to Sunday

    for (let w = 0; w < 53; w++) {
        const week = [];
        for (let d = 0; d < 7; d++) {
            const date = new Date(start);
            date.setDate(start.getDate() + w * 7 + d);
            if (date > today) { week.push(null); continue; }
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const mins = minutesByDay[key] || 0;
            const intensity = mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 120 ? 3 : 4;
            week.push({ date, key, mins, intensity });
        }
        weeks.push(week);
    }

    // Month labels
    const monthLabels = [];
    weeks.forEach((week, wi) => {
        const first = week.find(d => d);
        if (first && first.date.getDate() <= 7) {
            monthLabels.push({ wi, label: MONTHS[first.date.getMonth()] });
        }
    });

    const intensityColor = (i) => {
        if (i === 0) return 'var(--border)';
        if (i === 1) return 'rgba(249,115,22,0.25)';
        if (i === 2) return 'rgba(249,115,22,0.5)';
        if (i === 3) return 'rgba(249,115,22,0.75)';
        return '#f97316';
    };

    const [hovered, setHovered] = useState(null);

    return (
        <div className="an-heatmap-wrap">
            <div className="an-heatmap-months">
                {monthLabels.map(({ wi, label }) => (
                    <div key={wi} className="an-month-label" style={{ gridColumn: wi + 1 }}>{label}</div>
                ))}
            </div>
            <div className="an-heatmap-body">
                <div className="an-day-labels">
                    {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
                        <div key={i} className="an-day-label">{d}</div>
                    ))}
                </div>
                <div className="an-heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 16px)` }}>
                    {weeks.map((week, wi) =>
                        week.map((day, di) => (
                            <div
                                key={`${wi}-${di}`}
                                className="an-heat-cell"
                                style={{ background: day ? intensityColor(day.intensity) : 'transparent', gridRow: di + 1, gridColumn: wi + 1 }}
                                onMouseEnter={() => day && setHovered(day)}
                                onMouseLeave={() => setHovered(null)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Tooltip */}
            {hovered && (
                <div className="an-heat-tooltip">
                    {hovered.mins > 0
                        ? `${(hovered.mins / 60).toFixed(1)}h on ${hovered.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : `No activity on ${hovered.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    }
                </div>
            )}

            <div className="an-heat-legend">
                <span className="an-legend-label">Less</span>
                {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="an-legend-cell" style={{ background: intensityColor(i) }} />
                ))}
                <span className="an-legend-label">More</span>
            </div>
        </div>
    );
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

const ChartTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="an-tooltip">
            <p className="an-tip-label">{label}</p>
            <p className="an-tip-val">{payload[0].value}h</p>
        </div>
    );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Analytics() {
    const [logs, setLogs] = useState([]);
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([api.get('/logs/'), api.get('/topics/?limit=100')])
            .then(([l, t]) => { setLogs(l.data); setTopics(t.data); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const stats = useMemo(() => {
        if (!logs.length) return null;

        const totalMins = logs.reduce((s, l) => s + l.time_spent, 0);
        const totalHours = (totalMins / 60).toFixed(1);
        const { current: streakCurrent, longest: streakLongest } = computeStreak(logs);

        // Hours per topic
        const topicMins = {};
        logs.forEach(l => {
            if (l.topic_id) topicMins[l.topic_id] = (topicMins[l.topic_id] || 0) + l.time_spent;
        });

        const topicData = topics
            .map(t => ({ name: t.title, hours: parseFloat(((topicMins[t.id] || 0) / 60).toFixed(1)) }))
            .filter(t => t.hours > 0)
            .sort((a, b) => b.hours - a.hours);

        // Hours by day of week
        const dowMins = Array(7).fill(0);
        const dowCount = Array(7).fill(0);
        logs.forEach(l => {
            const dow = new Date(l.date).getDay();
            dowMins[dow] += l.time_spent;
            dowCount[dow] += 1;
        });
        const dowData = DAYS.map((d, i) => ({
            day: d,
            hours: parseFloat((dowMins[i] / 60).toFixed(1)),
            avg: dowCount[i] ? parseFloat((dowMins[i] / dowCount[i] / 60).toFixed(1)) : 0,
        }));

        // Monthly hours (last 12 months)
        const monthlyMins = {};
        logs.forEach(l => {
            const d = new Date(l.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyMins[key] = (monthlyMins[key] || 0) + l.time_spent;
        });
        const monthlyData = Object.entries(monthlyMins)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12)
            .map(([key, mins]) => {
                const [year, month] = key.split('-');
                return { month: `${MONTHS[parseInt(month) - 1]} ${year.slice(2)}`, hours: parseFloat((mins / 60).toFixed(1)) };
            });

        // This week vs last week
        const now = new Date();
        const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
        const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);

        const thisWeekMins = logs.filter(l => new Date(l.date) >= weekStart).reduce((s, l) => s + l.time_spent, 0);
        const lastWeekMins = logs.filter(l => {
            const d = new Date(l.date);
            return d >= lastWeekStart && d < weekStart;
        }).reduce((s, l) => s + l.time_spent, 0);

        // This month
        const thisMonthMins = logs.filter(l => {
            const d = new Date(l.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((s, l) => s + l.time_spent, 0);

        // Active days
        const activeDays = new Set(logs.map(l => {
            const d = new Date(l.date);
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        })).size;

        // Best day of week
        const bestDow = dowData.reduce((best, d) => d.hours > best.hours ? d : best, dowData[0]);

        return {
            totalHours, streakCurrent, streakLongest,
            topicData, dowData, monthlyData,
            thisWeekHours: (thisWeekMins / 60).toFixed(1),
            lastWeekHours: (lastWeekMins / 60).toFixed(1),
            thisMonthHours: (thisMonthMins / 60).toFixed(1),
            activeDays, bestDow,
            avgSessionMins: Math.round(totalMins / logs.length),
            totalSessions: logs.length,
        };
    }, [logs, topics]);

    if (loading) return (
        <div className="an-loading"><div className="an-ring" /></div>
    );

    if (!logs.length) return (
        <div className="an-root">
            <div className="an-header">
                <div>
                    <h1 className="an-title">Analytics</h1>
                    <p className="an-sub">Your learning data, visualized</p>
                </div>
            </div>
            <div className="an-empty">
                <div className="an-empty-icon">📊</div>
                <h2 className="an-empty-title">No data yet</h2>
                <p className="an-empty-sub">Start logging your learning sessions to see analytics here.</p>
            </div>
            <style>{`
        .an-root {
          padding: 40px 44px; width: 100%; box-sizing: border-box;
          display: flex; flex-direction: column; gap: 20px;
          animation: anFade 0.4s ease forwards;
        }
        @keyframes anFade {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .an-header { display:flex; align-items:flex-start; justify-content:space-between; }
        .an-title {
          font-family:var(--font-heading); font-size:28px; font-weight:700;
          color:var(--text); letter-spacing:-0.5px; margin:0 0 4px;
        }
        .an-sub { font-size:14px; color:var(--muted); margin:0; }
        .an-empty {
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          gap:16px; text-align:center; padding:80px 20px;
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:16px;
        }
        .an-empty-icon { font-size:56px; }
        .an-empty-title {
          font-family:var(--font-heading); font-size:22px; font-weight:700; color:var(--text); margin:0;
        }
        .an-empty-sub { font-size:14px; color:var(--muted); margin:0; }
      `}</style>
        </div>
    );

    const weekTrend = stats.thisWeekHours > stats.lastWeekHours ? 'up' : stats.thisWeekHours < stats.lastWeekHours ? 'down' : 'same';

    return (
        <div className="an-root">
            {/* Header */}
            <div className="an-header">
                <div>
                    <h1 className="an-title">Analytics</h1>
                    <p className="an-sub">Your learning data, visualized</p>
                </div>
            </div>

            {/* Summary stats */}
            <div className="an-stats-grid">
                {[
                    { label: 'Total hours', val: `${stats.totalHours}h`, color: '#f97316', icon: '⏱' },
                    { label: 'Total sessions', val: stats.totalSessions, color: '#3b82f6', icon: '📝' },
                    { label: 'Active days', val: stats.activeDays, color: '#22c55e', icon: '📅' },
                    { label: 'Avg session', val: `${stats.avgSessionMins}m`, color: '#a855f7', icon: '⚡' },
                    { label: 'Current streak', val: `${stats.streakCurrent}d`, color: '#f97316', icon: '🔥' },
                    { label: 'Longest streak', val: `${stats.streakLongest}d`, color: '#ec4899', icon: '🏆' },
                    { label: 'This month', val: `${stats.thisMonthHours}h`, color: '#14b8a6', icon: '🗓' },
                    { label: 'This week', val: `${stats.thisWeekHours}h`, color: '#f59e0b', icon: weekTrend === 'up' ? '↑' : weekTrend === 'down' ? '↓' : '→' },
                ].map(({ label, val, color, icon }) => (
                    <div key={label} className="an-stat-card" style={{ '--c': color }}>
                        <span className="an-stat-icon">{icon}</span>
                        <div>
                            <p className="an-stat-val" style={{ color }}>{val}</p>
                            <p className="an-stat-label">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Year heatmap */}
            <div className="an-card">
                <div className="an-card-header">
                    <h2 className="an-card-title">Activity heatmap</h2>
                    <span className="an-card-sub">Last 12 months · {stats.activeDays} active days</span>
                </div>
                <YearHeatmap logs={logs} />
            </div>

            {/* Monthly + Day of week */}
            <div className="an-row">
                <div className="an-card">
                    <div className="an-card-header">
                        <h2 className="an-card-title">Hours per month</h2>
                        <span className="an-card-sub">Last 12 months</span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={stats.monthlyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTip />} />
                            <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={32}>
                                {stats.monthlyData.map((_, i) => (
                                    <Cell key={i} fill="#f97316" fillOpacity={i === stats.monthlyData.length - 1 ? 1 : 0.5} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="an-card">
                    <div className="an-card-header">
                        <h2 className="an-card-title">Best days to learn</h2>
                        <span className="an-card-sub">
                            Best: <strong style={{ color: '#f97316' }}>{stats.bestDow.day}</strong>
                        </span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={stats.dowData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTip />} />
                            <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={36}>
                                {stats.dowData.map((d, i) => (
                                    <Cell key={i}
                                        fill={d.day === stats.bestDow.day ? '#f97316' : '#3b82f6'}
                                        fillOpacity={d.day === stats.bestDow.day ? 1 : 0.5}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Topic breakdown */}
            {stats.topicData.length > 0 && (
                <div className="an-row">
                    <div className="an-card">
                        <div className="an-card-header">
                            <h2 className="an-card-title">Hours by topic</h2>
                            <span className="an-card-sub">{stats.topicData.length} topics</span>
                        </div>
                        <ResponsiveContainer width="100%" height={Math.max(180, stats.topicData.length * 38)}>
                            <BarChart data={stats.topicData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" width={120}
                                    tick={{ fontSize: 12, fill: 'var(--text)', fontWeight: 500 }}
                                    axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'var(--hover-bg)' }}
                                    content={({ active, payload }) => active && payload?.length ? (
                                        <div className="an-tooltip">
                                            <p className="an-tip-label">{payload[0].payload.name}</p>
                                            <p className="an-tip-val">{payload[0].value}h</p>
                                        </div>
                                    ) : null}
                                />
                                <Bar dataKey="hours" radius={[0, 6, 6, 0]} maxBarSize={20}>
                                    {stats.topicData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {stats.topicData.length >= 2 && (
                        <div className="an-card an-card-center">
                            <div className="an-card-header">
                                <h2 className="an-card-title">Time distribution</h2>
                                <span className="an-card-sub">By topic</span>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={stats.topicData}
                                        dataKey="hours"
                                        nameKey="name"
                                        cx="50%" cy="50%"
                                        innerRadius={55} outerRadius={85}
                                        paddingAngle={3}
                                    >
                                        {stats.topicData.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.9} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        content={({ active, payload }) => active && payload?.length ? (
                                            <div className="an-tooltip">
                                                <p className="an-tip-label">{payload[0].name}</p>
                                                <p className="an-tip-val">{payload[0].value}h</p>
                                            </div>
                                        ) : null}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="an-pie-legend">
                                {stats.topicData.slice(0, 5).map((t, i) => (
                                    <div key={i} className="an-pie-legend-item">
                                        <div className="an-pie-dot" style={{ background: COLORS[i % COLORS.length] }} />
                                        <span className="an-pie-name">{t.name}</span>
                                        <span className="an-pie-val">{t.hours}h</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Week comparison */}
            <div className="an-comparison-card">
                <h2 className="an-card-title" style={{ marginBottom: 16 }}>This week vs last week</h2>
                <div className="an-comparison-row">
                    <div className="an-comparison-item">
                        <span className="an-comparison-label">This week</span>
                        <span className="an-comparison-val" style={{ color: '#f97316' }}>{stats.thisWeekHours}h</span>
                    </div>
                    <div className="an-comparison-bar-wrap">
                        <div className="an-comparison-bars">
                            <div className="an-comparison-bar-label">Last</div>
                            <div className="an-cbar-bg">
                                <div className="an-cbar-fill" style={{
                                    width: `${stats.lastWeekHours > 0 ? 100 : 0}%`,
                                    background: '#3b82f6',
                                    opacity: 0.6,
                                }} />
                            </div>
                            <span className="an-cbar-val">{stats.lastWeekHours}h</span>
                        </div>
                        <div className="an-comparison-bars">
                            <div className="an-comparison-bar-label">This</div>
                            <div className="an-cbar-bg">
                                <div className="an-cbar-fill" style={{
                                    width: `${parseFloat(stats.thisWeekHours) > 0
                                        ? Math.min(100, (parseFloat(stats.thisWeekHours) / Math.max(parseFloat(stats.lastWeekHours), parseFloat(stats.thisWeekHours))) * 100)
                                        : 0}%`,
                                    background: '#f97316',
                                }} />
                            </div>
                            <span className="an-cbar-val">{stats.thisWeekHours}h</span>
                        </div>
                    </div>
                    <div className="an-comparison-item">
                        <span className="an-comparison-label">Last week</span>
                        <span className="an-comparison-val" style={{ color: '#3b82f6' }}>{stats.lastWeekHours}h</span>
                    </div>
                </div>
                {weekTrend !== 'same' && (
                    <p className="an-comparison-trend" style={{ color: weekTrend === 'up' ? '#22c55e' : '#ef4444' }}>
                        {weekTrend === 'up'
                            ? `↑ ${(parseFloat(stats.thisWeekHours) - parseFloat(stats.lastWeekHours)).toFixed(1)}h more than last week — great work!`
                            : `↓ ${(parseFloat(stats.lastWeekHours) - parseFloat(stats.thisWeekHours)).toFixed(1)}h less than last week — time to push!`
                        }
                    </p>
                )}
            </div>

            <style>{`
        .an-root {
          padding: 60px 48px; width: 100%; box-sizing: border-box;
          display: flex; flex-direction: column; gap: 40px;
          animation: anFade 0.4s ease forwards;
          background: var(--bg);
        }

        @keyframes anFade {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }

        .an-loading {
          display:flex; align-items:center; justify-content:center; height:100vh;
        }

        .an-ring {
          width:48px; height:48px; border:4px solid var(--border);
          border-top-color:#f97316; border-radius:50%;
          animation:anSpin 0.8s linear infinite;
        }

        @keyframes anSpin { to { transform:rotate(360deg); } }

        .an-header {
          display:flex; align-items:flex-end;
          justify-content:space-between; gap:24px;
        }

        .an-title {
          font-family:var(--font-heading); font-size:38px; font-weight:800;
          color:var(--text); letter-spacing:-1.5px; margin:0 0 6px;
        }

        .an-sub { font-size:15px; color:var(--muted); margin:0; font-weight:500; }

        /* Empty */
        .an-empty {
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          gap:16px; text-align:center; padding:100px 20px;
        }

        .an-empty-icon { font-size:64px; color: var(--border); }
        .an-empty-title {
          font-family:var(--font-heading); font-size:24px; font-weight:800; color:var(--text); margin:0;
        }
        .an-empty-sub { font-size:16px; color:var(--muted); }

        /* Stat cards */
        .an-stats-grid {
          display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
          gap:24px;
        }

        .an-stat-card {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:24px; padding:24px;
          display:flex; align-items:center; gap:20px;
          border-left:none;
          transition:all 0.3s cubic-bezier(0.16,1,0.3,1); box-shadow:0 12px 32px var(--shadow), 0 4px 12px rgba(0,0,0,0.02);
          position:relative; overflow:hidden;
        }
        
        .an-stat-card::before {
          content:''; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--c);
        }

        .an-stat-card:hover { transform:translateY(-4px); box-shadow:0 16px 40px var(--shadow); border-color: color-mix(in srgb, var(--c) 30%, transparent); }

        .an-stat-icon { font-size:28px; flex-shrink:0; background: color-mix(in srgb, var(--c) 10%, transparent); width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 16px; }

        .an-stat-val {
          font-family:var(--font-heading); font-size:28px; font-weight:800;
          letter-spacing:-1px; line-height:1; margin:0 0 6px;
        }

        .an-stat-label {
          font-size:12px; color:var(--muted); font-weight:700;
          text-transform:uppercase; letter-spacing:0.5px; font-family:var(--font-heading);
        }

        /* Cards */
        .an-card {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius: 24px; padding: 32px; box-shadow: 0 12px 32px var(--shadow); transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
          display:flex; flex-direction:column; gap:24px;
        }
        .an-card:hover { box-shadow: 0 16px 40px var(--shadow); transform:translateY(-2px); }

        .an-card-center { align-items:stretch; }

        .an-card-header {
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;
        }

        .an-card-title {
          font-family:var(--font-heading); font-size:20px; font-weight:800;
          color:var(--text); margin:0; letter-spacing:-0.5px;
        }

        .an-card-sub { font-size:14px; color:var(--muted); font-weight:600; }

        .an-row {
          display:grid; grid-template-columns:1fr 1fr; gap:32px;
        }
        
        @media (max-width: 900px) { .an-row { grid-template-columns: 1fr; } }

        /* Heatmap */
        .an-heatmap-wrap {
          display:flex; flex-direction:column; gap:12px; overflow-x:auto; padding-bottom:16px;
        }

        .an-heatmap-months {
          display:grid;
          grid-template-columns:repeat(53,16px);
          gap:4px; margin-left:36px;
        }

        .an-month-label {
          font-size:12px; color:var(--muted); font-weight:600;
        }

        .an-heatmap-body {
          display:flex; gap:8px;
        }

        .an-day-labels {
          display:grid; grid-template-rows:repeat(7,16px);
          gap:4px;
        }

        .an-day-label {
          font-size:11px; color:var(--muted); line-height:16px;
          text-align:right; width:28px; font-weight:500;
        }

        .an-heatmap-grid {
          display:grid; grid-template-rows:repeat(7,16px);
          gap:4px;
        }

        .an-heat-cell {
          width:16px; height:16px; border-radius:4px;
          transition:all 0.2s cubic-bezier(0.16,1,0.3,1);
          cursor:default;
        }

        .an-heat-cell:hover { transform:scale(1.4); z-index:1; box-shadow:0 4px 12px rgba(249,115,22,0.3); border-radius:2px; }

        .an-heat-tooltip {
          font-size:13px; color:var(--text); font-weight:600;
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:12px; padding:8px 16px;
          display:inline-block; align-self:flex-start; box-shadow:0 8px 24px var(--shadow);
        }

        .an-heat-legend {
          display:flex; align-items:center; gap:6px;
          align-self:flex-end; margin-top:8px;
        }

        .an-legend-label { font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }

        .an-legend-cell {
          width:16px; height:16px; border-radius:4px;
        }

        /* Tooltip */
        .an-tooltip {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:16px; padding:12px 20px;
          box-shadow:0 12px 32px var(--shadow);
        }

        .an-tip-label { font-size:12px; color:var(--muted); margin-bottom:6px; font-weight:600; }
        .an-tip-val {
          font-size:22px; font-weight:800; color:#f97316;
          font-family:var(--font-heading); letter-spacing:-0.5px;
        }

        /* Pie legend */
        .an-pie-legend {
          display:flex; flex-direction:column; gap:10px; margin-top:8px;
        }

        .an-pie-legend-item {
          display:flex; align-items:center; gap:12px;
        }

        .an-pie-dot {
          width:12px; height:12px; border-radius:50%; flex-shrink:0; box-shadow:0 2px 4px rgba(0,0,0,0.1);
        }

        .an-pie-name {
          flex:1; font-size:14px; color:var(--text); font-weight:500;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }

        .an-pie-val {
          font-size:14px; font-weight:800; color:var(--muted); font-family:var(--font-heading);
        }

        /* Week comparison */
        .an-comparison-card {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius: 24px; padding: 32px; box-shadow: 0 12px 32px var(--shadow); transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
        }

        .an-comparison-row {
          display:flex; align-items:center; gap:32px; flex-wrap:wrap;
        }

        .an-comparison-item {
          display:flex; flex-direction:column; gap:8px;
          align-items:center; flex-shrink:0;
        }

        .an-comparison-label { font-size:12px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; font-family:var(--font-heading); }

        .an-comparison-val {
          font-family:var(--font-heading); font-size:36px; font-weight:800; letter-spacing:-1.5px;
        }

        .an-comparison-bar-wrap {
          flex:1; display:flex; flex-direction:column; gap:16px; min-width:200px;
        }

        .an-comparison-bars { display:flex; align-items:center; gap:12px; }

        .an-comparison-bar-label { font-size:13px; color:var(--muted); width:40px; font-weight:600; }

        .an-cbar-bg {
          flex:1; height:12px; border-radius:99px;
          background:var(--border); overflow:hidden; box-shadow:inset 0 1px 3px rgba(0,0,0,0.1);
        }

        .an-cbar-fill {
          height:100%; border-radius:99px;
          transition:width 0.8s cubic-bezier(0.16,1,0.3,1); box-shadow:0 2px 4px rgba(0,0,0,0.1);
        }

        .an-cbar-val { font-size:13px; font-weight:800; color:var(--muted); width:40px; font-family:var(--font-heading); }

        .an-comparison-trend {
          font-size:15px; font-weight:700; margin-top:24px; font-family:var(--font-body);
        }
      `}</style>
        </div>
    );
}
