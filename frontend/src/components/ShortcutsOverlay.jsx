import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const SHORTCUTS = [
    {
        group: 'Navigation',
        items: [
            { keys: ['Ctrl', '1'], desc: 'Go to Dashboard' },
            { keys: ['Ctrl', '2'], desc: 'Go to Topics' },
            { keys: ['Ctrl', '3'], desc: 'Go to Logs' },
            { keys: ['Ctrl', '4'], desc: 'Go to Notes' },
            { keys: ['Ctrl', '5'], desc: 'Go to Roadmaps' },
            { keys: ['Ctrl', '6'], desc: 'Go to Goals' },
            { keys: ['Ctrl', '7'], desc: 'Go to Resources' },
            { keys: ['Ctrl', '8'], desc: 'Go to Analytics' },
            { keys: ['Ctrl', '9'], desc: 'Go to AI Assistant' },
            { keys: ['Ctrl', '0'], desc: 'Knowledge Graph' },
            { keys: ['Alt', 'C'], desc: 'Go to Confidence' },
            { keys: ['Alt', 'T'], desc: 'Go to To-do (Goals)' },
        ],
    },
    {
        group: 'Global',
        items: [
            { keys: ['Ctrl', 'K'], desc: 'Open search' },
            { keys: ['Ctrl', '/'], desc: 'Show keyboard shortcuts' },
            { keys: ['Ctrl', 'Shift', 'V'], desc: 'Quick Capture (paste URL)' },
            { keys: ['Ctrl', 'Shift', 'S'], desc: 'Start Study Session' },
            { keys: ['Esc'], desc: 'Close modal / overlay' },
        ],
    },
    {
        group: 'Notes editor',
        items: [
            { keys: ['Ctrl', 'E'], desc: 'Toggle edit / preview' },
            { keys: ['Ctrl', 'S'], desc: 'Save note manually' },
        ],
    },
];

export default function ShortcutsOverlay() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            // Ctrl+/ to open shortcuts
            const isShortcutToggle = (e.ctrlKey || e.metaKey) && (
                e.key === '/' ||
                e.key === '?' ||
                e.code === 'Slash'
            );

            if (isShortcutToggle) {
                e.preventDefault();
                setOpen(o => !o);
                return;
            }
            if (e.key === 'Escape') {
                setOpen(false);
                return;
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    if (!open) return null;

    return createPortal(
        <div className="sh-overlay" onClick={() => setOpen(false)}>
            <div className="sh-panel" onClick={e => e.stopPropagation()}>
                <div className="sh-header">
                    <h2 className="sh-title">Keyboard shortcuts</h2>
                    <button className="sh-close" onClick={() => setOpen(false)}>✕</button>
                </div>

                <div className="sh-body">
                    {SHORTCUTS.map(({ group, items }) => (
                        <div key={group} className="sh-group">
                            <p className="sh-group-label">{group}</p>
                            {items.map(({ keys, desc }) => (
                                <div key={desc} className="sh-row">
                                    <span className="sh-desc">{desc}</span>
                                    <div className="sh-keys">
                                        {keys.map((k, i) => (
                                            <React.Fragment key={i}>
                                                <kbd className="sh-kbd">{k}</kbd>
                                                {i < keys.length - 1 && <span className="sh-plus">+</span>}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div className="sh-footer">
                    Press <kbd className="sh-kbd">Ctrl+/</kbd> or <kbd className="sh-kbd">Esc</kbd> to close
                </div>
            </div>

            <style>{`
        .sh-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          animation: shFade 0.2s ease;
        }
        @keyframes shFade { from{opacity:0} to{opacity:1} }

        .sh-panel {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 20px; width: 100%; max-width: 560px;
          max-height: 80vh; display: flex; flex-direction: column;
          box-shadow: 0 32px 80px rgba(0,0,0,0.4);
          animation: shSlide 0.25s cubic-bezier(0.16,1,0.3,1);
          overflow: hidden;
        }
        @keyframes shSlide {
          from{opacity:0;transform:translateY(16px) scale(0.98)}
          to{opacity:1;transform:translateY(0) scale(1)}
        }

        .sh-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:22px 24px 16px; border-bottom:1px solid var(--border); flex-shrink:0;
        }
        .sh-title {
          font-family:'Syne',sans-serif; font-size:18px; font-weight:700; color:var(--text); margin:0;
        }
        .sh-close {
          background:none; border:none; color:var(--muted); font-size:16px;
          cursor:pointer; padding:4px 8px; border-radius:6px; transition:all 0.15s;
        }
        .sh-close:hover { background:var(--hover-bg); color:var(--text); }

        .sh-body { overflow-y:auto; padding:16px 24px; display:flex; flex-direction:column; gap:20px; }

        .sh-group { display:flex; flex-direction:column; gap:4px; }
        .sh-group-label {
          font-size:10px; font-weight:700; color:var(--muted);
          text-transform:uppercase; letter-spacing:0.8px; margin-bottom:4px;
        }

        .sh-row {
          display:flex; align-items:center; justify-content:space-between;
          gap:16px; padding:7px 10px; border-radius:8px; transition:background 0.1s;
        }
        .sh-row:hover { background:var(--hover-bg); }
        .sh-desc { font-size:13px; color:var(--text); }
        .sh-keys { display:flex; align-items:center; gap:4px; flex-shrink:0; }

        .sh-kbd {
          display:inline-flex; align-items:center; justify-content:center;
          background:var(--bg); border:1px solid var(--border);
          border-bottom:2px solid var(--border); border-radius:6px;
          padding:3px 8px; font-size:11px; font-weight:600;
          color:var(--text); font-family:'DM Sans',sans-serif; min-width:28px;
        }
        .sh-plus { font-size:11px; color:var(--muted); }

        .sh-footer {
          padding:14px 24px; border-top:1px solid var(--border);
          font-size:12px; color:var(--muted); text-align:center; flex-shrink:0;
        }
      `}</style>
        </div>,
        document.body
    );
}
