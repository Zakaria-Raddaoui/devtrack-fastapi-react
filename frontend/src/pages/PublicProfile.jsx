import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';

const DIFFICULTY_COLORS = {
    beginner: { bg: 'rgba(34,197,94,0.12)', text: '#16a34a' },
    intermediate: { bg: 'rgba(249,115,22,0.12)', text: '#ea580c' },
    advanced: { bg: 'rgba(239,68,68,0.12)', text: '#dc2626' },
};

const STATUS_COLORS = {
    to_learn: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280' },
    learning: { bg: 'rgba(59,130,246,0.12)', text: '#2563eb' },
    mastered: { bg: 'rgba(34,197,94,0.12)', text: '#16a34a' },
};

function StatCard({ value, label, color }) {
    return (
        <div className="stat-card">
            <div className="stat-value" style={{ color }}>{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    );
}

export default function PublicProfile() {
    const { username } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        api.get(`/u/${username}`)
            .then(res => setProfile(res.data))
            .catch(err => {
                if (err.response?.status === 404) setNotFound(true);
            })
            .finally(() => setLoading(false));
    }, [username]);

    if (loading) return (
        <div className="profile-loading">
            <div className="loading-ring" />
        </div>
    );

    if (notFound) return (
        <div className="profile-not-found">
            <div className="nf-icon">◈</div>
            <h1>Profile not found</h1>
            <p>This profile doesn't exist or is set to private.</p>
            <Link to="/login" className="nf-link">Go to DevTrack →</Link>
        </div>
    );

    const memberSince = new Date(profile.member_since).toLocaleDateString('en-US', {
        month: 'long', year: 'numeric'
    });

    const byStatus = (status) => profile.topics.filter(t => t.status === status);

    return (
        <div className="profile-root">
            {/* Background orbs */}
            <div className="profile-bg">
                <div className="orb orb1" />
                <div className="orb orb2" />
            </div>

            <div className="profile-content">
                {/* Header */}
                <div className="profile-header">
                    <div className="profile-avatar">
                        {username[0].toUpperCase()}
                    </div>
                    <div className="profile-info">
                        <h1 className="profile-username">{profile.username}</h1>
                        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
                        <p className="profile-since">Member since {memberSince}</p>
                    </div>
                    <Link to="/login" className="devtrack-badge">
                        <span className="badge-icon">⬡</span>
                        DevTrack
                    </Link>
                </div>

                {/* Stats */}
                <div className="stats-row">
                    <StatCard
                        value={`${profile.total_hours}h`}
                        label="Total hours"
                        color="#f97316"
                    />
                    <StatCard
                        value={profile.topics_in_progress}
                        label="In progress"
                        color="#3b82f6"
                    />
                    <StatCard
                        value={profile.topics_mastered}
                        label="Mastered"
                        color="#22c55e"
                    />
                    <StatCard
                        value={profile.topics.length}
                        label="Topics tracked"
                        color="#a855f7"
                    />
                </div>

                {/* Topics */}
                {profile.topics.length > 0 && (
                    <div className="topics-section">
                        <h2 className="section-title">Learning topics</h2>

                        {['mastered', 'learning', 'to_learn'].map(status => {
                            const items = byStatus(status);
                            if (items.length === 0) return null;
                            const labels = { mastered: 'Mastered', learning: 'Currently learning', to_learn: 'Up next' };
                            return (
                                <div key={status} className="topic-group">
                                    <div className="group-header">
                                        <div
                                            className="group-dot"
                                            style={{ background: STATUS_COLORS[status].text }}
                                        />
                                        <span className="group-label">{labels[status]}</span>
                                        <span className="group-count">{items.length}</span>
                                    </div>
                                    <div className="topics-grid">
                                        {items.map((t, i) => (
                                            <div key={i} className="topic-pill">
                                                <span
                                                    className="diff-dot"
                                                    style={{ background: DIFFICULTY_COLORS[t.difficulty]?.text }}
                                                />
                                                {t.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer */}
                <div className="profile-footer">
                    <Link to="/login" className="cta-btn">
                        Track your own learning with DevTrack →
                    </Link>
                </div>
            </div>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #0f0f0f; }

        .profile-root {
          min-height: 100vh;
          background: #0f0f0f;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
          color: #f0ede8;
        }

        .profile-bg {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
        }

        .orb {
          position: absolute; border-radius: 50%;
          filter: blur(100px); opacity: 0.1;
        }

        .orb1 {
          width: 600px; height: 600px;
          background: #f97316;
          top: -200px; right: -100px;
        }

        .orb2 {
          width: 400px; height: 400px;
          background: #3b82f6;
          bottom: -100px; left: -100px;
        }

        .profile-loading, .profile-not-found {
          min-height: 100vh; background: #0f0f0f;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 16px; color: #888;
          font-family: 'DM Sans', sans-serif;
        }

        .loading-ring {
          width: 36px; height: 36px;
          border: 3px solid #2a2a2a;
          border-top-color: #f97316;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .nf-icon { font-size: 48px; color: #333; margin-bottom: 8px; }

        .profile-not-found h1 {
          font-family: 'Syne', sans-serif;
          font-size: 24px; color: #f0ede8;
        }

        .profile-not-found p { font-size: 14px; color: #888; }

        .nf-link {
          margin-top: 8px; color: #f97316;
          text-decoration: none; font-size: 14px;
          font-weight: 500;
        }

        .profile-content {
          position: relative; z-index: 1;
          max-width: 720px; margin: 0 auto;
          padding: 60px 24px 80px;
          display: flex; flex-direction: column; gap: 40px;
        }

        /* Header */
        .profile-header {
          display: flex; align-items: flex-start;
          gap: 20px; flex-wrap: wrap;
        }

        .profile-avatar {
          width: 72px; height: 72px; border-radius: 50%;
          background: linear-gradient(135deg, #f97316, #fb923c);
          color: white; display: flex;
          align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif;
          font-size: 28px; font-weight: 800;
          flex-shrink: 0;
        }

        .profile-info { flex: 1; min-width: 0; }

        .profile-username {
          font-family: 'Syne', sans-serif;
          font-size: 32px; font-weight: 800;
          color: #f0ede8; letter-spacing: -1px;
          margin-bottom: 6px;
        }

        .profile-bio {
          font-size: 15px; color: #888;
          line-height: 1.6; margin-bottom: 6px;
        }

        .profile-since {
          font-size: 12px; color: #555;
          font-weight: 500; text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .devtrack-badge {
          display: flex; align-items: center; gap: 6px;
          background: rgba(249,115,22,0.1);
          border: 1px solid rgba(249,115,22,0.3);
          border-radius: 99px; padding: 8px 16px;
          text-decoration: none; color: #f97316;
          font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.2s; flex-shrink: 0;
          align-self: flex-start;
        }

        .devtrack-badge:hover {
          background: rgba(249,115,22,0.18);
          transform: translateY(-1px);
        }

        .badge-icon { font-size: 16px; }

        /* Stats */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .stat-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 16px; padding: 20px;
          text-align: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }

        .stat-value {
          font-family: 'Syne', sans-serif;
          font-size: 32px; font-weight: 700;
          letter-spacing: -1px; margin-bottom: 4px;
        }

        .stat-label {
          font-size: 12px; color: #666;
          font-weight: 500; text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Topics */
        .topics-section {
          display: flex; flex-direction: column; gap: 24px;
        }

        .section-title {
          font-family: 'Syne', sans-serif;
          font-size: 20px; font-weight: 700;
          color: #f0ede8; letter-spacing: -0.3px;
        }

        .topic-group {
          display: flex; flex-direction: column; gap: 12px;
        }

        .group-header {
          display: flex; align-items: center; gap: 8px;
        }

        .group-dot {
          width: 8px; height: 8px; border-radius: 50%;
        }

        .group-label {
          font-size: 13px; font-weight: 600;
          color: #888; text-transform: uppercase;
          letter-spacing: 0.5px; flex: 1;
        }

        .group-count {
          font-size: 12px; color: #555;
          background: #2a2a2a; padding: 2px 8px;
          border-radius: 99px;
        }

        .topics-grid {
          display: flex; flex-wrap: wrap; gap: 8px;
        }

        .topic-pill {
          display: flex; align-items: center; gap: 6px;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 99px;
          padding: 6px 14px;
          font-size: 13px; color: #ccc;
          font-weight: 500;
          transition: border-color 0.2s;
        }

        .topic-pill:hover { border-color: #444; }

        .diff-dot {
          width: 6px; height: 6px;
          border-radius: 50%; flex-shrink: 0;
        }

        /* Footer */
        .profile-footer {
          display: flex; justify-content: center;
          padding-top: 8px;
        }

        .cta-btn {
          background: #f97316; color: white;
          text-decoration: none; border-radius: 12px;
          padding: 14px 28px; font-size: 15px;
          font-weight: 600; font-family: 'DM Sans', sans-serif;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(249,115,22,0.35);
        }

        .cta-btn:hover {
          background: #ea6c0a;
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(249,115,22,0.45);
        }

        @media (max-width: 600px) {
          .stats-row { grid-template-columns: repeat(2, 1fr); }
          .profile-username { font-size: 24px; }
        }
      `}</style>
        </div>
    );
}