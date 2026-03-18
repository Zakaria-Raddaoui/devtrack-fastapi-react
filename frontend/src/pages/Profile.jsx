import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

// ─── Section card wrapper ─────────────────────────────────────────────────────

function Section({ title, subtitle, children }) {
    return (
        <div className="pf-section">
            <div className="pf-section-header">
                <div>
                    <h2 className="pf-section-title">{title}</h2>
                    {subtitle && <p className="pf-section-sub">{subtitle}</p>}
                </div>
            </div>
            <div className="pf-section-body">{children}</div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Profile() {
    const { user: authUser, logout } = useAuth();

    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // Form states
    const [profileForm, setProfileForm] = useState({ bio: '', email: '', is_public: true });
    const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });

    // Save states
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [profileError, setProfileError] = useState('');

    const [pwSaving, setPwSaving] = useState(false);
    const [pwSuccess, setPwSuccess] = useState('');
    const [pwError, setPwError] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const [profileRes, statsRes] = await Promise.all([
                api.get('/me/profile'),
                api.get('/me/profile/stats'),
            ]);
            setProfile(profileRes.data);
            setStats(statsRes.data);
            setProfileForm({
                bio: profileRes.data.bio || '',
                email: profileRes.data.email || '',
                is_public: profileRes.data.is_public ?? true,
            });
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const saveProfile = async e => {
        e.preventDefault();
        setProfileSaving(true);
        setProfileError('');
        setProfileSaved(false);
        try {
            await api.patch('/me/profile', {
                bio: profileForm.bio || null,
                email: profileForm.email || undefined,
                is_public: profileForm.is_public,
            });
            setProfileSaved(true);
            setTimeout(() => setProfileSaved(false), 3000);
            fetchData();
        } catch (err) {
            const d = err.response?.data?.detail;
            setProfileError(typeof d === 'string' ? d : 'Failed to save changes');
        } finally {
            setProfileSaving(false);
        }
    };

    const changePassword = async e => {
        e.preventDefault();
        setPwError('');
        setPwSuccess('');
        if (pwForm.new_password !== pwForm.confirm) {
            setPwError('New passwords do not match');
            return;
        }
        if (pwForm.new_password.length < 6) {
            setPwError('Password must be at least 6 characters');
            return;
        }
        setPwSaving(true);
        try {
            await api.post('/me/profile/password', {
                current_password: pwForm.current_password,
                new_password: pwForm.new_password,
            });
            setPwSuccess('Password changed successfully!');
            setPwForm({ current_password: '', new_password: '', confirm: '' });
        } catch (err) {
            const d = err.response?.data?.detail;
            setPwError(typeof d === 'string' ? d : 'Failed to change password');
        } finally {
            setPwSaving(false);
        }
    };

    if (loading) return (
        <div className="pf-loading"><div className="pf-ring" /></div>
    );

    const memberSince = stats?.member_since
        ? new Date(stats.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : '';

    const STAT_ITEMS = [
        { label: 'Total hours', val: `${stats?.total_hours ?? 0}h`, color: '#f97316', icon: '⏱' },
        { label: 'Sessions', val: stats?.total_sessions ?? 0, color: '#3b82f6', icon: '📝' },
        { label: 'Active days', val: stats?.active_days ?? 0, color: '#22c55e', icon: '📅' },
        { label: 'Topics', val: stats?.topics_total ?? 0, color: '#a855f7', icon: '◈' },
        { label: 'Mastered', val: stats?.topics_mastered ?? 0, color: '#22c55e', icon: '✓' },
        { label: 'Goals done', val: stats?.goals_completed ?? 0, color: '#f59e0b', icon: '🎯' },
        { label: 'Notes', val: stats?.notes_count ?? 0, color: '#14b8a6', icon: '◇' },
        { label: 'Roadmaps', val: stats?.roadmaps_count ?? 0, color: '#ec4899', icon: '⟳' },
    ];

    return (
        <div className="pf-root">

            {/* ── Hero ── */}
            <div className="pf-hero">
                <div className="pf-avatar-wrap">
                    <div className="pf-avatar">
                        {authUser?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    {profileForm.is_public && (
                        <span className="pf-public-badge">Public</span>
                    )}
                </div>
                <div className="pf-hero-info">
                    <h1 className="pf-username">{authUser?.username}</h1>
                    <p className="pf-meta">
                        {profile?.email}
                        {memberSince && <span className="pf-dot">·</span>}
                        {memberSince && <span>Member since {memberSince}</span>}
                    </p>
                    {profile?.bio && <p className="pf-bio">{profile.bio}</p>}
                    {profileForm.is_public && (
                        <a
                            href={`/u/${authUser?.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pf-public-link"
                        >
                            View public profile ↗
                        </a>
                    )}
                </div>
            </div>

            {/* ── Stats grid ── */}
            <div className="pf-stats-grid">
                {STAT_ITEMS.map(({ label, val, color, icon }) => (
                    <div key={label} className="pf-stat">
                        <div className="pf-stat-top">
                            <span className="pf-stat-icon">{icon}</span>
                            <span className="pf-stat-val" style={{ color }}>{val}</span>
                        </div>
                        <span className="pf-stat-label">{label}</span>
                    </div>
                ))}
            </div>

            {/* ── Edit profile ── */}
            <Section
                title="Edit profile"
                subtitle="Update your display name, bio, and visibility settings"
            >
                <form onSubmit={saveProfile} className="pf-form">
                    <div className="pf-field">
                        <label>Email</label>
                        <input
                            type="email"
                            value={profileForm.email}
                            onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                            placeholder="your@email.com"
                        />
                    </div>
                    <div className="pf-field">
                        <label>Bio <span className="pf-opt">(optional)</span></label>
                        <textarea
                            value={profileForm.bio}
                            onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))}
                            placeholder="Tell the world what you're learning and building..."
                            rows={3}
                            maxLength={300}
                        />
                        <span className="pf-char-count">{profileForm.bio.length}/300</span>
                    </div>

                    {/* Public toggle */}
                    <div className="pf-toggle-row">
                        <div>
                            <p className="pf-toggle-label">Public profile</p>
                            <p className="pf-toggle-sub">
                                Allow others to view your learning progress at{' '}
                                <code className="pf-code">/u/{authUser?.username}</code>
                            </p>
                        </div>
                        <button
                            type="button"
                            className={`pf-toggle ${profileForm.is_public ? 'on' : ''}`}
                            onClick={() => setProfileForm(f => ({ ...f, is_public: !f.is_public }))}
                        >
                            <span className="pf-toggle-knob" />
                        </button>
                    </div>

                    {profileError && <p className="pf-error">{profileError}</p>}
                    {profileSaved && <p className="pf-success">✓ Profile saved successfully</p>}

                    <button type="submit" className="pf-btn" disabled={profileSaving}>
                        {profileSaving ? <span className="pf-spinner" /> : 'Save changes'}
                    </button>
                </form>
            </Section>

            {/* ── Change password ── */}
            <Section
                title="Change password"
                subtitle="Choose a strong password of at least 6 characters"
            >
                <form onSubmit={changePassword} className="pf-form">
                    <div className="pf-field">
                        <label>Current password</label>
                        <input
                            type="password"
                            value={pwForm.current_password}
                            onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                            placeholder="Enter your current password"
                            required
                        />
                    </div>
                    <div className="pf-field-row">
                        <div className="pf-field">
                            <label>New password</label>
                            <input
                                type="password"
                                value={pwForm.new_password}
                                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                                placeholder="At least 6 characters"
                                required
                            />
                        </div>
                        <div className="pf-field">
                            <label>Confirm new password</label>
                            <input
                                type="password"
                                value={pwForm.confirm}
                                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                                placeholder="Repeat new password"
                                required
                            />
                        </div>
                    </div>

                    {/* Password strength indicator */}
                    {pwForm.new_password && (
                        <div className="pf-strength-wrap">
                            {(() => {
                                const p = pwForm.new_password;
                                let score = 0;
                                if (p.length >= 6) score++;
                                if (p.length >= 10) score++;
                                if (/[A-Z]/.test(p)) score++;
                                if (/[0-9]/.test(p)) score++;
                                if (/[^a-zA-Z0-9]/.test(p)) score++;
                                const label = score <= 1 ? 'Weak' : score <= 3 ? 'Fair' : 'Strong';
                                const color = score <= 1 ? '#ef4444' : score <= 3 ? '#f97316' : '#22c55e';
                                return (
                                    <>
                                        <div className="pf-strength-bars">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className="pf-strength-bar"
                                                    style={{ background: i <= score ? color : 'var(--border)' }} />
                                            ))}
                                        </div>
                                        <span className="pf-strength-label" style={{ color }}>{label}</span>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {pwError && <p className="pf-error">{pwError}</p>}
                    {pwSuccess && <p className="pf-success">✓ {pwSuccess}</p>}

                    <button type="submit" className="pf-btn" disabled={pwSaving}>
                        {pwSaving ? <span className="pf-spinner" /> : 'Change password'}
                    </button>
                </form>
            </Section>

            {/* ── Account section ── */}
            <Section title="Account" subtitle="Manage your account settings">
                <div className="pf-danger-zone">
                    <div className="pf-danger-item">
                        <div>
                            <p className="pf-danger-label">Export learning report</p>
                            <p className="pf-danger-sub">Download a PDF with your topics, logs, goals and stats</p>
                        </div>
                        <button
                            className="pf-btn"
                            onClick={async () => {
                                const token = localStorage.getItem('token');
                                const res = await fetch(
                                    `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/export/report`,
                                    { headers: { Authorization: `Bearer ${token}` } }
                                );
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `devtrack-report.pdf`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            style={{ background: '#3b82f6', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}
                        >
                            ↓ Export PDF
                        </button>
                    </div>
                    <div className="pf-danger-item">
                        <div>
                            <p className="pf-danger-label">Sign out</p>
                            <p className="pf-danger-sub">Sign out of your account on this device</p>
                        </div>
                        <button className="pf-btn-outline" onClick={logout}>Sign out</button>
                    </div>
                </div>
            </Section>

            <style>{`
        .pf-root {
          padding: 40px 44px; width: 100%; box-sizing: border-box;
          max-width: 800px; margin: 0 auto;
          display: flex; flex-direction: column; gap: 24px;
          animation: pfFade 0.4s ease forwards;
        }

        @keyframes pfFade {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }

        .pf-loading {
          display:flex; align-items:center; justify-content:center; height:100vh;
        }

        .pf-ring {
          width:36px; height:36px; border:3px solid var(--border);
          border-top-color:#f97316; border-radius:50%;
          animation:pfSpin 0.8s linear infinite;
        }

        @keyframes pfSpin { to { transform:rotate(360deg); } }

        /* Hero */
        .pf-hero {
          display:flex; align-items:flex-start; gap:24px;
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:20px; padding:28px;
        }

        .pf-avatar-wrap { display:flex; flex-direction:column; align-items:center; gap:8px; flex-shrink:0; }

        .pf-avatar {
          width:80px; height:80px; border-radius:50%;
          background:linear-gradient(135deg,#f97316,#fb923c);
          display:flex; align-items:center; justify-content:center;
          font-family:'Syne',sans-serif; font-size:32px; font-weight:800;
          color:white;
        }

        .pf-public-badge {
          font-size:10px; font-weight:700;
          background:rgba(34,197,94,0.12); color:#16a34a;
          padding:2px 8px; border-radius:99px;
          text-transform:uppercase; letter-spacing:0.5px;
        }

        .pf-hero-info { flex:1; min-width:0; }

        .pf-username {
          font-family:'Syne',sans-serif; font-size:26px; font-weight:800;
          color:var(--text); letter-spacing:-0.5px; margin:0 0 6px;
        }

        .pf-meta {
          font-size:13px; color:var(--muted); margin:0 0 10px;
          display:flex; align-items:center; gap:8px; flex-wrap:wrap;
        }

        .pf-dot { color:var(--border); }

        .pf-bio {
          font-size:14px; color:var(--text); line-height:1.6; margin:0 0 10px;
        }

        .pf-public-link {
          font-size:13px; color:#f97316; text-decoration:none; font-weight:500;
          transition:opacity 0.15s;
        }

        .pf-public-link:hover { opacity:0.75; }

        /* Stats */
        .pf-stats-grid {
          display:grid; grid-template-columns:repeat(4,1fr); gap:12px;
        }

        .pf-stat {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:14px; padding:18px 16px;
          display:flex; flex-direction:column; gap:6px;
          transition:transform 0.2s, box-shadow 0.2s;
        }

        .pf-stat:hover { transform:translateY(-2px); box-shadow:0 6px 20px var(--shadow); }

        .pf-stat-top {
          display:flex; align-items:center;
          justify-content:space-between; gap:8px;
        }

        .pf-stat-icon { font-size:16px; opacity:0.7; }

        .pf-stat-val {
          font-family:'Syne',sans-serif; font-size:24px; font-weight:800;
          letter-spacing:-0.5px; line-height:1;
        }

        .pf-stat-label {
          font-size:11px; color:var(--muted);
          text-transform:uppercase; letter-spacing:0.5px; font-weight:500;
        }

        /* Section */
        .pf-section {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:16px; overflow:hidden;
        }

        .pf-section-header {
          padding:20px 24px 16px;
          border-bottom:1px solid var(--border);
        }

        .pf-section-title {
          font-family:'Syne',sans-serif; font-size:16px; font-weight:700;
          color:var(--text); margin:0 0 3px;
        }

        .pf-section-sub { font-size:13px; color:var(--muted); margin:0; }

        .pf-section-body { padding:24px; }

        /* Form */
        .pf-form { display:flex; flex-direction:column; gap:18px; }
        .pf-field-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .pf-field { display:flex; flex-direction:column; gap:7px; position:relative; }
        .pf-field label { font-size:13px; font-weight:500; color:var(--muted); }
        .pf-opt { font-weight:400; color:var(--placeholder); }

        .pf-field input, .pf-field textarea {
          background:var(--input-bg); border:1px solid var(--border);
          border-radius:10px; padding:11px 14px;
          font-size:14px; color:var(--text);
          font-family:'DM Sans',sans-serif; outline:none; resize:vertical;
          transition:border-color 0.2s, box-shadow 0.2s;
        }

        .pf-field input:focus, .pf-field textarea:focus {
          border-color:#f97316; box-shadow:0 0 0 3px rgba(249,115,22,0.12);
        }

        .pf-char-count {
          font-size:11px; color:var(--placeholder);
          text-align:right; margin-top:2px;
        }

        /* Toggle */
        .pf-toggle-row {
          display:flex; align-items:center;
          justify-content:space-between; gap:16px;
          background:var(--bg); border:1px solid var(--border);
          border-radius:12px; padding:16px;
        }

        .pf-toggle-label { font-size:14px; font-weight:600; color:var(--text); margin:0 0 3px; }
        .pf-toggle-sub { font-size:12px; color:var(--muted); margin:0; }

        .pf-code {
          background:var(--input-bg); border:1px solid var(--border);
          border-radius:4px; padding:1px 5px;
          font-size:11px; color:#f97316; font-family:monospace;
        }

        .pf-toggle {
          width:44px; height:24px; border-radius:99px;
          background:var(--border); border:none; cursor:pointer;
          position:relative; transition:background 0.2s; flex-shrink:0;
        }

        .pf-toggle.on { background:#f97316; }

        .pf-toggle-knob {
          position:absolute; top:3px; left:3px;
          width:18px; height:18px; border-radius:50%;
          background:white; transition:transform 0.2s;
          display:block;
        }

        .pf-toggle.on .pf-toggle-knob { transform:translateX(20px); }

        /* Password strength */
        .pf-strength-wrap {
          display:flex; align-items:center; gap:8px;
        }

        .pf-strength-bars { display:flex; gap:4px; }

        .pf-strength-bar {
          width:28px; height:4px; border-radius:99px;
          transition:background 0.2s;
        }

        .pf-strength-label { font-size:12px; font-weight:600; }

        /* Messages */
        .pf-error {
          font-size:13px; color:var(--danger-text);
          background:var(--danger-bg); border-radius:8px; padding:10px 14px;
        }

        .pf-success {
          font-size:13px; color:#16a34a;
          background:rgba(34,197,94,0.1); border-radius:8px; padding:10px 14px;
        }

        /* Buttons */
        .pf-btn {
          background:#f97316; color:white; border:none;
          border-radius:10px; padding:12px 24px;
          font-size:14px; font-weight:600;
          font-family:'DM Sans',sans-serif; cursor:pointer;
          transition:all 0.2s; align-self:flex-start;
          display:flex; align-items:center; gap:8px;
          box-shadow:0 4px 14px rgba(249,115,22,0.3);
          min-height:44px; min-width:140px; justify-content:center;
        }

        .pf-btn:hover:not(:disabled) { background:#ea6c0a; transform:translateY(-1px); }
        .pf-btn:disabled { opacity:0.7; cursor:not-allowed; }

        .pf-btn-outline {
          background:none; border:1px solid var(--border);
          border-radius:10px; padding:10px 20px;
          font-size:14px; font-weight:500;
          font-family:'DM Sans',sans-serif; cursor:pointer;
          color:var(--text); transition:all 0.15s;
        }

        .pf-btn-outline:hover { border-color:var(--muted); background:var(--hover-bg); }

        .pf-spinner {
          width:16px; height:16px;
          border:2px solid rgba(255,255,255,0.3); border-top-color:white;
          border-radius:50%; animation:pfSpin 0.7s linear infinite; display:inline-block;
        }

        /* Danger zone */
        .pf-danger-zone { display:flex; flex-direction:column; gap:16px; }

        .pf-danger-item {
          display:flex; align-items:center;
          justify-content:space-between; gap:16px;
          padding:16px; background:var(--bg);
          border:1px solid var(--border); border-radius:12px;
        }

        .pf-danger-label { font-size:14px; font-weight:600; color:var(--text); margin:0 0 3px; }
        .pf-danger-sub { font-size:12px; color:var(--muted); margin:0; }
      `}</style>
        </div>
    );
}