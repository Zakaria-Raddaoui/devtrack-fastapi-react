import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';

// ─── Shared styles ───────────────────────────────────────────────────────────
const STYLES = `
  .roadmaps-root, .detail-root {
    padding: 60px 48px;
    width: 100%;
    box-sizing: border-box;
    animation: rm-fadeIn 0.4s ease forwards;
    background: var(--bg);
  }
  .detail-root { max-width: 100%; }

  @keyframes rm-fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .rm-loading {
    display: flex; align-items: center;
    justify-content: center; height: 100vh;
  }

  .rm-ring {
    width: 48px; height: 48px;
    border: 4px solid var(--border);
    border-top-color: #f97316;
    border-radius: 50%;
    animation: rm-spin 0.8s linear infinite;
  }

  @keyframes rm-spin { to { transform: rotate(360deg); } }

  .rm-page-header {
    display: flex; align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 40px; gap: 24px; flex-wrap: wrap;
  }

  .rm-page-title {
    font-family: var(--font-heading);
    font-size: 38px; font-weight: 800;
    color: var(--text); letter-spacing: -1.5px;
    margin: 0 0 6px;
  }

  .rm-page-sub { font-size: 15px; color: var(--muted); margin: 0; font-weight: 500; }

  .rm-primary-btn {
    display: flex; align-items: center; gap: 8px;
    background: #f97316; color: white; border: none;
    border-radius: 12px; padding: 14px 24px;
    font-size: 15px; font-weight: 700;
    font-family: var(--font-heading);
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 8px 24px rgba(249,115,22,0.3);
    white-space: nowrap; flex-shrink: 0;
  }
  .rm-primary-btn:hover { background: #ea6c0a; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(249,115,22,0.4); }
  .rm-primary-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; box-shadow: none; }

  /* Grid */
  .rm-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 24px;
  }

  /* Card */
  .rm-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 24px; padding: 32px;
    cursor: pointer;
    display: flex; flex-direction: column; gap: 16px;
    transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
    position: relative;
    box-shadow: 0 12px 32px var(--shadow), 0 4px 12px rgba(0,0,0,0.02);
  }
  .rm-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 40px var(--shadow);
    border-color: rgba(249,115,22,0.3);
  }

  .rm-card-top {
    display: flex; align-items: center;
    justify-content: space-between;
  }

  .rm-card-icon { font-size: 28px; color: #f97316; font-weight: 700; background: rgba(249,115,22,0.15); width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 16px; }

  .rm-card-actions {
    display: flex; gap: 6px;
    opacity: 0; transition: opacity 0.2s;
  }
  .rm-card:hover .rm-card-actions { opacity: 1; }

  .rm-card-title {
    font-family: var(--font-heading);
    font-size: 22px; font-weight: 800;
    color: var(--text); margin: 0; letter-spacing: -0.5px;
  }

  .rm-card-desc {
    font-size: 14px; color: var(--muted);
    line-height: 1.6; margin: 0; font-weight: 500;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .rm-card-footer {
    display: flex; gap: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .rm-card-meta { font-size: 13px; color: var(--muted); font-weight: 600; }

  /* AI badge on card */
  .rm-ai-badge {
    font-size: 11px; font-weight: 800;
    background: rgba(249,115,22,0.15);
    color: #f97316; border-radius: 99px;
    padding: 4px 10px; letter-spacing: 0.5px;
    text-transform: uppercase; font-family: var(--font-heading);
  }

  /* Progress bar */
  .rm-progress-wrap { display: flex; flex-direction: column; gap: 8px; }

  .rm-progress-track {
    height: 6px; border-radius: 99px;
    background: var(--border); overflow: hidden;
  }

  .rm-progress-fill {
    height: 100%; border-radius: 99px;
    transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .rm-progress-label { font-size: 13px; font-weight: 700; font-family: var(--font-heading); color: var(--text); }

  /* Detail view */
  .rm-back-btn {
    background: var(--card-bg); border: 1px solid var(--border);
    color: var(--muted); cursor: pointer;
    font-size: 14px; font-weight: 600;
    font-family: var(--font-body);
    padding: 8px 16px; margin-bottom: 24px;
    transition: all 0.2s; display: inline-flex; border-radius: 12px; box-shadow: 0 4px 12px var(--shadow);
  }
  .rm-back-btn:hover { color: #f97316; border-color: rgba(249,115,22,0.3); transform: translateX(-4px); box-shadow: 0 8px 24px rgba(249,115,22,0.1); }

  .rm-detail-header { margin-bottom: 40px; display: flex; flex-direction: column; gap: 16px; }

  .rm-detail-title-row {
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 16px;
  }

  .rm-detail-title {
    font-family: var(--font-heading);
    font-size: 38px; font-weight: 800;
    color: var(--text); letter-spacing: -1.5px; margin: 0 0 6px;
  }

  .rm-detail-desc {
    font-size: 16px; color: var(--muted);
    line-height: 1.6; margin: 0; font-weight: 500;
  }

  .rm-big-progress { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }

  .rm-big-track {
    height: 10px; border-radius: 99px;
    background: var(--border); overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
  }

  .rm-big-fill {
    height: 100%; border-radius: 99px;
    transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .rm-big-meta {
    display: flex; justify-content: space-between;
    font-size: 14px; font-weight: 700; font-family: var(--font-heading); color: var(--muted);
  }

  /* Steps */
  .rm-steps-list { display: flex; flex-direction: column; gap: 12px; }

  .rm-steps-empty {
    text-align: center; padding: 60px 40px;
    color: var(--muted); font-size: 15px; font-weight: 500;
    border: 2px dashed var(--border);
    border-radius: 24px; background: rgba(0,0,0,0.02);
  }

  .rm-step {
    display: flex; align-items: flex-start; gap: 20px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 20px; padding: 24px;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 8px 24px var(--shadow);
  }
  .rm-step:hover { box-shadow: 0 12px 32px var(--shadow); transform: translateY(-2px); border-color: rgba(255,255,255,0.1); }
  .rm-step.done { opacity: 0.7; background: color-mix(in srgb, var(--card-bg) 95%, transparent); }

  .rm-step-left {
    display: flex; align-items: center; gap: 14px;
    flex-shrink: 0; padding-top: 2px;
  }

  .rm-check {
    width: 28px; height: 28px; border-radius: 50%;
    border: 2px solid var(--border);
    background: var(--bg); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: transparent;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); flex-shrink: 0;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
  }
  .rm-check.checked {
    background: #22c55e; border-color: #22c55e; color: white;
    box-shadow: 0 0 0 4px rgba(34,197,94,0.2);
    animation: rmCheckPop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes rmCheckPop {
    0%   { transform: scale(0.8); }
    50%  { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
  .rm-check:hover:not(.checked) {
    border-color: #22c55e;
    background: rgba(34,197,94,0.05);
  }

  .rm-step-num {
    font-size: 14px; font-weight: 800; font-family: var(--font-heading);
    color: var(--muted);
    min-width: 20px; text-align: center;
  }

  .rm-step-body { flex: 1; min-width: 0; }

  .rm-step-title-row {
    display: flex; align-items: center;
    gap: 8px; flex-wrap: wrap; margin-bottom: 6px;
  }

  .rm-step-title { font-size: 18px; font-weight: 800; font-family: var(--font-heading); color: var(--text); }
  .rm-step.done .rm-step-title { text-decoration: line-through; color: var(--muted); }

  .rm-step-topic {
    font-size: 11px; font-weight: 800;
    background: rgba(249,115,22,0.15); color: #f97316;
    padding: 4px 10px; border-radius: 99px;
    text-transform: uppercase; letter-spacing: 0.5px;
    font-family: var(--font-heading);
  }

  .rm-step-desc {
    font-size: 14px; color: var(--muted);
    line-height: 1.6; margin: 0; font-weight: 500;
  }

  .rm-step-actions {
    display: flex; gap: 8px;
    opacity: 0; transition: opacity 0.2s;
    flex-shrink: 0;
  }
  .rm-step:hover .rm-step-actions { opacity: 1; }

  .rm-add-step-btn {
    display: flex; align-items: center; gap: 8px;
    background: var(--card-bg);
    border: 2px dashed var(--border);
    border-radius: 20px; padding: 20px 24px;
    font-size: 15px; font-weight: 700;
    color: var(--muted); cursor: pointer;
    font-family: var(--font-heading);
    transition: all 0.2s; width: 100%;
    justify-content: center; margin-top: 12px;
  }
  .rm-add-step-btn:hover {
    border-color: rgba(249,115,22,0.3); color: #f97316;
    background: rgba(249,115,22,0.05); transform: translateY(-2px); box-shadow: 0 8px 24px var(--shadow);
  }

  /* Two-column layout */
  .rm-detail-header-wrap { margin-bottom: 40px; }

  .rm-detail-title-row {
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 24px; flex-wrap: wrap;
  }

  .rm-detail-title-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }

  .rm-detail-title-actions {
    display: flex; align-items: center; gap: 12px; flex-shrink: 0;
  }

  .rm-header-progress { display: flex; align-items: center; gap: 12px; }

  .rm-header-track {
    width: 140px; height: 8px; border-radius: 99px;
    background: var(--border); overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
  }

  .rm-header-fill {
    height: 100%; border-radius: 99px;
    transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .rm-panel-toggle {
    background: var(--card-bg); border: 1px solid var(--border);
    border-radius: 12px; padding: 10px 14px;
    font-size: 18px; color: var(--muted);
    cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px var(--shadow);
  }
  .rm-panel-toggle:hover { border-color: rgba(249,115,22,0.3); color: #f97316; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(249,115,22,0.1); }
  .rm-panel-toggle.active { color: #f97316; border-color: rgba(249,115,22,0.5); background: rgba(249,115,22,0.05); }

  .rm-two-col {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 40px; align-items: start;
  }
  .rm-two-col.panel-hidden { grid-template-columns: 1fr; }

  .rm-col-steps { display: flex; flex-direction: column; }
  .rm-col-summary { display: flex; flex-direction: column; gap: 24px; position: sticky; top: 40px; }

  .rm-summary-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 24px; padding: 32px; box-shadow: 0 16px 40px var(--shadow); transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
    display: flex; flex-direction: column;
    align-items: center; gap: 24px;
  }

  .rm-ring-wrap {
    position: relative;
    width: 140px; height: 140px;
    display: flex; align-items: center; justify-content: center;
  }
  .rm-ring-wrap svg { position: absolute; top: 0; left: 0; filter: drop-shadow(0 4px 8px rgba(249,115,22,0.2)); }

  .rm-ring-label {
    position: relative; z-index: 1;
    display: flex; flex-direction: column;
    align-items: center; gap: 4px;
  }

  .rm-ring-pct {
    font-family: var(--font-heading);
    font-size: 32px; font-weight: 800;
    letter-spacing: -1.5px; line-height: 1; color: var(--text);
  }

  .rm-ring-sub {
    font-size: 12px; color: var(--muted);
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-family: var(--font-heading);
  }

  .rm-summary-stats {
    width: 100%;
    display: flex; flex-direction: column; gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .rm-stat-row { display: flex; align-items: center; gap: 10px; }
  .rm-stat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .rm-stat-label { font-size: 14px; color: var(--muted); flex: 1; font-weight: 500; }
  .rm-stat-val { font-size: 16px; font-weight: 800; font-family: var(--font-heading); color: var(--text); }

  .rm-topics-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 24px; padding: 28px; box-shadow: 0 12px 32px var(--shadow);
    display: flex; flex-direction: column; gap: 16px;
  }

  .rm-topics-card-title, .rm-summary-card-title {
    font-size: 14px; font-weight: 800; font-family: var(--font-heading);
    color: var(--muted); text-transform: uppercase;
    letter-spacing: 0.5px; margin: 0;
  }

  .rm-linked-topics { display: flex; flex-direction: column; gap: 12px; }

  .rm-linked-topic {
    display: flex; align-items: center;
    justify-content: space-between; gap: 12px;
    font-size: 14px; color: var(--text); font-weight: 600;
  }

  .rm-linked-topic-name { flex: 1; }

  .rm-linked-topic-count {
    font-size: 13px; font-weight: 800; font-family: var(--font-heading); color: #f97316;
    background: rgba(249,115,22,0.15); padding: 4px 12px; border-radius: 99px;
  }

  .rm-linked-dot { width: 8px; height: 8px; border-radius: 50%; background: #f97316; flex-shrink: 0; }
  .rm-no-topics { font-size: 14px; color: var(--placeholder); font-weight: 500; }

  .rm-summary-meta { gap: 16px !important; }

  .rm-meta-row {
    display: flex; align-items: center;
    justify-content: space-between; gap: 12px;
  }

  .rm-meta-label { font-size: 14px; color: var(--muted); font-weight: 500; }
  .rm-meta-val { font-size: 14px; font-weight: 800; font-family: var(--font-heading); color: var(--text); text-align: right; }

  /* Empty state */
  .rm-empty {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 100px 20px; gap: 16px; text-align: center;
  }
  .rm-empty-icon { font-size: 64px; color: var(--border); margin-bottom: 8px; }
  .rm-empty-title { font-family: var(--font-heading); font-size: 24px; font-weight: 800; color: var(--text); }
  .rm-empty-sub { font-size: 16px; color: var(--muted); margin-bottom: 8px; max-width: 400px; line-height: 1.6; }

  /* Icon buttons */
  .rm-icon-btn {
    background: var(--card-bg); border: 1px solid var(--border);
    border-radius: 10px; padding: 8px 12px;
    font-size: 15px; cursor: pointer;
    transition: all 0.2s; font-family: var(--font-body);
    color: var(--muted); display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px var(--shadow);
  }
  .rm-icon-btn.edit:hover { background: rgba(249,115,22,0.1); border-color: rgba(249,115,22,0.3); color: #f97316; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(249,115,22,0.1); }
  .rm-icon-btn.del:hover  { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #ef4444; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(239,68,68,0.1); }

  /* Modal */
  .rm-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(8px);
    display: flex; align-items: center;
    justify-content: center; z-index: 1000; padding: 24px;
  }

  .rm-modal {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 32px; padding: 48px; width: 100%; max-width: 520px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px var(--border);
    animation: rm-slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes rm-slideUp {
    from { opacity: 0; transform: translateY(32px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .rm-modal-header {
    display: flex; align-items: center;
    justify-content: space-between; margin-bottom: 32px;
  }

  .rm-modal-header h2 {
    font-family: var(--font-heading);
    font-size: 28px; font-weight: 800; color: var(--text); letter-spacing: -0.5px;
  }

  .rm-modal-close {
    background: var(--card-bg); border: 1px solid var(--border); color: var(--muted);
    font-size: 18px; cursor: pointer; padding: 8px 12px;
    border-radius: 12px; transition: all 0.2s; box-shadow: 0 2px 8px var(--shadow);
  }
  .rm-modal-close:hover { background: var(--hover-bg); color: var(--text); border-color: var(--muted); transform: translateY(-2px); }

  .rm-modal-form { display: flex; flex-direction: column; gap: 24px; }

  .rm-field { display: flex; flex-direction: column; gap: 8px; }
  .rm-field label { font-size: 14px; font-weight: 700; font-family: var(--font-heading); color: var(--text); letter-spacing: 0.3px; text-transform: uppercase; }
  .rm-optional { font-weight: 500; color: var(--placeholder); text-transform: none; letter-spacing: 0; font-family: var(--font-body); }

  .rm-field input, .rm-field select, .rm-field textarea {
    background: var(--input-bg);
    border: 2px solid var(--border);
    border-radius: 16px; padding: 16px 20px;
    font-size: 16px; color: var(--text);
    font-family: var(--font-body); font-weight: 500;
    outline: none; resize: vertical;
    transition: all 0.2s; box-shadow: inset 0 2px 6px var(--shadow);
  }
  .rm-field input:focus, .rm-field select:focus, .rm-field textarea:focus {
    border-color: #f97316; background: var(--bg);
    box-shadow: 0 0 0 4px rgba(249,115,22,0.15), inset 0 2px 6px rgba(0,0,0,0.02);
  }
  .rm-field select option { background: var(--card-bg); }

  .rm-checkbox-label {
    display: flex; align-items: center; gap: 8px;
    font-size: 14px; color: var(--text);
    cursor: pointer; font-family: var(--font-body);
  }
  .rm-checkbox-label input { cursor: pointer; width: 16px; height: 16px; }

  .rm-form-error {
    font-size: 13px; color: var(--danger-text);
    background: var(--danger-bg);
    border-radius: 8px; padding: 10px 14px;
  }

  .rm-submit-btn {
    background: #f97316; color: white; border: none;
    border-radius: 10px; padding: 12px;
    font-size: 14px; font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer; transition: all 0.2s;
    display: flex; align-items: center;
    justify-content: center; min-height: 44px;
    box-shadow: 0 4px 16px rgba(249,115,22,0.3);
  }
  .rm-submit-btn:hover:not(:disabled) { background: #ea6c0a; transform: translateY(-1px); }
  .rm-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

  .rm-spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white; border-radius: 50%;
    animation: rm-spin 0.7s linear infinite;
    display: inline-block;
  }

  /* ── AI Generate modal specific styles ── */
  .rm-gen-ai-header {
    display: flex; align-items: center; gap: 10px; margin-bottom: 6px;
  }

  .rm-gen-ai-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.08));
    border: 1px solid rgba(249,115,22,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0;
  }

  .rm-gen-ai-title {
    font-family: var(--font-heading);
    font-size: 20px; font-weight: 700; color: var(--text); margin: 0;
  }

  .rm-gen-ai-sub {
    font-size: 13px; color: var(--muted); margin: 0 0 24px; line-height: 1.5;
  }

  .rm-skill-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  }

  .rm-skill-option {
    border: 1.5px solid var(--border);
    border-radius: 10px; padding: 12px 10px;
    cursor: pointer; transition: all 0.2s;
    text-align: center; background: none;
    font-family: var(--font-body);
  }
  .rm-skill-option:hover { border-color: #f97316; background: rgba(249,115,22,0.04); }
  .rm-skill-option.selected {
    border-color: #f97316; background: rgba(249,115,22,0.08);
  }

  .rm-skill-emoji { font-size: 20px; display: block; margin-bottom: 4px; }

  .rm-skill-label {
    font-size: 12px; font-weight: 600; color: var(--text);
    display: block; margin-bottom: 2px;
  }

  .rm-skill-desc { font-size: 11px; color: var(--muted); display: block; }

  .rm-generating-state {
    display: flex; flex-direction: column;
    align-items: center; gap: 16px;
    padding: 24px 0; text-align: center;
  }

  .rm-gen-ring {
    width: 48px; height: 48px;
    border: 3px solid var(--border);
    border-top-color: #f97316;
    border-radius: 50%;
    animation: rm-spin 0.8s linear infinite;
  }

  .rm-gen-title {
    font-family: var(--font-heading);
    font-size: 16px; font-weight: 700; color: var(--text); margin: 0;
  }

  .rm-gen-sub { font-size: 13px; color: var(--muted); margin: 0; }

  .rm-gen-steps-preview {
    width: 100%; display: flex; flex-direction: column; gap: 6px; margin-top: 4px;
  }

  .rm-gen-step-pill {
    background: var(--input-bg); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px;
    font-size: 12px; color: var(--muted);
    display: flex; align-items: center; gap: 8px;
    animation: rm-fadeIn 0.3s ease forwards;
  }

  .rm-gen-step-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #f97316; flex-shrink: 0;
  }

  .rm-divider {
    height: 1px; background: var(--border); margin: 4px 0;
  }

  .rm-or-text {
    font-size: 12px; color: var(--placeholder);
    text-align: center; margin: 0;
  }

  .rm-ghost-btn {
    background: none; border: 1px solid var(--border);
    border-radius: 10px; padding: 10px;
    font-size: 13px; font-weight: 500; color: var(--muted);
    cursor: pointer; transition: all 0.2s;
    font-family: var(--font-body);
    display: flex; align-items: center;
    justify-content: center;
  }
  .rm-ghost-btn:hover { border-color: var(--muted); color: var(--text); }
`;

function StyleInjector() {
    useEffect(() => {
        const id = 'roadmaps-styles';
        if (!document.getElementById(id)) {
            const tag = document.createElement('style');
            tag.id = id;
            tag.textContent = STYLES;
            document.head.appendChild(tag);
        }
        return () => {
            const tag = document.getElementById(id);
            if (tag) tag.remove();
        };
    }, []);
    return null;
}

// ─── AI Generate Modal ────────────────────────────────────────────────────────

const SKILL_LEVELS = [
    { value: 'beginner', emoji: '🌱', label: 'Beginner', desc: 'Just starting out' },
    { value: 'intermediate', emoji: '⚡', label: 'Intermediate', desc: 'Some experience' },
    { value: 'advanced', emoji: '🚀', label: 'Advanced', desc: 'Ready to go deep' },
];

// Animated placeholder titles to inspire the user
const EXAMPLE_TITLES = [
    'Becoming a DevOps Engineer',
    'Mastering React & TypeScript',
    'Learning System Design',
    'Full Stack with FastAPI',
    'Machine Learning Fundamentals',
];

function GenerateModal({ onClose, onCreated }) {
    const [title, setTitle] = useState('');
    const [skillLevel, setSkillLevel] = useState('beginner');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [placeholder, setPlaceholder] = useState(EXAMPLE_TITLES[0]);

    // Cycle placeholder text for inspiration
    useEffect(() => {
        let i = 0;
        const id = setInterval(() => {
            i = (i + 1) % EXAMPLE_TITLES.length;
            setPlaceholder(EXAMPLE_TITLES[i]);
        }, 2500);
        return () => clearInterval(id);
    }, []);

    const generate = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/roadmaps/generate', {
                title: title.trim(),
                skill_level: skillLevel,
            });
            onCreated(res.data);
            onClose();
        } catch (err) {
            const d = err.response?.data?.detail;
            setError(typeof d === 'string' ? d : 'Generation failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="rm-overlay" onClick={!loading ? onClose : undefined}>
            <div className="rm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>

                {loading ? (
                    /* ── Generating state ── */
                    <div className="rm-generating-state">
                        <div className="rm-gen-ring" />
                        <p className="rm-gen-title">Building your roadmap…</p>
                        <p className="rm-gen-sub">
                            AI is crafting a personalised path for <strong>"{title}"</strong>
                        </p>
                        <div className="rm-gen-steps-preview">
                            {['Analysing your skill level', 'Reviewing your existing topics', 'Ordering steps from foundation to mastery', 'Linking steps to your topics'].map((s, i) => (
                                <div key={i} className="rm-gen-step-pill" style={{ animationDelay: `${i * 0.15}s` }}>
                                    <div className="rm-gen-step-dot" />
                                    {s}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="rm-modal-header">
                            <div className="rm-gen-ai-header">
                                <div className="rm-gen-ai-icon">✦</div>
                                <h2 className="rm-gen-ai-title">Generate roadmap</h2>
                            </div>
                            <button className="rm-modal-close" onClick={onClose}>✕</button>
                        </div>

                        <p className="rm-gen-ai-sub">
                            Describe your goal and AI will build a complete, ordered learning path tailored to your skill level and existing knowledge.
                        </p>

                        <form onSubmit={generate} className="rm-modal-form">
                            <div className="rm-field">
                                <label>What do you want to achieve?</label>
                                <input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder={placeholder}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="rm-field">
                                <label>Your current skill level</label>
                                <div className="rm-skill-grid">
                                    {SKILL_LEVELS.map(s => (
                                        <button
                                            key={s.value}
                                            type="button"
                                            className={`rm-skill-option ${skillLevel === s.value ? 'selected' : ''}`}
                                            onClick={() => setSkillLevel(s.value)}
                                        >
                                            <span className="rm-skill-emoji">{s.emoji}</span>
                                            <span className="rm-skill-label">{s.label}</span>
                                            <span className="rm-skill-desc">{s.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {error && <p className="rm-form-error">{error}</p>}

                            <button type="submit" className="rm-submit-btn" disabled={!title.trim()}>
                                ✦ Generate roadmap
                            </button>

                            <div className="rm-divider" />
                            <p className="rm-or-text">Prefer to build it yourself?</p>

                            <ManualCreateInline onCreated={onCreated} onClose={onClose} />
                        </form>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
}

// ─── Inline manual create (inside generate modal, collapsed by default) ───────

function ManualCreateInline({ onCreated, onClose }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ title: '', description: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const submit = async e => {
        e.preventDefault(); setLoading(true); setError('');
        try {
            const res = await api.post('/roadmaps/', form);
            onCreated(res.data);
            onClose();
        } catch (err) {
            const d = err.response?.data?.detail;
            setError(typeof d === 'string' ? d : 'Something went wrong');
        } finally { setLoading(false); }
    };

    if (!open) return (
        <button type="button" className="rm-ghost-btn" onClick={() => setOpen(true)}>
            Create blank roadmap manually
        </button>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="rm-field">
                <label>Title</label>
                <input name="title" value={form.title} onChange={handle}
                    placeholder="e.g. My custom roadmap" required autoFocus />
            </div>
            <div className="rm-field">
                <label>Description <span className="rm-optional">(optional)</span></label>
                <textarea name="description" value={form.description} onChange={handle}
                    placeholder="What's this roadmap about?" rows={2} />
            </div>
            {error && <p className="rm-form-error">{error}</p>}
            <button
                type="button"
                className="rm-submit-btn"
                disabled={loading || !form.title.trim()}
                onClick={submit}
                style={{ background: '#374151' }}
            >
                {loading ? <span className="rm-spinner" /> : 'Create blank roadmap'}
            </button>
        </div>
    );
}

// ─── Edit roadmap modal (title/desc only) ────────────────────────────────────

function RoadmapModal({ roadmap, onClose, onSaved }) {
    const [form, setForm] = useState({ title: roadmap?.title || '', description: roadmap?.description || '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const submit = async e => {
        e.preventDefault(); setLoading(true); setError('');
        try {
            await api.put(`/roadmaps/${roadmap.id}`, form);
            onSaved(); onClose();
        } catch (err) {
            const d = err.response?.data?.detail;
            setError(typeof d === 'string' ? d : 'Something went wrong');
        } finally { setLoading(false); }
    };

    return createPortal(
        <div className="rm-overlay" onClick={onClose}>
            <div className="rm-modal" onClick={e => e.stopPropagation()}>
                <div className="rm-modal-header">
                    <h2>Edit roadmap</h2>
                    <button className="rm-modal-close" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit} className="rm-modal-form">
                    <div className="rm-field">
                        <label>Title</label>
                        <input name="title" value={form.title} onChange={handle} required autoFocus />
                    </div>
                    <div className="rm-field">
                        <label>Description <span className="rm-optional">(optional)</span></label>
                        <textarea name="description" value={form.description} onChange={handle} rows={3} />
                    </div>
                    {error && <p className="rm-form-error">{error}</p>}
                    <button type="submit" className="rm-submit-btn" disabled={loading}>
                        {loading ? <span className="rm-spinner" /> : 'Save changes'}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}

// ─── Step modal ───────────────────────────────────────────────────────────────

function StepModal({ step, roadmapId, topics, nextOrder, onClose, onSaved }) {
    const editing = !!step?.id;
    const [form, setForm] = useState({
        title: step?.title || '',
        description: step?.description || '',
        topic_id: step?.topic_id || '',
        order: step?.order ?? nextOrder,
        is_completed: step?.is_completed || false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = e => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm(f => ({ ...f, [e.target.name]: val }));
    };

    const submit = async e => {
        e.preventDefault(); setLoading(true); setError('');
        try {
            const payload = { ...form, topic_id: form.topic_id ? parseInt(form.topic_id) : null, order: parseInt(form.order) };
            if (editing) await api.put(`/roadmaps/${roadmapId}/steps/${step.id}`, payload);
            else await api.post(`/roadmaps/${roadmapId}/steps`, payload);
            onSaved(); onClose();
        } catch (err) {
            const d = err.response?.data?.detail;
            setError(typeof d === 'string' ? d : 'Something went wrong');
        } finally { setLoading(false); }
    };

    return createPortal(
        <div className="rm-overlay" onClick={onClose}>
            <div className="rm-modal" onClick={e => e.stopPropagation()}>
                <div className="rm-modal-header">
                    <h2>{editing ? 'Edit step' : 'Add step'}</h2>
                    <button className="rm-modal-close" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit} className="rm-modal-form">
                    <div className="rm-field">
                        <label>Step title</label>
                        <input name="title" value={form.title} onChange={handle}
                            placeholder="e.g. Learn Docker basics" required autoFocus />
                    </div>
                    <div className="rm-field">
                        <label>Description <span className="rm-optional">(optional)</span></label>
                        <textarea name="description" value={form.description} onChange={handle}
                            placeholder="What does this step cover?" rows={2} />
                    </div>
                    <div className="rm-field">
                        <label>Link to topic <span className="rm-optional">(optional)</span></label>
                        <select name="topic_id" value={form.topic_id} onChange={handle}>
                            <option value="">No topic linked</option>
                            {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                    </div>
                    {editing && (
                        <label className="rm-checkbox-label">
                            <input type="checkbox" name="is_completed" checked={form.is_completed} onChange={handle} />
                            Mark as completed
                        </label>
                    )}
                    {error && <p className="rm-form-error">{error}</p>}
                    <button type="submit" className="rm-submit-btn" disabled={loading}>
                        {loading ? <span className="rm-spinner" /> : (editing ? 'Save changes' : 'Add step')}
                    </button>
                </form>
            </div>
        </div>,
        document.body
    );
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function RoadmapDetail({ roadmap, topics, onBack, onUpdated }) {
    const [steps, setSteps] = useState(roadmap.steps || []);
    const [stepModal, setStepModal] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [editModal, setEditModal] = useState(false);
    const [panelOpen, setPanelOpen] = useState(true);

    const refresh = useCallback(async () => {
        const res = await api.get(`/roadmaps/${roadmap.id}`);
        setSteps(res.data.steps);
        onUpdated(res.data);
    }, [roadmap.id, onUpdated]);

    const toggleStep = async (step) => {
        try {
            await api.put(`/roadmaps/${roadmap.id}/steps/${step.id}`, { is_completed: !step.is_completed });
            refresh();
        } catch (e) { console.error(e); }
    };

    const deleteStep = async (stepId) => {
        try {
            await api.delete(`/roadmaps/${roadmap.id}/steps/${stepId}`);
            refresh();
        } catch (e) { console.error(e); }
    };

    const done = steps.filter(s => s.is_completed).length;
    const total = steps.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const color = pct === 100 ? '#22c55e' : pct >= 60 ? '#f97316' : '#3b82f6';

    return (
        <div className="detail-root">
            <div className="rm-detail-header-wrap">
                <button className="rm-back-btn" onClick={onBack}>← Back to roadmaps</button>
                <div className="rm-detail-title-row">
                    <div className="rm-detail-title-left">
                        <h1 className="rm-detail-title">{roadmap.title}</h1>
                        {roadmap.description && <p className="rm-detail-desc">{roadmap.description}</p>}
                    </div>
                    <div className="rm-detail-title-actions">
                        {total > 0 && (
                            <div className="rm-header-progress">
                                <div className="rm-header-track">
                                    <div className="rm-header-fill" style={{ width: `${pct}%`, background: color }} />
                                </div>
                                <span style={{ color, fontSize: 12, fontWeight: 700 }}>{pct}%</span>
                                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{done}/{total}</span>
                            </div>
                        )}
                        <button className="rm-icon-btn edit" onClick={() => setEditModal(true)} title="Edit roadmap">✎</button>
                        <button
                            className={`rm-panel-toggle ${panelOpen ? 'active' : ''}`}
                            onClick={() => setPanelOpen(o => !o)}
                            title={panelOpen ? 'Hide panel' : 'Show panel'}
                        >
                            {panelOpen ? '⊟' : '⊞'}
                        </button>
                    </div>
                </div>
            </div>

            <div className={`rm-two-col ${panelOpen ? '' : 'panel-hidden'}`}>
                {/* Left — steps */}
                <div className="rm-col-steps">
                    <div className="rm-steps-list">
                        {steps.length === 0 ? (
                            <div className="rm-steps-empty">
                                <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>⟶</div>
                                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>No steps yet</p>
                                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>Add steps manually below</p>
                                <button className="rm-primary-btn" onClick={() => setStepModal({})}>+ Add first step</button>
                            </div>
                        ) : (
                            steps.map((step, i) => {
                                const linked = topics.find(t => t.id === step.topic_id);
                                return (
                                    <div key={step.id} className={`rm-step ${step.is_completed ? 'done' : ''}`}>
                                        <div className="rm-step-left">
                                            <button
                                                className={`rm-check ${step.is_completed ? 'checked' : ''}`}
                                                onClick={() => toggleStep(step)}
                                                type="button"
                                            >
                                                {step.is_completed ? '✓' : ''}
                                            </button>
                                            <div className="rm-step-num">{i + 1}</div>
                                        </div>
                                        <div className="rm-step-body">
                                            <div className="rm-step-title-row">
                                                <span className="rm-step-title">{step.title}</span>
                                                {linked && <span className="rm-step-topic">{linked.title}</span>}
                                            </div>
                                            {step.description && <p className="rm-step-desc">{step.description}</p>}
                                        </div>
                                        <div className="rm-step-actions">
                                            <button className="rm-icon-btn edit" onClick={() => setStepModal(step)} title="Edit">✎</button>
                                            <button className="rm-icon-btn del" onClick={() => setConfirm(step.id)} title="Delete">✕</button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        {steps.length > 0 && (
                            <button className="rm-add-step-btn" onClick={() => setStepModal({})}>
                                + Add step
                            </button>
                        )}
                    </div>
                </div>

                {/* Right — summary panel */}
                {panelOpen && (
                    <div className="rm-col-summary">
                        <div className="rm-summary-card">
                            <div className="rm-ring-wrap">
                                <svg width="140" height="140" viewBox="0 0 140 140">
                                    <circle cx="70" cy="70" r="60" fill="none" stroke="var(--border)" strokeWidth="10" />
                                    <circle
                                        cx="70" cy="70" r="60"
                                        fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                                        strokeDasharray={`${2 * Math.PI * 60}`}
                                        strokeDashoffset={`${2 * Math.PI * 60 * (1 - pct / 100)}`}
                                        transform="rotate(-90 70 70)"
                                        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1), stroke 0.3s' }}
                                    />
                                </svg>
                                <div className="rm-ring-label">
                                    <span className="rm-ring-pct" style={{ color }}>{pct}%</span>
                                    <span className="rm-ring-sub">{total > 0 ? `${done}/${total}` : 'complete'}</span>
                                </div>
                            </div>

                            <div className="rm-summary-stats">
                                <div className="rm-stat-row">
                                    <span className="rm-stat-dot" style={{ background: '#22c55e' }} />
                                    <span className="rm-stat-label">Completed</span>
                                    <span className="rm-stat-val" style={{ color: '#22c55e' }}>{done}</span>
                                </div>
                                <div className="rm-stat-row">
                                    <span className="rm-stat-dot" style={{ background: '#3b82f6' }} />
                                    <span className="rm-stat-label">Remaining</span>
                                    <span className="rm-stat-val" style={{ color: '#3b82f6' }}>{total - done}</span>
                                </div>
                                <div className="rm-stat-row">
                                    <span className="rm-stat-dot" style={{ background: 'var(--muted)' }} />
                                    <span className="rm-stat-label">Total steps</span>
                                    <span className="rm-stat-val">{total}</span>
                                </div>
                            </div>
                        </div>

                        {/* Linked topics */}
                        {topics.filter(t => steps.some(s => s.topic_id === t.id)).length > 0 && (
                            <div className="rm-summary-card">
                                <h3 className="rm-summary-card-title">Linked topics</h3>
                                <div className="rm-linked-topics">
                                    {topics
                                        .filter(t => steps.some(s => s.topic_id === t.id))
                                        .map(t => {
                                            const stepsDone = steps.filter(s => s.topic_id === t.id && s.is_completed).length;
                                            const stepsTotal = steps.filter(s => s.topic_id === t.id).length;
                                            return (
                                                <div key={t.id} className="rm-linked-topic">
                                                    <span className="rm-linked-topic-name">{t.title}</span>
                                                    <span className="rm-linked-topic-count">{stepsDone}/{stepsTotal}</span>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            </div>
                        )}

                        {/* Meta */}
                        <div className="rm-summary-card rm-summary-meta">
                            <div className="rm-meta-row">
                                <span className="rm-meta-label">Created</span>
                                <span className="rm-meta-val">
                                    {new Date(roadmap.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>
                            <div className="rm-meta-row">
                                <span className="rm-meta-label">Last updated</span>
                                <span className="rm-meta-val">
                                    {new Date(roadmap.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {stepModal !== null && (
                <StepModal
                    step={stepModal?.id ? stepModal : null}
                    roadmapId={roadmap.id}
                    topics={topics}
                    nextOrder={steps.length}
                    onClose={() => setStepModal(null)}
                    onSaved={refresh}
                />
            )}

            {editModal && (
                <RoadmapModal
                    roadmap={roadmap}
                    onClose={() => setEditModal(false)}
                    onSaved={refresh}
                />
            )}

            {confirm !== null && (
                <ConfirmDialog
                    title="Delete step"
                    message="Delete this step? This cannot be undone."
                    onConfirm={() => { deleteStep(confirm); setConfirm(null); }}
                    onCancel={() => setConfirm(null)}
                />
            )}
        </div>
    );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function RoadmapCard({ roadmap, onClick, onDelete }) {
    const [confirm, setConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try { await api.delete(`/roadmaps/${roadmap.id}`); onDelete(); }
        catch (e) { console.error(e); }
        finally { setDeleting(false); setConfirm(false); }
    };

    const done = roadmap.steps.filter(s => s.is_completed).length;
    const total = roadmap.steps.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const color = pct === 100 ? '#22c55e' : pct >= 60 ? '#f97316' : '#3b82f6';

    return (
        <div className="rm-card" onClick={onClick}>
            <div className="rm-card-top">
                <span className="rm-card-icon">⟶</span>
                <div className="rm-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="rm-icon-btn del" onClick={() => setConfirm(true)} disabled={deleting} title="Delete">
                        {deleting ? '...' : '✕'}
                    </button>
                </div>
            </div>

            <h3 className="rm-card-title">{roadmap.title}</h3>
            {roadmap.description && <p className="rm-card-desc">{roadmap.description}</p>}

            {total > 0 && (
                <div className="rm-progress-wrap">
                    <div className="rm-progress-track">
                        <div className="rm-progress-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="rm-progress-label" style={{ color }}>
                        {done}/{total} steps · {pct}%
                    </span>
                </div>
            )}

            <div className="rm-card-footer">
                <span className="rm-card-meta">{total} step{total !== 1 ? 's' : ''}</span>
                {total > 0 && <span className="rm-card-meta">{done} completed</span>}
            </div>

            {confirm && (
                <ConfirmDialog
                    title="Delete roadmap"
                    message={`Delete "${roadmap.title}" and all its steps?`}
                    onConfirm={handleDelete}
                    onCancel={() => setConfirm(false)}
                />
            )}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Roadmaps() {
    const [roadmaps, setRoadmaps] = useState([]);
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [selected, setSelected] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [rmRes, tRes] = await Promise.all([api.get('/roadmaps/'), api.get('/topics/')]);
            setRoadmaps(rmRes.data);
            setTopics(tRes.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleUpdated = useCallback((updated) => {
        setRoadmaps(prev => prev.map(r => r.id === updated.id ? updated : r));
        setSelected(updated);
    }, []);

    // Called after AI generation — go straight to the new roadmap detail
    const handleCreated = useCallback((newRoadmap) => {
        setRoadmaps(prev => [newRoadmap, ...prev]);
        setSelected(newRoadmap);
    }, []);

    if (loading) return (
        <>
            <StyleInjector />
            <div className="rm-loading"><div className="rm-ring" /></div>
        </>
    );

    if (selected) return (
        <>
            <StyleInjector />
            <RoadmapDetail
                roadmap={selected}
                topics={topics}
                onBack={() => { setSelected(null); fetchData(); }}
                onUpdated={handleUpdated}
            />
        </>
    );

    return (
        <>
            <StyleInjector />
            <div className="roadmaps-root">
                <div className="rm-page-header">
                    <div>
                        <h1 className="rm-page-title">Roadmaps</h1>
                        <p className="rm-page-sub">{roadmaps.length} roadmap{roadmaps.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button className="rm-primary-btn" onClick={() => setModal(true)}>
                        ✦ Generate roadmap
                    </button>
                </div>

                {roadmaps.length === 0 ? (
                    <div className="rm-empty">
                        <div className="rm-empty-icon">⟶</div>
                        <p className="rm-empty-title">No roadmaps yet</p>
                        <p className="rm-empty-sub">
                            Describe your goal and AI will build a complete learning path for you
                        </p>
                        <button className="rm-primary-btn" onClick={() => setModal(true)}>
                            ✦ Generate your first roadmap
                        </button>
                    </div>
                ) : (
                    <div className="rm-grid">
                        {roadmaps.map(r => (
                            <RoadmapCard
                                key={r.id}
                                roadmap={r}
                                onClick={() => setSelected(r)}
                                onDelete={fetchData}
                            />
                        ))}
                    </div>
                )}

                {modal && (
                    <GenerateModal
                        onClose={() => setModal(false)}
                        onCreated={handleCreated}
                    />
                )}
            </div>
        </>
    );
}
