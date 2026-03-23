import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import api from '../api/axios';

const DOMAIN_LABELS = {
    frontend: 'Frontend',
    backend: 'Backend',
    devops: 'DevOps',
    database: 'Database',
    ai_ml: 'AI / ML',
    networking: 'Networking',
    security: 'Security',
    cs_fundamentals: 'CS Fundamentals',
    other: 'Other',
};

export default function KnowledgeGraph() {
    const svgRef = useRef(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hovered, setHovered] = useState(null);
    const [filter, setFilter] = useState('all'); // domain filter
    const [showMissing, setShowMissing] = useState(true);
    const simRef = useRef(null);

    useEffect(() => {
        api.get('/graph/data')
            .then(res => setData(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const buildGraph = useCallback(() => {
        if (!data || !svgRef.current) return;

        const container = svgRef.current.parentElement;
        const W = container.clientWidth;
        const H = container.clientHeight;

        // Filter nodes by domain
        const filteredNodes = filter === 'all'
            ? data.nodes
            : data.nodes.filter(n => n.domain === filter);
        const filteredIds = new Set(filteredNodes.map(n => n.id));
        const filteredEdges = data.edges.filter(
            e => filteredIds.has(e.source) && filteredIds.has(e.target)
        );

        // Clear previous
        d3.select(svgRef.current).selectAll('*').remove();

        const svg = d3.select(svgRef.current)
            .attr('width', W)
            .attr('height', H);

        // Defs — arrowhead + glow filter
        const defs = svg.append('defs');
        const filter_glow = defs.append('filter').attr('id', 'glow');
        filter_glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
        const feMerge = filter_glow.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        // Zoom
        const g = svg.append('g');
        const zoom = d3.zoom()
            .scaleExtent([0.3, 3])
            .on('zoom', e => g.attr('transform', e.transform));
        svg.call(zoom);

        // Clone nodes/edges for d3 mutation
        const nodes = filteredNodes.map(n => ({ ...n }));
        const edges = filteredEdges.map(e => ({ ...e }));

        // Size scale
        const sizeScale = d3.scaleSqrt()
            .domain([0, d3.max(nodes, n => n.weight) || 1])
            .range([6, 26]);

        // Force simulation
        const sim = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(edges)
                .id(d => d.id)
                .distance(d => 80 + (1 - (d.strength || 0.3)) * 40)
                .strength(d => Math.min(1, (d.strength || 0.3) * 0.5))
            )
            .force('charge', d3.forceManyBody().strength(-180))
            .force('center', d3.forceCenter(W / 2, H / 2))
            .force('collision', d3.forceCollide().radius(d => sizeScale(d.weight) + 8));

        simRef.current = sim;

        // Edges
        const link = g.append('g').selectAll('line')
            .data(edges)
            .join('line')
            .attr('stroke', d => {
                const src = nodes.find(n => n.id === (d.source.id || d.source));
                return src ? src.color + '55' : '#ffffff22';
            })
            .attr('stroke-width', d => Math.max(0.5, (d.strength || 0.3) * 2))
            .attr('stroke-dasharray', d => (d.strength || 0) < 0.5 ? '4,4' : null);

        // Node groups
        const node = g.append('g').selectAll('g')
            .data(nodes)
            .join('g')
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', (e, d) => {
                    if (!e.active) sim.alphaTarget(0.3).restart();
                    d.fx = d.x; d.fy = d.y;
                })
                .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
                .on('end', (e, d) => {
                    if (!e.active) sim.alphaTarget(0);
                    d.fx = null; d.fy = null;
                })
            )
            .on('mouseenter', (e, d) => setHovered(d))
            .on('mouseleave', () => setHovered(null));

        // Outer glow ring for topic nodes
        node.filter(d => d.is_topic)
            .append('circle')
            .attr('r', d => sizeScale(d.weight) + 4)
            .attr('fill', 'none')
            .attr('stroke', d => d.color)
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.3)
            .attr('filter', 'url(#glow)');

        // Main circle
        node.append('circle')
            .attr('r', d => sizeScale(d.weight))
            .attr('fill', d => d.color + (d.is_topic ? 'dd' : '88'))
            .attr('stroke', d => d.color)
            .attr('stroke-width', d => d.is_topic ? 2 : 1)
            .attr('filter', d => d.is_topic ? 'url(#glow)' : null);

        // Status ring for mastered topics
        node.filter(d => d.status === 'mastered')
            .append('circle')
            .attr('r', d => sizeScale(d.weight) + 2)
            .attr('fill', 'none')
            .attr('stroke', '#22c55e')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,2');

        // Labels
        node.append('text')
            .attr('dy', d => sizeScale(d.weight) + 12)
            .attr('text-anchor', 'middle')
            .attr('font-size', d => d.is_topic ? 11 : 9)
            .attr('font-weight', d => d.is_topic ? '700' : '400')
            .attr('fill', 'var(--text, #f0ede8)')
            .attr('font-family', 'DM Sans, sans-serif')
            .attr('pointer-events', 'none')
            .text(d => d.label.length > 14 ? d.label.slice(0, 12) + '…' : d.label);

        // Tick
        sim.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        // Initial zoom to fit
        setTimeout(() => {
            svg.call(zoom.transform, d3.zoomIdentity.translate(W / 4, H / 4).scale(0.85));
        }, 600);

    }, [data, filter]);

    useEffect(() => { buildGraph(); }, [buildGraph]);

    // Handle resize
    useEffect(() => {
        const observer = new ResizeObserver(() => buildGraph());
        if (svgRef.current?.parentElement) observer.observe(svgRef.current.parentElement);
        return () => observer.disconnect();
    }, [buildGraph]);

    if (loading) return (
        <div className="kg-loading"><div className="kg-ring" /></div>
    );

    if (!data || data.nodes.length === 0) return (
        <div className="kg-root">
            <div className="kg-header">
                <h1 className="kg-title">Knowledge Graph</h1>
                <p className="kg-sub">Your personal map of concepts and connections</p>
            </div>
            <div className="kg-empty">
                <div className="kg-empty-icon">◈</div>
                <h2>No knowledge mapped yet</h2>
                <p>Add topics, write logs and notes — your knowledge graph will build itself automatically.</p>
            </div>
            <style>{KG_STYLES}</style>
        </div>
    );

    return (
        <div className="kg-root">
            {/* Header */}
            <div className="kg-header">
                <div>
                    <h1 className="kg-title">Knowledge Graph</h1>
                    <p className="kg-sub">
                        {data.stats.total_nodes} concepts · {data.stats.total_edges} connections · {data.stats.domains} domains
                    </p>
                </div>
                <div className="kg-header-actions">
                    <select className="kg-filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
                        <option value="all">All domains</option>
                        {data.clusters.map(c => (
                            <option key={c.domain} value={c.domain}>{c.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="kg-body">
                {/* Graph canvas */}
                <div className="kg-canvas-wrap">
                    <svg ref={svgRef} className="kg-svg" />

                    {/* Hover tooltip */}
                    {hovered && (
                        <div className="kg-tooltip">
                            <div className="kg-tip-header">
                                <span className="kg-tip-dot" style={{ background: hovered.color }} />
                                <span className="kg-tip-label">{hovered.label}</span>
                                {hovered.is_topic && <span className="kg-tip-badge">Your topic</span>}
                            </div>
                            <div className="kg-tip-rows">
                                <div className="kg-tip-row">
                                    <span>Domain</span>
                                    <span style={{ color: hovered.color }}>{DOMAIN_LABELS[hovered.domain] || hovered.domain}</span>
                                </div>
                                {hovered.hours > 0 && (
                                    <div className="kg-tip-row">
                                        <span>Time logged</span>
                                        <span>{hovered.hours}h</span>
                                    </div>
                                )}
                                {hovered.status && (
                                    <div className="kg-tip-row">
                                        <span>Status</span>
                                        <span>{hovered.status.replace('_', ' ')}</span>
                                    </div>
                                )}
                                <div className="kg-tip-row">
                                    <span>Relevance</span>
                                    <span>{'●'.repeat(Math.min(5, Math.ceil(hovered.weight / 2)))}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Legend */}
                    <div className="kg-legend">
                        <div className="kg-legend-title">Legend</div>
                        <div className="kg-legend-item">
                            <div className="kg-legend-circle solid" />
                            <span>Your topic</span>
                        </div>
                        <div className="kg-legend-item">
                            <div className="kg-legend-circle faded" />
                            <span>Related concept</span>
                        </div>
                        <div className="kg-legend-item">
                            <div className="kg-legend-line solid" />
                            <span>Strong link</span>
                        </div>
                        <div className="kg-legend-item">
                            <div className="kg-legend-line dashed" />
                            <span>Domain link</span>
                        </div>
                    </div>

                    {/* Zoom hint */}
                    <div className="kg-zoom-hint">Scroll to zoom · Drag to pan · Drag nodes to rearrange</div>
                </div>

                {/* Sidebar */}
                <div className="kg-sidebar">

                    {/* Domain clusters */}
                    <div className="kg-panel">
                        <h3 className="kg-panel-title">Domains you're learning</h3>
                        <div className="kg-clusters">
                            {data.clusters.map(c => (
                                <button
                                    key={c.domain}
                                    className={`kg-cluster-btn ${filter === c.domain ? 'active' : ''}`}
                                    style={{ '--c': c.color }}
                                    onClick={() => setFilter(filter === c.domain ? 'all' : c.domain)}
                                >
                                    <div className="kg-cluster-dot" style={{ background: c.color }} />
                                    <span className="kg-cluster-label">{c.label}</span>
                                    <span className="kg-cluster-count">{c.count}</span>
                                </button>
                            ))}
                            {filter !== 'all' && (
                                <button className="kg-clear-filter" onClick={() => setFilter('all')}>
                                    ✕ Clear filter
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Missing prerequisites */}
                    {data.missing_prereqs.length > 0 && (
                        <div className="kg-panel">
                            <div className="kg-panel-header">
                                <h3 className="kg-panel-title">⚠ Missing prerequisites</h3>
                                <button
                                    className="kg-toggle-btn"
                                    onClick={() => setShowMissing(s => !s)}
                                >{showMissing ? '↑' : '↓'}</button>
                            </div>
                            <p className="kg-panel-sub">
                                Concepts you're using without their foundations
                            </p>
                            {showMissing && (
                                <div className="kg-missing-list">
                                    {data.missing_prereqs.map((m, i) => (
                                        <div key={i} className={`kg-missing-item ${m.severity}`}>
                                            <div className="kg-missing-icon">
                                                {m.severity === 'warning' ? '⚠' : 'ℹ'}
                                            </div>
                                            <div className="kg-missing-text">
                                                <span className="kg-missing-topic">{m.topic}</span>
                                                <span className="kg-missing-desc">
                                                    needs <strong>{m.missing}</strong> first
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Hovered node details */}
                    {hovered && (
                        <div className="kg-panel kg-node-detail">
                            <h3 className="kg-panel-title" style={{ color: hovered.color }}>
                                {hovered.label}
                            </h3>
                            <div className="kg-detail-rows">
                                <div className="kg-detail-row">
                                    <span>Domain</span>
                                    <span>{DOMAIN_LABELS[hovered.domain] || hovered.domain}</span>
                                </div>
                                {hovered.hours > 0 && (
                                    <div className="kg-detail-row">
                                        <span>Hours logged</span>
                                        <span style={{ color: '#f97316', fontWeight: 600 }}>{hovered.hours}h</span>
                                    </div>
                                )}
                                {hovered.status && (
                                    <div className="kg-detail-row">
                                        <span>Status</span>
                                        <span>{hovered.status.replace('_', ' ')}</span>
                                    </div>
                                )}
                                {PREREQUISITES[hovered.id] && (
                                    <div className="kg-detail-prereqs">
                                        <span className="kg-detail-label">Prerequisites</span>
                                        <div className="kg-prereq-tags">
                                            {PREREQUISITES[hovered.id].map(p => (
                                                <span key={p} className="kg-prereq-tag">{p}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{KG_STYLES}</style>
        </div>
    );
}

// Prerequisite map for frontend display
const PREREQUISITES = {
    "kubernetes": ["docker", "networking", "linux"],
    "docker": ["linux", "networking"],
    "react": ["javascript", "html", "css"],
    "nextjs": ["react", "javascript"],
    "angular": ["typescript", "javascript"],
    "typescript": ["javascript"],
    "fastapi": ["python", "rest"],
    "tensorflow": ["python", "machine learning"],
    "aws": ["linux", "networking"],
    "helm": ["kubernetes", "docker"],
    "postgresql": ["sql", "database"],
    "jwt": ["authentication", "security"],
};

const KG_STYLES = `
  .kg-root {
    display: flex; flex-direction: column;
    height: 100vh; width: 100%;
    box-sizing: border-box; overflow: hidden;
    animation: kgFade 0.4s ease forwards;
  }

  @keyframes kgFade {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }

  .kg-loading {
    display:flex; align-items:center; justify-content:center; height:100vh;
  }

  .kg-ring {
    width:36px; height:36px; border:3px solid var(--border);
    border-top-color:#f97316; border-radius:50%;
    animation:kgSpin 0.8s linear infinite;
  }

  @keyframes kgSpin { to { transform:rotate(360deg); } }

  /* Header */
  .kg-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:20px 28px 12px; flex-shrink:0;
    border-bottom:1px solid var(--border);
    gap:16px;
  }

  .kg-title {
    font-family:'Syne',sans-serif; font-size:22px; font-weight:700;
    color:var(--text); letter-spacing:-0.5px; margin:0 0 3px;
  }

  .kg-sub { font-size:12px; color:var(--muted); margin:0; }

  .kg-header-actions { display:flex; align-items:center; gap:10px; }

  .kg-filter-select {
    background:var(--card-bg); border:1px solid var(--border);
    border-radius:8px; padding:7px 12px; font-size:13px;
    color:var(--text); font-family:'DM Sans',sans-serif; outline:none;
    cursor:pointer; transition:border-color 0.2s;
  }

  .kg-filter-select:focus { border-color:#f97316; }

  /* Body */
  .kg-body {
    display:flex; flex:1; overflow:hidden;
  }

  /* Canvas */
  .kg-canvas-wrap {
    flex:1; position:relative; overflow:hidden;
    background:var(--bg);
  }

  .kg-svg { width:100%; height:100%; display:block; }

  /* Tooltip */
  .kg-tooltip {
    position:absolute; top:16px; left:16px;
    background:var(--card-bg); border:1px solid var(--border);
    border-radius:12px; padding:14px 16px;
    box-shadow:0 8px 32px rgba(0,0,0,0.3);
    min-width:180px; pointer-events:none;
    animation:kgFade 0.15s ease;
  }

  .kg-tip-header {
    display:flex; align-items:center; gap:8px; margin-bottom:10px;
  }

  .kg-tip-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }

  .kg-tip-label {
    font-family:'Syne',sans-serif; font-size:14px; font-weight:700;
    color:var(--text); flex:1;
  }

  .kg-tip-badge {
    font-size:9px; font-weight:700; background:rgba(249,115,22,0.15);
    color:#f97316; padding:2px 6px; border-radius:99px;
    text-transform:uppercase; letter-spacing:0.3px;
  }

  .kg-tip-rows { display:flex; flex-direction:column; gap:5px; }

  .kg-tip-row {
    display:flex; justify-content:space-between; gap:12px;
    font-size:12px;
  }

  .kg-tip-row span:first-child { color:var(--muted); }
  .kg-tip-row span:last-child { color:var(--text); font-weight:500; }

  /* Legend */
  .kg-legend {
    position:absolute; bottom:16px; left:16px;
    background:var(--card-bg); border:1px solid var(--border);
    border-radius:10px; padding:12px 14px;
    display:flex; flex-direction:column; gap:6px;
  }

  .kg-legend-title {
    font-size:10px; font-weight:700; color:var(--muted);
    text-transform:uppercase; letter-spacing:0.6px; margin-bottom:2px;
  }

  .kg-legend-item { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--muted); }

  .kg-legend-circle {
    width:12px; height:12px; border-radius:50%; flex-shrink:0;
  }

  .kg-legend-circle.solid { background:#f97316; border:2px solid #f97316; }
  .kg-legend-circle.faded { background:rgba(249,115,22,0.35); border:1px solid #f97316; }

  .kg-legend-line { width:20px; height:2px; flex-shrink:0; }
  .kg-legend-line.solid { background:#f97316; }
  .kg-legend-line.dashed {
    background:none;
    border-top:2px dashed #f9731666;
  }

  .kg-zoom-hint {
    position:absolute; bottom:16px; right:16px;
    font-size:10px; color:var(--placeholder);
    background:var(--card-bg); border:1px solid var(--border);
    border-radius:8px; padding:6px 10px;
  }

  /* Sidebar */
  .kg-sidebar {
    width:280px; min-width:280px;
    border-left:1px solid var(--border);
    overflow-y:auto; display:flex; flex-direction:column; gap:0;
  }

  .kg-panel {
    padding:18px 20px; border-bottom:1px solid var(--border);
  }

  .kg-panel-header {
    display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;
  }

  .kg-panel-title {
    font-family:'Syne',sans-serif; font-size:13px; font-weight:700;
    color:var(--text); margin:0 0 10px;
  }

  .kg-panel-sub { font-size:11px; color:var(--muted); margin:0 0 12px; }

  .kg-toggle-btn {
    background:none; border:none; color:var(--muted);
    cursor:pointer; font-size:14px; padding:2px 6px;
  }

  /* Clusters */
  .kg-clusters { display:flex; flex-direction:column; gap:4px; }

  .kg-cluster-btn {
    display:flex; align-items:center; gap:10px;
    background:none; border:1px solid transparent;
    border-radius:8px; padding:8px 10px;
    cursor:pointer; font-family:'DM Sans',sans-serif;
    transition:all 0.15s; text-align:left; width:100%;
  }

  .kg-cluster-btn:hover { background:var(--hover-bg); }

  .kg-cluster-btn.active {
    background:color-mix(in srgb, var(--c) 12%, transparent);
    border-color:color-mix(in srgb, var(--c) 40%, transparent);
  }

  .kg-cluster-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

  .kg-cluster-label { font-size:13px; color:var(--text); flex:1; font-weight:500; }

  .kg-cluster-count {
    font-size:11px; font-weight:700; color:var(--placeholder);
    background:var(--bg); border:1px solid var(--border);
    padding:1px 7px; border-radius:99px;
  }

  .kg-clear-filter {
    background:none; border:1px dashed var(--border); border-radius:8px;
    padding:6px 10px; font-size:11px; color:var(--muted);
    cursor:pointer; font-family:'DM Sans',sans-serif;
    transition:all 0.15s; margin-top:4px;
  }

  .kg-clear-filter:hover { border-color:#f97316; color:#f97316; }

  /* Missing prerequisites */
  .kg-missing-list { display:flex; flex-direction:column; gap:6px; }

  .kg-missing-item {
    display:flex; align-items:flex-start; gap:8px;
    padding:8px 10px; border-radius:8px;
  }

  .kg-missing-item.warning { background:rgba(249,115,22,0.08); border:1px solid rgba(249,115,22,0.2); }
  .kg-missing-item.info    { background:rgba(59,130,246,0.08);  border:1px solid rgba(59,130,246,0.2); }

  .kg-missing-icon { font-size:12px; padding-top:1px; }
  .kg-missing-item.warning .kg-missing-icon { color:#f97316; }
  .kg-missing-item.info    .kg-missing-icon { color:#3b82f6; }

  .kg-missing-text { display:flex; flex-direction:column; gap:2px; }

  .kg-missing-topic { font-size:12px; font-weight:700; color:var(--text); }

  .kg-missing-desc { font-size:11px; color:var(--muted); }
  .kg-missing-desc strong { color:var(--text); }

  /* Node detail */
  .kg-node-detail { background:var(--card-bg); }

  .kg-detail-rows { display:flex; flex-direction:column; gap:8px; }

  .kg-detail-row {
    display:flex; justify-content:space-between;
    font-size:12px;
  }

  .kg-detail-row span:first-child { color:var(--muted); }

  .kg-detail-prereqs { display:flex; flex-direction:column; gap:6px; margin-top:4px; }

  .kg-detail-label { font-size:11px; color:var(--muted); font-weight:500; }

  .kg-prereq-tags { display:flex; flex-wrap:wrap; gap:4px; }

  .kg-prereq-tag {
    font-size:10px; font-weight:600;
    background:var(--bg); border:1px solid var(--border);
    padding:2px 8px; border-radius:99px; color:var(--muted);
  }

  /* Empty */
  .kg-empty {
    flex:1; display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    gap:14px; text-align:center; padding:40px;
  }

  .kg-empty-icon { font-size:56px; color:var(--border); }

  .kg-empty h2 {
    font-family:'Syne',sans-serif; font-size:22px; font-weight:700;
    color:var(--text); margin:0;
  }

  .kg-empty p { font-size:14px; color:var(--muted); max-width:400px; margin:0; }
`;