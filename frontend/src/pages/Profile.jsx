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
    const { user: authUser, logout, refreshUser } = useAuth();

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
    const [avatarEditor, setAvatarEditor] = useState({
        open: false,
        src: '',
        fileName: '',
        zoom: 1,
        rotation: 0,
        saving: false,
    });

    const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000';

    const resolveMediaUrl = useCallback((url) => {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `${apiBase}${url}`;
    }, [apiBase]);

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
                profile_picture: profile?.profile_picture || null,
            });
            await refreshUser();
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

    const handleAvatarUpload = async e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setAvatarEditor({
                open: true,
                src: reader.result,
                fileName: file.name || 'avatar.jpg',
                zoom: 1,
                rotation: 0,
                saving: false,
            });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const saveEditedAvatar = async () => {
        if (!avatarEditor.src || avatarEditor.saving) return;

        setAvatarEditor(prev => ({ ...prev, saving: true }));
        setProfileError('');

        try {
            const image = new Image();
            image.src = avatarEditor.src;
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
            });

            const size = 512;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas not supported');

            ctx.translate(size / 2, size / 2);
            ctx.rotate((avatarEditor.rotation * Math.PI) / 180);
            const coverScale = Math.max(size / image.width, size / image.height);
            const finalScale = coverScale * avatarEditor.zoom;
            ctx.scale(finalScale, finalScale);
            ctx.drawImage(image, -image.width / 2, -image.height / 2);

            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((output) => {
                    if (!output) {
                        reject(new Error('Failed to render image'));
                        return;
                    }
                    resolve(output);
                }, 'image/jpeg', 0.92);
            });

            const formData = new FormData();
            formData.append('file', blob, avatarEditor.fileName.replace(/\.[^.]+$/, '.jpg'));
            const res = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const url = res.data.url;
            setProfile(p => ({ ...p, profile_picture: url }));
            await api.patch('/me/profile', { profile_picture: url });
            await refreshUser();
            setAvatarEditor({ open: false, src: '', fileName: '', zoom: 1, rotation: 0, saving: false });
        } catch (err) {
            console.error('Failed to upload image', err);
            setProfileError('Failed to upload profile picture');
            setAvatarEditor(prev => ({ ...prev, saving: false }));
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
                    <label className="pf-avatar" style={{ cursor: 'pointer', overflow: 'hidden' }}>
                        {profile?.profile_picture ? (
                            <img src={resolveMediaUrl(profile.profile_picture)} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            authUser?.username?.[0]?.toUpperCase() || 'U'
                        )}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                    </label>
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

            {avatarEditor.open && (
                <div className="pf-editor-overlay" onClick={() => !avatarEditor.saving && setAvatarEditor({ open: false, src: '', fileName: '', zoom: 1, rotation: 0, saving: false })}>
                    <div className="pf-editor-modal" onClick={e => e.stopPropagation()}>
                        <div className="pf-editor-header">
                            <h3>Adjust profile picture</h3>
                            <button
                                type="button"
                                className="pf-btn-outline"
                                onClick={() => setAvatarEditor({ open: false, src: '', fileName: '', zoom: 1, rotation: 0, saving: false })}
                                disabled={avatarEditor.saving}
                            >
                                Close
                            </button>
                        </div>

                        <div className="pf-editor-preview-wrap">
                            <div className="pf-editor-preview">
                                <img
                                    src={avatarEditor.src}
                                    alt="Preview"
                                    style={{ transform: `scale(${avatarEditor.zoom}) rotate(${avatarEditor.rotation}deg)` }}
                                />
                            </div>
                        </div>

                        <div className="pf-editor-controls">
                            <label>
                                Zoom: {avatarEditor.zoom.toFixed(2)}x
                                <input
                                    type="range"
                                    min="1"
                                    max="3"
                                    step="0.01"
                                    value={avatarEditor.zoom}
                                    onChange={(e) => setAvatarEditor(prev => ({ ...prev, zoom: Number(e.target.value) }))}
                                />
                            </label>
                            <label>
                                Rotation: {avatarEditor.rotation}°
                                <input
                                    type="range"
                                    min="-180"
                                    max="180"
                                    step="1"
                                    value={avatarEditor.rotation}
                                    onChange={(e) => setAvatarEditor(prev => ({ ...prev, rotation: Number(e.target.value) }))}
                                />
                            </label>
                        </div>

                        <div className="pf-editor-actions">
                            <button
                                type="button"
                                className="pf-btn-outline"
                                onClick={() => setAvatarEditor(prev => ({ ...prev, zoom: 1, rotation: 0 }))}
                                disabled={avatarEditor.saving}
                            >
                                Reset
                            </button>
                            <button
                                type="button"
                                className="pf-btn"
                                onClick={saveEditedAvatar}
                                disabled={avatarEditor.saving}
                            >
                                {avatarEditor.saving ? <span className="pf-spinner" /> : 'Save picture'}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            <style>{`
        .pf-root {
          padding: 40px 32px; width: 100%; box-sizing: border-box;
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
          width:40px; height:40px; border:3px solid var(--border);
          border-top-color:#f97316; border-radius:50%;
          animation:pfSpin 0.8s linear infinite;
        }

        @keyframes pfSpin { to { transform:rotate(360deg); } }

        /* Hero */
        .pf-hero {
          display:flex; align-items:flex-start; gap:24px;
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:20px; padding:32px; box-shadow:0 8px 24px var(--shadow);
        }

        .pf-avatar-wrap { display:flex; flex-direction:column; align-items:center; gap:10px; flex-shrink:0; }

        .pf-avatar {
          width:80px; height:80px; border-radius:50%;
          background:linear-gradient(135deg,#f97316,#fb923c);
          display:flex; align-items:center; justify-content:center;
          font-family:var(--font-heading); font-size: 32px; letter-spacing: -1px; font-weight: 700;
          color:white; box-shadow:0 8px 24px rgba(249,115,22,0.25);
        }

        .pf-public-badge {
          font-size:10px; font-weight:700; font-family:var(--font-heading);
          background:rgba(34,197,94,0.12); color:#16a34a;
          padding:3px 10px; border-radius:99px;
          text-transform:uppercase; letter-spacing:0.5px;
        }

        .pf-hero-info { flex:1; min-width:0; display:flex; flex-direction:column; justify-content:center; }

        .pf-username {
          font-family:var(--font-heading); font-size:28px; font-weight:800;
          color:var(--text); letter-spacing:-0.5px; margin:0 0 6px;
        }

        .pf-meta {
          font-size:13px; color:var(--muted); margin:0 0 12px; font-weight:500;
          display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-family:var(--font-body);
        }

        .pf-dot { color:var(--border); }

        .pf-bio {
          font-size:14px; color:var(--text); line-height:1.5; margin:0 0 14px; font-weight:400;
        }

        .pf-public-link {
          font-size:13px; color:#f97316; text-decoration:none; font-weight:600; font-family:var(--font-heading);
          transition:all 0.2s; align-self:flex-start; padding:6px 12px; border-radius:10px; background:rgba(249,115,22,0.1);
        }

        .pf-public-link:hover { opacity:0.85; transform:translateX(4px); background:rgba(249,115,22,0.15); }

        /* Stats */
        .pf-stats-grid {
          display:grid; grid-template-columns:repeat(4,1fr); gap:12px;
        }

        .pf-stat {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:16px; padding:20px;
          display:flex; flex-direction:column; gap:6px;
          transition:transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s cubic-bezier(0.16,1,0.3,1);
          box-shadow:0 4px 12px var(--shadow), 0 2px 4px rgba(0,0,0,0.02);
        }

        .pf-stat:hover { transform:translateY(-2px); box-shadow:0 8px 24px var(--shadow); border-color:rgba(249,115,22,0.3); }

        .pf-stat-top {
          display:flex; align-items:center;
          justify-content:space-between; gap:10px;
        }

        .pf-stat-icon { font-size:16px; filter:grayscale(20%); }

        .pf-stat-val {
          font-family:var(--font-heading); font-size:24px; font-weight:800;
          letter-spacing:-0.5px; line-height:1;
        }

        .pf-stat-label {
          font-size:11px; color:var(--muted);
          text-transform:uppercase; letter-spacing:0.5px; font-weight:600; font-family:var(--font-heading);
        }

        /* Section */
        .pf-section {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:24px; overflow:hidden; box-shadow:0 6px 16px var(--shadow);
        }

        .pf-section-header {
          padding:24px 32px 16px;
          border-bottom:1px solid var(--border);
        }

        .pf-section-title {
          font-family:var(--font-heading); font-size:20px; font-weight:700;
          color:var(--text); margin:0 0 4px; letter-spacing:-0.3px;
        }

        .pf-section-sub { font-size:13px; color:var(--muted); margin:0; font-weight:400; }

        .pf-section-body { padding:32px; }

        /* Form */
        .pf-form { display:flex; flex-direction:column; gap:20px; }
        .pf-field-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .pf-field { display:flex; flex-direction:column; gap:6px; position:relative; }
        .pf-field label { font-size:12px; font-weight:700; color:var(--text); font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.5px; }
        .pf-opt { font-weight:400; color:var(--placeholder); font-family:var(--font-body); text-transform:none; letter-spacing:0; }

        .pf-field input, .pf-field textarea {
          background:var(--input-bg); border:1px solid var(--border);
          border-radius:12px; padding:12px 16px;
          font-size:14px; color:var(--text); font-weight:400;
          font-family:var(--font-body); outline:none; resize:vertical;
          transition:all 0.2s; box-shadow:inset 0 1px 3px var(--shadow);
        }

        .pf-field input:focus, .pf-field textarea:focus {
          border-color:#f97316; background:var(--bg); box-shadow:0 0 0 3px rgba(249,115,22,0.1), inset 0 1px 3px rgba(0,0,0,0.02);
        }

        .pf-char-count {
          font-size:11px; color:var(--placeholder); font-weight:500;
          text-align:right; margin-top:2px;
        }

        /* Toggle */
        .pf-toggle-row {
          display:flex; align-items:center;
          justify-content:space-between; gap:20px;
          background:var(--bg); border:1px solid var(--border);
          border-radius:12px; padding:20px; transition:border-color 0.2s;
        }
        .pf-toggle-row:hover { border-color:var(--muted); }

        .pf-toggle-label { font-size:14px; font-weight:700; font-family:var(--font-heading); color:var(--text); margin:0 0 4px; }
        .pf-toggle-sub { font-size:12px; color:var(--muted); margin:0; font-weight:400; }

        .pf-code {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:4px; padding:2px 6px; font-weight:500;
          font-size:12px; color:#f97316; font-family:'JetBrains Mono',monospace;
        }

        .pf-toggle {
          width:48px; height:28px; border-radius:99px;
          background:var(--border); border:none; cursor:pointer;
          position:relative; transition:background 0.2s cubic-bezier(0.16,1,0.3,1); flex-shrink:0; pointer-events:auto;
        }

        .pf-toggle.on { background:#f97316; }

        .pf-toggle-knob {
          position:absolute; top:3px; left:3px;
          width:22px; height:22px; border-radius:50%;
          background:white; transition:transform 0.2s cubic-bezier(0.16,1,0.3,1); box-shadow:0 2px 6px rgba(0,0,0,0.15);
          display:block;
        }

        .pf-toggle.on .pf-toggle-knob { transform:translateX(20px); }

        /* Password strength */
        .pf-strength-wrap {
          display:flex; align-items:center; gap:10px; margin-bottom:6px;
        }

        .pf-strength-bars { display:flex; gap:4px; }

        .pf-strength-bar {
          width:32px; height:4px; border-radius:99px;
          transition:background 0.2s;
        }

        .pf-strength-label { font-size:12px; font-weight:700; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.5px; }

        /* Messages */
        .pf-error {
          font-size:13px; font-weight:600; color:var(--danger-text);
          background:var(--danger-bg); border-radius:10px; padding:12px 16px; border:1px solid rgba(239,68,68,0.2);
        }

        .pf-success {
          font-size:13px; font-weight:600; color:#16a34a;
          background:rgba(34,197,94,0.1); border-radius:10px; padding:12px 16px; border:1px solid rgba(34,197,94,0.3);
        }

        /* Buttons */
        .pf-btn {
          background:#f97316; color:white; border:none;
          border-radius:12px; padding:12px 24px;
          font-size:14px; font-weight:700; font-family:var(--font-heading);
          cursor:pointer; transition:all 0.2s cubic-bezier(0.16,1,0.3,1); align-self:flex-start;
          display:flex; align-items:center; gap:8px;
          box-shadow:0 6px 16px rgba(249,115,22,0.25);
          min-height:48px; min-width:160px; justify-content:center;
        }

        .pf-btn:hover:not(:disabled) { background:#ea6c0a; transform:translateY(-1px); box-shadow:0 8px 24px rgba(249,115,22,0.35); }
        .pf-btn:disabled { opacity:0.7; cursor:not-allowed; transform:none; box-shadow:none; }

        .pf-btn-outline {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:12px; padding:12px 24px;
          font-size:13px; font-weight:600;
          font-family:var(--font-heading); cursor:pointer;
          color:var(--text); transition:all 0.2s cubic-bezier(0.16,1,0.3,1);
        }

        .pf-btn-outline:hover { border-color:var(--danger-border); background:var(--danger-bg); color:var(--danger-text); transform:translateY(-1px); }

        .pf-spinner {
          width:16px; height:16px;
          border:2px solid rgba(255,255,255,0.3); border-top-color:white;
          border-radius:50%; animation:pfSpin 0.7s linear infinite; display:inline-block;
        }

        /* Danger zone */
        .pf-danger-zone { display:flex; flex-direction:column; gap:16px; }

        .pf-danger-item {
          display:flex; align-items:center;
          justify-content:space-between; gap:20px;
          padding:20px; background:var(--bg); box-shadow:inset 0 1px 3px rgba(0,0,0,0.02);
          border:1px solid var(--border); border-radius:16px; transition:border-color 0.2s;
        }
        .pf-danger-item:hover { border-color:rgba(239,68,68,0.2); }

        .pf-danger-label { font-family:var(--font-heading); font-size:16px; font-weight:700; color:var(--text); margin:0 0 4px; letter-spacing:-0.3px; }
        .pf-danger-sub { font-size:13px; color:var(--muted); margin:0; font-weight:400; }

                .pf-editor-overlay {
                    position: fixed; inset: 0; z-index: 2000;
                    background: rgba(0,0,0,0.68); backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px;
                }

                .pf-editor-modal {
                    width: 100%; max-width: 560px;
                    background: var(--card-bg); border: 1px solid var(--border);
                    border-radius: 20px; padding: 20px;
                    box-shadow: 0 22px 64px rgba(0,0,0,0.42);
                    display: flex; flex-direction: column; gap: 16px;
                }

                .pf-editor-header {
                    display: flex; align-items: center; justify-content: space-between; gap: 12px;
                }

                .pf-editor-header h3 {
                    margin: 0;
                    font-size: 18px;
                    font-family: var(--font-heading);
                    letter-spacing: -0.3px;
                }

                .pf-editor-preview-wrap {
                    display: flex; justify-content: center;
                }

                .pf-editor-preview {
                    width: 260px; height: 260px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 2px solid var(--border);
                    background: #0d0d0d;
                    display: flex; align-items: center; justify-content: center;
                }

                .pf-editor-preview img {
                    width: 100%; height: 100%;
                    object-fit: cover;
                    transform-origin: center center;
                }

                .pf-editor-controls {
                    display: flex; flex-direction: column; gap: 12px;
                }

                .pf-editor-controls label {
                    display: flex; flex-direction: column; gap: 6px;
                    font-size: 12px; color: var(--muted); font-weight: 600;
                }

                .pf-editor-controls input[type='range'] {
                    width: 100%;
                }

                .pf-editor-actions {
                    display: flex; justify-content: flex-end; gap: 10px;
                }
        @media (min-width: 600px) {
          .pf-toggle-row {
            justify-content:space-between; gap:24px;
            background:var(--bg); border:2px solid var(--border);
            border-radius:16px; padding:24px; transition:border-color 0.2s;
        }
            .pf-toggle-row:hover {border - color:var(--muted); }

            .pf-toggle-label {font - size:16px; font-weight:800; font-family:var(--font-heading); color:var(--text); margin:0 0 4px; }
            .pf-toggle-sub {font - size:14px; color:var(--muted); margin:0; font-weight:500; }

            .pf-code {
                background:var(--card-bg); border:1px solid var(--border);
            border-radius:6px; padding:2px 8px; font-weight:600;
            font-size:13px; color:#f97316; font-family:'JetBrains Mono',monospace;
        }

            .pf-toggle {
                width:56px; height:32px; border-radius:99px;
            background:var(--border); border:none; cursor:pointer;
            position:relative; transition:background 0.2s cubic-bezier(0.16,1,0.3,1); flex-shrink:0; pointer-events:auto;
        }

            .pf-toggle.on {background:#f97316; }

            .pf-toggle-knob {
                position:absolute; top:4px; left:4px;
            width:24px; height:24px; border-radius:50%;
            background:white; transition:transform 0.2s cubic-bezier(0.16,1,0.3,1); box-shadow:0 2px 8px rgba(0,0,0,0.2);
            display:block;
        }

            .pf-toggle.on .pf-toggle-knob {transform:translateX(24px); }

            /* Password strength */
            .pf-strength-wrap {
                display:flex; align-items:center; gap:12px; margin-bottom:8px;
        }

            .pf-strength-bars {display:flex; gap:6px; }

            .pf-strength-bar {
                width:36px; height:6px; border-radius:99px;
            transition:background 0.2s;
        }

            .pf-strength-label {font - size:14px; font-weight:700; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.5px; }

            /* Messages */
            .pf-error {
                font - size:14px; font-weight:700; color:var(--danger-text);
            background:var(--danger-bg); border-radius:12px; padding:14px 20px; border:1px solid rgba(239,68,68,0.2);
        }

            .pf-success {
                font - size:14px; font-weight:700; color:#16a34a;
            background:rgba(34,197,94,0.1); border-radius:12px; padding:14px 20px; border:2px solid rgba(34,197,94,0.3);
        }

            /* Buttons */
            .pf-btn {
                background:#f97316; color:white; border:none;
            border-radius:16px; padding:16px 32px;
            font-size:16px; font-weight:700; font-family:var(--font-heading);
            cursor:pointer; transition:all 0.2s cubic-bezier(0.16,1,0.3,1); align-self:flex-start;
            display:flex; align-items:center; gap:10px;
            box-shadow:0 8px 24px rgba(249,115,22,0.3);
            min-height:56px; min-width:180px; justify-content:center;
        }

            .pf-btn:hover:not(:disabled) {background:#ea6c0a; transform:translateY(-2px); box-shadow:0 12px 32px rgba(249,115,22,0.4); }
            .pf-btn:disabled {opacity:0.7; cursor:not-allowed; transform:none; box-shadow:none; }

            .pf-btn-outline {
                background:var(--card-bg); border:2px solid var(--border);
            border-radius:16px; padding:14px 28px;
            font-size:15px; font-weight:700;
            font-family:var(--font-heading); cursor:pointer;
            color:var(--text); transition:all 0.2s cubic-bezier(0.16,1,0.3,1);
        }

            .pf-btn-outline:hover {border - color:var(--danger-border); background:var(--danger-bg); color:var(--danger-text); transform:translateY(-1px); }

            .pf-spinner {
                width:20px; height:20px;
            border:3px solid rgba(255,255,255,0.3); border-top-color:white;
            border-radius:50%; animation:pfSpin 0.7s linear infinite; display:inline-block;
        }

            /* Danger zone */
            .pf-danger-zone {display:flex; flex-direction:column; gap:20px; }

            .pf-danger-item {
                display:flex; align-items:center;
            justify-content:space-between; gap:24px;
            padding:24px; background:var(--bg); box-shadow:inset 0 2px 6px rgba(0,0,0,0.02);
            border:2px solid var(--border); border-radius:20px; transition:border-color 0.2s;
        }
            .pf-danger-item:hover {border - color:rgba(239,68,68,0.2); }

            .pf-danger-label {font - family:var(--font-heading); font-size:18px; font-weight:800; color:var(--text); margin:0 0 6px; letter-spacing:-0.3px; }
            .pf-danger-sub {font - size:14px; color:var(--muted); margin:0; font-weight:500; }
      `}</style>
        </div >
    );
}
