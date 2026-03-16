import React from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmDialog({ title, message, onConfirm, onCancel, danger = true }) {
    return createPortal(
        <div className="confirm-overlay" onClick={onCancel}>
            <div className="confirm-card" onClick={e => e.stopPropagation()}>
                <div className="confirm-icon-wrap" style={{ background: danger ? 'var(--danger-bg)' : 'var(--hover-bg)' }}>
                    <span style={{ fontSize: 22, color: danger ? 'var(--danger-text)' : '#f97316' }}>
                        {danger ? '⚠' : '?'}
                    </span>
                </div>
                <h3 className="confirm-title">{title}</h3>
                <p className="confirm-message">{message}</p>
                <div className="confirm-actions">
                    <button className="confirm-cancel" onClick={onCancel}>Cancel</button>
                    <button
                        className="confirm-ok"
                        onClick={onConfirm}
                        style={{
                            background: danger ? '#ef4444' : '#f97316',
                            boxShadow: danger
                                ? '0 4px 14px rgba(239,68,68,0.3)'
                                : '0 4px 14px rgba(249,115,22,0.3)',
                        }}
                    >
                        {danger ? 'Delete' : 'Confirm'}
                    </button>
                </div>
            </div>

            <style>{`
        .confirm-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex; align-items: center;
          justify-content: center; z-index: 2000;
          animation: cfadeIn 0.15s ease;
        }

        @keyframes cfadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .confirm-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 32px 28px;
          width: 100%; max-width: 360px;
          display: flex; flex-direction: column;
          align-items: center; text-align: center; gap: 12px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.3);
          animation: cslideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes cslideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .confirm-icon-wrap {
          width: 52px; height: 52px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 4px;
        }

        .confirm-title {
          font-family: 'Syne', sans-serif;
          font-size: 18px; font-weight: 700;
          color: var(--text); margin: 0;
        }

        .confirm-message {
          font-size: 14px; color: var(--muted);
          line-height: 1.55; margin: 0;
        }

        .confirm-actions {
          display: flex; gap: 10px;
          width: 100%; margin-top: 8px;
        }

        .confirm-cancel {
          flex: 1;
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 10px; padding: 11px;
          font-size: 14px; font-weight: 500;
          color: var(--text); cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.2s;
        }

        .confirm-cancel:hover {
          background: var(--hover-bg);
          border-color: #f97316;
          color: #f97316;
        }

        .confirm-ok {
          flex: 1;
          border: none; border-radius: 10px;
          padding: 11px; font-size: 14px;
          font-weight: 600; color: white;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.2s;
        }

        .confirm-ok:hover { opacity: 0.88; transform: translateY(-1px); }
      `}</style>
        </div>,
        document.body
    );
}