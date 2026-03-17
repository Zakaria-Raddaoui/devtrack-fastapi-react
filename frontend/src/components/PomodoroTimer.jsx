import React, { useState, useEffect, useRef } from 'react';

const MODES = {
    pomodoro: { label: 'Pomodoro', minutes: 25 },
    short: { label: 'Short break', minutes: 5 },
    long: { label: 'Long break', minutes: 15 },
};

export default function PomodoroTimer({ onSessionComplete }) {
    const [mode, setMode] = useState('pomodoro');
    const [seconds, setSeconds] = useState(MODES.pomodoro.minutes * 60);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);
    const intervalRef = useRef(null);

    // Reset when mode changes
    useEffect(() => {
        clearInterval(intervalRef.current);
        setRunning(false);
        setDone(false);
        setSeconds(MODES[mode].minutes * 60);
    }, [mode]);

    // Tick
    useEffect(() => {
        if (running) {
            intervalRef.current = setInterval(() => {
                setSeconds(s => {
                    if (s <= 1) {
                        clearInterval(intervalRef.current);
                        setRunning(false);
                        setDone(true);
                        if (mode === 'pomodoro') {
                            onSessionComplete(MODES.pomodoro.minutes);
                        }
                        return 0;
                    }
                    return s - 1;
                });
            }, 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [running, mode, onSessionComplete]);

    const reset = () => {
        clearInterval(intervalRef.current);
        setRunning(false);
        setDone(false);
        setSeconds(MODES[mode].minutes * 60);
    };

    const total = MODES[mode].minutes * 60;
    const pct = ((total - seconds) / total) * 100;
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    const radius = 36;
    const circ = 2 * Math.PI * radius;
    const dash = circ - (pct / 100) * circ;

    return (
        <div className="pomo-root">
            {/* Mode tabs */}
            <div className="pomo-modes">
                {Object.entries(MODES).map(([key, val]) => (
                    <button
                        key={key}
                        type="button"
                        className={`pomo-mode-btn ${mode === key ? 'active' : ''}`}
                        onClick={() => setMode(key)}
                    >
                        {val.label}
                    </button>
                ))}
            </div>

            {/* Timer circle */}
            <div className="pomo-circle-wrap">
                <svg width="96" height="96" viewBox="0 0 96 96">
                    <circle
                        cx="48" cy="48" r={radius}
                        fill="none"
                        stroke="var(--border)"
                        strokeWidth="4"
                    />
                    <circle
                        cx="48" cy="48" r={radius}
                        fill="none"
                        stroke={done ? '#22c55e' : '#f97316'}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={dash}
                        transform="rotate(-90 48 48)"
                        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                    />
                </svg>
                <div className="pomo-time">
                    <span className="pomo-digits">{mins}:{secs}</span>
                    {done && <span className="pomo-done-label">Done!</span>}
                </div>
            </div>

            {/* Controls */}
            <div className="pomo-controls">
                {!done ? (
                    <button
                        type="button"
                        className="pomo-btn primary"
                        onClick={() => setRunning(r => !r)}
                    >
                        {running ? '⏸ Pause' : (seconds < total ? '▶ Resume' : '▶ Start')}
                    </button>
                ) : (
                    <button
                        type="button"
                        className="pomo-btn success"
                        onClick={() => onSessionComplete(MODES.pomodoro.minutes)}
                    >
                        ✓ Use {MODES.pomodoro.minutes} min
                    </button>
                )}
                <button
                    type="button"
                    className="pomo-btn ghost"
                    onClick={reset}
                >
                    ↺ Reset
                </button>
            </div>

            {mode === 'pomodoro' && !done && (
                <p className="pomo-hint">
                    Timer will auto-fill {MODES.pomodoro.minutes} min when complete
                </p>
            )}

            <style>{`
        .pomo-root {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .pomo-modes {
          display: flex; gap: 4px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px; padding: 3px;
          width: 100%;
        }

        .pomo-mode-btn {
          flex: 1; background: none; border: none;
          border-radius: 6px; padding: 5px 8px;
          font-size: 11px; font-weight: 500;
          color: var(--muted); cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.15s; white-space: nowrap;
        }

        .pomo-mode-btn.active {
          background: var(--card-bg);
          color: var(--text);
          box-shadow: 0 1px 3px var(--shadow);
        }

        .pomo-circle-wrap {
          position: relative;
          width: 96px; height: 96px;
          display: flex; align-items: center;
          justify-content: center;
        }

        .pomo-circle-wrap svg {
          position: absolute; top: 0; left: 0;
        }

        .pomo-time {
          position: relative; z-index: 1;
          display: flex; flex-direction: column;
          align-items: center; gap: 2px;
        }

        .pomo-digits {
          font-family: 'Syne', sans-serif;
          font-size: 20px; font-weight: 700;
          color: var(--text); letter-spacing: -1px;
        }

        .pomo-done-label {
          font-size: 10px; font-weight: 600;
          color: #22c55e; text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .pomo-controls {
          display: flex; gap: 8px; width: 100%;
        }

        .pomo-btn {
          flex: 1; border: none; border-radius: 8px;
          padding: 9px; font-size: 13px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center;
          justify-content: center; gap: 5px;
        }

        .pomo-btn.primary {
          background: #f97316; color: white;
          box-shadow: 0 3px 10px rgba(249,115,22,0.3);
        }

        .pomo-btn.primary:hover { background: #ea6c0a; transform: translateY(-1px); }

        .pomo-btn.success {
          background: #22c55e; color: white;
          box-shadow: 0 3px 10px rgba(34,197,94,0.3);
        }

        .pomo-btn.success:hover { background: #16a34a; transform: translateY(-1px); }

        .pomo-btn.ghost {
          background: var(--card-bg);
          border: 1px solid var(--border);
          color: var(--muted);
        }

        .pomo-btn.ghost:hover { color: var(--text); border-color: var(--muted); }

        .pomo-hint {
          font-size: 11px; color: var(--placeholder);
          text-align: center; margin: 0;
        }
      `}</style>
        </div>
    );
}