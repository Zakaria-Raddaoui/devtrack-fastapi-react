import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';

const DIFFICULTY_COLORS = {
  beginner: { text: '#16a34a' },
  intermediate: { text: '#ea580c' },
  advanced: { text: '#dc2626' },
};

const STATUS_META = {
  to_learn: { text: '#6b7280', label: 'Up next' },
  learning: { text: '#3b82f6', label: 'Currently learning' },
  mastered: { text: '#22c55e', label: 'Mastered' },
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; }

  .pp-root {
    min-height: 100vh;
    background: #0a0a0a;
    font-family: var(--font-body);
    color: #f0ede8;
    position: relative;
    overflow-x: hidden;
  }

  .pp-orb1, .pp-orb2 {
    position: fixed; border-radius: 50%;
    filter: blur(120px); opacity: 0.08; pointer-events: none; z-index: 0;
  }
  .pp-orb1 { width:700px; height:700px; background:#f97316; top:-250px; right:-150px; }
  .pp-orb2 { width:500px; height:500px; background:#3b82f6; bottom:-150px; left:-150px; }

  .pp-content {
    position: relative; z-index: 1;
    max-width: 740px; margin: 0 auto;
    padding: 60px 24px 80px;
    display: flex; flex-direction: column; gap: 36px;
    animation: ppFade 0.5s ease forwards;
  }

  @keyframes ppFade {
    from { opacity:0; transform:translateY(16px); }
    to   { opacity:1; transform:translateY(0); }
  }

  /* Loading / not found */
  .pp-center {
    min-height: 100vh; background: #0a0a0a;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 20px; font-family: var(--font-body);
    text-align: center; padding: 24px;
  }

  .pp-nf-icon {
    width: 80px; height: 80px; border-radius: 50%;
    background: linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05));
    border: 1px solid rgba(249,115,22,0.2);
    display: flex; align-items: center; justify-content: center; font-size: 36px; letter-spacing: -1px; font-weight: 800; margin-bottom: 4px;
  }

  .pp-nf-title {
    font-family: var(--font-heading);
    font-size: 28px; font-weight: 800;
    color: #f0ede8; letter-spacing: -0.5px;
  }

  .pp-nf-sub { font-size: 15px; color: #666; line-height: 1.6; max-width: 320px; }

  .pp-nf-link {
    display: inline-flex; align-items: center; gap: 8px;
    background: #f97316; color: white;
    text-decoration: none; border-radius: 10px;
    padding: 11px 22px; font-size: 14px; font-weight: 600;
    font-family: var(--font-body);
    transition: all 0.2s; margin-top: 4px;
    box-shadow: 0 4px 16px rgba(249,115,22,0.3);
  }

  .pp-nf-link:hover { background: #ea6c0a; transform: translateY(-1px); }

  .pp-ring {
    width: 40px; height: 40px;
    border: 3px solid #222; border-top-color: #f97316;
    border-radius: 50%; animation: ppSpin 0.8s linear infinite;
  }

  @keyframes ppSpin { to { transform: rotate(360deg); } }

  /* Header */
  .pp-header {
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 20px; flex-wrap: wrap;
  }

  .pp-header-left { display: flex; align-items: flex-start; gap: 20px; flex: 1; min-width: 0; }

  .pp-avatar {
    width: 76px; height: 76px; border-radius: 50%;
    background: linear-gradient(135deg, #f97316, #fb923c);
    color: white; display: flex;
    align-items: center; justify-content: center;
    font-family: var(--font-heading);
    font-size: 30px; font-weight: 800; flex-shrink: 0;
    box-shadow: 0 8px 24px rgba(249,115,22,0.3);
  }

  .pp-info { flex: 1; min-width: 0; }

  .pp-username {
    font-family: var(--font-heading);
    font-size: 34px; font-weight: 800;
    color: #f0ede8; letter-spacing: -1px; margin-bottom: 8px;
  }

  .pp-bio {
    font-size: 14px; color: #888;
    line-height: 1.6; margin-bottom: 8px;
  }

  .pp-since {
    font-size: 11px; color: #555;
    text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;
  }

  .pp-badge {
    display: flex; align-items: center; gap: 8px;
    background: rgba(249,115,22,0.1);
    border: 1px solid rgba(249,115,22,0.25);
    border-radius: 99px; padding: 8px 18px;
    text-decoration: none; color: #f97316;
    font-size: 13px; font-weight: 700;
    font-family: var(--font-heading);
    transition: all 0.2s; flex-shrink: 0; align-self: flex-start;
    letter-spacing: -0.3px;
  }

  .pp-badge:hover { background: rgba(249,115,22,0.18); transform: translateY(-1px); }

  /* Stats */
  .pp-stats {
    display: grid; grid-template-columns: repeat(4,1fr); gap: 12px;
  }

  .pp-stat {
    background: #141414; border: 1px solid #222;
    border-radius: 16px; padding: 20px;
    text-align: center;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .pp-stat:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }

  .pp-stat-val {
    font-family: var(--font-heading);
    font-size: 30px; font-weight: 800;
    letter-spacing: -1px; margin-bottom: 5px;
  }

  .pp-stat-label {
    font-size: 11px; color: #555;
    font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
  }

  /* Topics */
  .pp-topics { display: flex; flex-direction: column; gap: 8px; }

  .pp-topics-title {
    font-family: var(--font-heading);
    font-size: 18px; font-weight: 700;
    color: #f0ede8; margin-bottom: 8px;
  }

  .pp-group { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }

  .pp-group-header {
    display: flex; align-items: center; gap: 8px;
  }

  .pp-group-dot { width: 8px; height: 8px; border-radius: 50%; }

  .pp-group-label {
    font-size: 12px; font-weight: 700; color: #666;
    text-transform: uppercase; letter-spacing: 0.6px; flex: 1;
  }

  .pp-group-count {
    font-size: 11px; color: #444;
    background: #1a1a1a; border: 1px solid #2a2a2a;
    padding: 2px 8px; border-radius: 99px;
  }

  .pp-pills { display: flex; flex-wrap: wrap; gap: 8px; }

  .pp-pill {
    display: flex; align-items: center; gap: 7px;
    background: #141414; border: 1px solid #222;
    border-radius: 99px; padding: 6px 14px;
    font-size: 13px; color: #ccc; font-weight: 500;
    transition: border-color 0.15s;
  }

  .pp-pill:hover { border-color: #333; }

  .pp-diff-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

  /* Footer */
  .pp-footer { display: flex; justify-content: center; padding-top: 8px; }

  .pp-cta {
    background: #f97316; color: white;
    text-decoration: none; border-radius: 12px;
    padding: 14px 32px; font-size: 15px; font-weight: 600;
    font-family: var(--font-body); transition: all 0.2s;
    box-shadow: 0 4px 20px rgba(249,115,22,0.35);
  }

  .pp-cta:hover { background: #ea6c0a; transform: translateY(-2px); box-shadow: 0 8px 28px rgba(249,115,22,0.45); }

  @media (max-width: 600px) {
    .pp-stats { grid-template-columns: repeat(2,1fr); }
    .pp-username { font-size: 26px; }
    .pp-content { padding: 40px 16px 60px; }
  }
`;

export default function PublicProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${apiBase}${url}`;
  };

  useEffect(() => {
    api.get(`/u/${username}`)
      .then(res => setProfile(res.data))
      .catch(err => { if (err.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return (
    <>
      <style>{STYLES}</style>
      <div className="pp-center"><div className="pp-ring" /></div>
    </>
  );

  if (notFound) return (
    <>
      <style>{STYLES}</style>
      <div className="pp-orb1" /><div className="pp-orb2" />
      <div className="pp-center">
        <div className="pp-nf-icon">◈</div>
        <h1 className="pp-nf-title">Profile not found</h1>
        <p className="pp-nf-sub">This profile doesn't exist or has been set to private by its owner.</p>
        <Link to="/login" className="pp-nf-link">Go to DevTrack →</Link>
      </div>
    </>
  );

  const memberSince = new Date(profile.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const byStatus = s => profile.topics.filter(t => t.status === s);

  return (
    <>
      <style>{STYLES}</style>
      <div className="pp-root">
        <div className="pp-orb1" /><div className="pp-orb2" />
        <div className="pp-content">

          {/* Header */}
          <div className="pp-header">
            <div className="pp-header-left">
              <div className="pp-avatar">
                {profile.profile_picture ? (
                  <img
                    src={resolveMediaUrl(profile.profile_picture)}
                    alt={`${profile.username} avatar`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : username[0].toUpperCase()}
              </div>
              <div className="pp-info">
                <h1 className="pp-username">{profile.username}</h1>
                {profile.bio && <p className="pp-bio">{profile.bio}</p>}
                <p className="pp-since">Member since {memberSince}</p>
              </div>
            </div>
            <Link to="/login" className="pp-badge">
              <span>⬡</span> DevTrack
            </Link>
          </div>

          {/* Stats */}
          <div className="pp-stats">
            {[
              { val: `${profile.total_hours}h`, label: 'Total hours', color: '#f97316' },
              { val: profile.topics_in_progress, label: 'In progress', color: '#3b82f6' },
              { val: profile.topics_mastered, label: 'Mastered', color: '#22c55e' },
              { val: profile.topics.length, label: 'Topics tracked', color: '#a855f7' },
            ].map(({ val, label, color }) => (
              <div key={label} className="pp-stat">
                <div className="pp-stat-val" style={{ color }}>{val}</div>
                <div className="pp-stat-label">{label}</div>
              </div>
            ))}
          </div>

          {/* Topics */}
          {profile.topics.length > 0 && (
            <div className="pp-topics">
              <h2 className="pp-topics-title">Learning journey</h2>
              {['mastered', 'learning', 'to_learn'].map(status => {
                const items = byStatus(status);
                if (!items.length) return null;
                const meta = STATUS_META[status];
                return (
                  <div key={status} className="pp-group">
                    <div className="pp-group-header">
                      <div className="pp-group-dot" style={{ background: meta.text }} />
                      <span className="pp-group-label">{meta.label}</span>
                      <span className="pp-group-count">{items.length}</span>
                    </div>
                    <div className="pp-pills">
                      {items.map((t, i) => (
                        <div key={i} className="pp-pill">
                          <div className="pp-diff-dot" style={{ background: DIFFICULTY_COLORS[t.difficulty]?.text }} />
                          {t.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer CTA */}
          <div className="pp-footer">
            <Link to="/login" className="pp-cta">
              Track your own learning with DevTrack →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
