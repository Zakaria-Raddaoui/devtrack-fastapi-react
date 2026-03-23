import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../api/axios';
import ConfirmDialog from '../components/ConfirmDialog';

const SUGGESTIONS = [
  "What should I learn next based on my progress?",
  "Summarize what I've learned recently",
  "Quiz me on my most recent topic",
  "Give me a study plan for my in-progress topics",
  "What topics should I focus on to become a DevOps engineer?",
  "How many hours have I spent learning this month?",
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Message({ msg, isStreaming }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`ai-msg-wrap ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && <div className="ai-msg-avatar"><span>⬡</span></div>}
      <div className={`ai-msg-bubble ${isUser ? 'user' : 'assistant'}`}>
        {isUser ? (
          <p className="ai-msg-text">{msg.content}</p>
        ) : (
          <div className="ai-msg-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            {isStreaming && <span className="ai-cursor" />}
          </div>
        )}
      </div>
      {isUser && <div className="ai-msg-avatar user">U</div>}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="ai-msg-wrap assistant">
      <div className="ai-msg-avatar"><span>⬡</span></div>
      <div className="ai-msg-bubble assistant typing">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}

function RenameModal({ conv, onClose, onSaved }) {
  const [title, setTitle] = useState(conv.title);
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.put(`/assistant/conversations/${conv.id}`, { title });
      onSaved(res.data);
      onClose();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return createPortal(
    <div className="ai-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={e => e.stopPropagation()}>
        <div className="ai-modal-header">
          <h2>Rename chat</h2>
          <button className="ai-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            className="ai-modal-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required autoFocus
          />
          <button type="submit" className="ai-modal-submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function Assistant() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convsLoading, setConvsLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [error, setError] = useState('');
  const [renameModal, setRenameModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [hoveredConv, setHoveredConv] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversations on mount
  useEffect(() => {
    api.get('/assistant/conversations')
      .then(res => setConversations(res.data))
      .catch(() => { })
      .finally(() => setConvsLoading(false));
  }, []);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConv) { setMessages([]); return; }
    setMsgsLoading(true);
    api.get(`/assistant/conversations/${activeConv.id}/messages`)
      .then(res => setMessages(res.data.map(m => ({ role: m.role, content: m.content }))))
      .catch(() => { })
      .finally(() => setMsgsLoading(false));
  }, [activeConv?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const createConversation = async () => {
    try {
      const res = await api.post('/assistant/conversations', { title: 'New chat' });
      setConversations(prev => [res.data, ...prev]);
      setActiveConv(res.data);
      setMessages([]);
      inputRef.current?.focus();
    } catch (e) { console.error(e); }
  };

  const deleteConversation = async (conv) => {
    try {
      await api.delete(`/assistant/conversations/${conv.id}`);
      setConversations(prev => prev.filter(c => c.id !== conv.id));
      if (activeConv?.id === conv.id) { setActiveConv(null); setMessages([]); }
    } catch (e) { console.error(e); }
    finally { setConfirmDelete(null); }
  };

  const send = async (text) => {
    const content = text || input.trim();
    if (!content || loading) return;
    if (!activeConv) { await createConversation(); return; }

    const userMsg = { role: 'user', content };
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);
    setError('');
    // Keep focus on input immediately
    setTimeout(() => inputRef.current?.focus(), 0);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/assistant/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ conversation_id: activeConv.id, message: content }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Something went wrong');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.token) {
              await new Promise(r => setTimeout(r, 8));
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + parsed.token,
                };
                return updated;
              });
            }
            // Update conversation title after auto-title
            if (parsed.conv_title) {
              setConversations(prev => prev.map(c =>
                c.id === activeConv.id ? { ...c, title: parsed.conv_title, updated_at: new Date().toISOString() } : c
              ));
              setActiveConv(prev => prev ? { ...prev, title: parsed.conv_title } : prev);
            }
          } catch { }
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading) send();
    }
  };

  const isEmpty = messages.length === 0 && !msgsLoading;

  return (
    <div className="ai-root">
      {/* Left sidebar — conversations */}
      <div className="ai-sidebar">
        <div className="ai-sidebar-header">
          <h2 className="ai-sidebar-title">Chats</h2>
          <button className="ai-new-btn" onClick={createConversation} title="New chat">+</button>
        </div>

        <div className="ai-conv-list">
          {convsLoading ? (
            <div className="ai-conv-loading"><div className="ai-spinner-sm" /></div>
          ) : conversations.length === 0 ? (
            <div className="ai-conv-empty">
              <p>No chats yet</p>
              <button className="ai-conv-new-btn" onClick={createConversation}>+ Start a chat</button>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`ai-conv-item ${activeConv?.id === conv.id ? 'active' : ''}`}
                onClick={() => setActiveConv(conv)}
                onMouseEnter={() => setHoveredConv(conv.id)}
                onMouseLeave={() => setHoveredConv(null)}
              >
                <div className="ai-conv-item-body">
                  <span className="ai-conv-title">{conv.title}</span>
                  <span className="ai-conv-time">{timeAgo(conv.updated_at)}</span>
                </div>
                {hoveredConv === conv.id && (
                  <div className="ai-conv-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className="ai-conv-btn"
                      onClick={() => setRenameModal(conv)}
                      title="Rename"
                    >✎</button>
                    <button
                      className="ai-conv-btn danger"
                      onClick={() => setConfirmDelete(conv)}
                      title="Delete"
                    >✕</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right — chat area */}
      <div className="ai-main">
        {/* Header */}
        <div className="ai-header">
          <div className="ai-header-left">
            <div className="ai-logo">⬡</div>
            <div>
              <h1 className="ai-title">{activeConv ? activeConv.title : 'DevTrack AI'}</h1>
              <p className="ai-sub">Powered by Llama 3.3 · 70B</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="ai-chat">
          {!activeConv ? (
            <div className="ai-empty">
              <div className="ai-empty-icon">⬡</div>
              <h2 className="ai-empty-title">Start a conversation</h2>
              <p className="ai-empty-sub">
                I know your topics, logs, and notes. Ask me anything.
              </p>
              <div className="ai-suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="ai-suggestion" onClick={async () => {
                    const res = await api.post('/assistant/conversations', { title: 'New chat' });
                    setConversations(prev => [res.data, ...prev]);
                    setActiveConv(res.data);
                    setMessages([]);
                    setTimeout(() => send(s), 100);
                  }}>{s}</button>
                ))}
              </div>
            </div>
          ) : msgsLoading ? (
            <div className="ai-empty"><div className="ai-spinner-lg" /></div>
          ) : isEmpty ? (
            <div className="ai-empty">
              <div className="ai-empty-icon" style={{ fontSize: 32, opacity: 0.4 }}>⬡</div>
              <p className="ai-empty-sub">Send a message to start this conversation</p>
              <div className="ai-suggestions">
                {SUGGESTIONS.slice(0, 4).map((s, i) => (
                  <button key={i} className="ai-suggestion" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ai-messages">
              {messages.map((msg, i) => {
                const isLastMsg = i === messages.length - 1;
                const isStreaming = loading && isLastMsg && msg.role === 'assistant';
                if (isStreaming && msg.content === '') return <TypingIndicator key={i} />;
                return <Message key={i} msg={msg} isStreaming={isStreaming} />;
              })}
              {error && <div className="ai-error"><span>⚠</span> {error}</div>}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {activeConv && (
          <div className="ai-input-wrap">
            <div className="ai-input-row">
              <textarea
                ref={inputRef}
                className="ai-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything about your learning journey..."
                rows={1}
              />
              <button
                className="ai-send-btn"
                onClick={() => send()}
                disabled={loading || !input.trim()}
              >
                {loading ? <span className="ai-spinner" /> : '↑'}
              </button>
            </div>
            <p className="ai-hint">Enter to send · Shift+Enter for new line</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {renameModal && (
        <RenameModal
          conv={renameModal}
          onClose={() => setRenameModal(null)}
          onSaved={(updated) => {
            setConversations(prev => prev.map(c => c.id === updated.id ? updated : c));
            if (activeConv?.id === updated.id) setActiveConv(updated);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete chat"
          message={`Delete "${confirmDelete.title}"? All messages will be lost.`}
          onConfirm={() => deleteConversation(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <style>{`
        .ai-root {
          display: flex; height: 100vh; width: 100%; overflow: hidden;
        }

        /* ── Sidebar ── */
        .ai-sidebar {
          width: 260px; min-width: 260px; height: 100vh;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column; overflow: hidden;
        }

        .ai-sidebar-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 20px 16px 12px; flex-shrink: 0;
        }

        .ai-sidebar-title {
          font-family: 'Syne', sans-serif;
          font-size: 18px; font-weight: 700;
          color: var(--text); margin: 0;
        }

        .ai-new-btn {
          width: 28px; height: 28px;
          background: #f97316; color: white; border: none;
          border-radius: 8px; font-size: 20px; line-height: 1;
          cursor: pointer; display: flex;
          align-items: center; justify-content: center;
          transition: all 0.2s; box-shadow: 0 2px 8px rgba(249,115,22,0.3);
        }

        .ai-new-btn:hover { background: #ea6c0a; transform: translateY(-1px); }

        .ai-conv-list {
          flex: 1; overflow-y: auto; padding: 0 8px 16px;
        }

        .ai-conv-loading, .ai-conv-empty {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 40px 16px; gap: 12px; text-align: center;
          color: var(--muted); font-size: 13px;
        }

        .ai-conv-new-btn {
          background: none; border: 1px dashed var(--border);
          border-radius: 8px; padding: 8px 14px;
          font-size: 12px; color: var(--muted);
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
        }

        .ai-conv-new-btn:hover { border-color: #f97316; color: #f97316; }

        .ai-conv-item {
          display: flex; align-items: center;
          justify-content: space-between; gap: 8px;
          padding: 10px 10px; border-radius: 10px;
          cursor: pointer; border: 1px solid transparent;
          transition: all 0.15s; margin-bottom: 2px;
          position: relative;
        }

        .ai-conv-item:hover { background: var(--hover-bg); }

        .ai-conv-item.active {
          background: rgba(249,115,22,0.1);
          border-color: rgba(249,115,22,0.3);
        }

        .ai-conv-item-body {
          display: flex; flex-direction: column; gap: 3px;
          flex: 1; min-width: 0;
        }

        .ai-conv-title {
          font-size: 13px; font-weight: 500; color: var(--text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .ai-conv-item.active .ai-conv-title { color: #f97316; font-weight: 600; }

        .ai-conv-time {
          font-size: 10px; color: var(--placeholder);
        }

        .ai-conv-actions {
          display: flex; gap: 2px; flex-shrink: 0;
        }

        .ai-conv-btn {
          background: none; border: none;
          border-radius: 5px; padding: 3px 6px;
          font-size: 12px; color: var(--muted);
          cursor: pointer; transition: all 0.15s;
        }

        .ai-conv-btn:hover { background: var(--hover-bg); color: var(--text); }
        .ai-conv-btn.danger:hover { background: var(--danger-bg); color: var(--danger-text); }

        /* ── Main ── */
        .ai-main {
          flex: 1; display: flex; flex-direction: column;
          overflow: hidden; min-width: 0;
        }

        .ai-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 20px 32px 16px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        .ai-header-left { display: flex; align-items: center; gap: 14px; }

        .ai-logo {
          width: 38px; height: 38px;
          background: linear-gradient(135deg, #f97316, #fb923c);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; color: white; flex-shrink: 0;
        }

        .ai-title {
          font-family: 'Syne', sans-serif;
          font-size: 17px; font-weight: 700;
          color: var(--text); margin: 0 0 2px;
          white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; max-width: 400px;
        }

        .ai-sub { font-size: 12px; color: var(--muted); margin: 0; }

        /* Chat */
        .ai-chat {
          flex: 1; overflow-y: auto; padding: 24px 32px;
          display: flex; flex-direction: column;
        }

        .ai-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; gap: 14px;
          max-width: 600px; margin: 0 auto; width: 100%;
        }

        .ai-empty-icon {
          font-size: 44px; color: #f97316;
          animation: aiPulse 2s ease-in-out infinite;
        }

        @keyframes aiPulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.7; transform:scale(0.95); }
        }

        .ai-empty-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px; font-weight: 700;
          color: var(--text); margin: 0;
        }

        .ai-empty-sub { font-size: 14px; color: var(--muted); margin: 0; }

        .ai-suggestions {
          display: flex; flex-direction: column; gap: 6px;
          width: 100%; max-width: 480px;
        }

        .ai-suggestion {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: 11px 16px;
          font-size: 13px; color: var(--text);
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; text-align: left; transition: all 0.15s;
        }

        .ai-suggestion:hover { border-color: #f97316; color: #f97316; background: var(--hover-bg); }

        /* Messages */
        .ai-messages {
          display: flex; flex-direction: column; gap: 20px;
          max-width: 720px; width: 100%; margin: 0 auto;
        }

        .ai-msg-wrap {
          display: flex; gap: 12px; align-items: flex-start;
        }

        .ai-msg-wrap.user { flex-direction: row-reverse; }

        .ai-msg-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg, #f97316, #fb923c);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; color: white; flex-shrink: 0; font-weight: 700;
        }

        .ai-msg-avatar.user {
          background: var(--card-bg); border: 1px solid var(--border);
          color: var(--text); font-family: 'Syne', sans-serif; font-size: 12px;
        }

        .ai-msg-bubble {
          max-width: 72%; border-radius: 16px; padding: 13px 16px;
        }

        .ai-msg-bubble.user {
          background: #f97316; color: white;
          border-radius: 16px 4px 16px 16px;
        }

        .ai-msg-bubble.assistant {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 4px 16px 16px 16px;
        }

        .ai-msg-bubble.typing {
          display: flex; align-items: center; gap: 5px; padding: 13px 18px;
        }

        .ai-msg-text {
          font-size: 14px; line-height: 1.6; margin: 0; color: white;
        }

        .dot {
          width: 7px; height: 7px; border-radius: 50%; background: var(--muted);
          animation: aiDot 1.2s ease-in-out infinite; display: inline-block;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes aiDot {
          0%,60%,100% { transform:translateY(0); opacity:0.4; }
          30%          { transform:translateY(-6px); opacity:1; }
        }

        /* Markdown */
        .ai-msg-md { font-size: 14px; color: var(--text); line-height: 1.75; }
        .ai-msg-md p { margin: 0 0 10px; }
        .ai-msg-md p:last-child { margin: 0; }
        .ai-msg-md h1,.ai-msg-md h2,.ai-msg-md h3 {
          font-family:'Syne',sans-serif; font-weight:700; color:var(--text);
          margin: 16px 0 8px; letter-spacing: -0.3px;
        }
        .ai-msg-md h1 { font-size: 18px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
        .ai-msg-md h2 { font-size: 16px; color: #f97316; }
        .ai-msg-md h3 { font-size: 14px; }
        .ai-msg-md ul,.ai-msg-md ol { padding-left: 20px; margin: 8px 0; }
        .ai-msg-md li { margin-bottom: 6px; line-height: 1.6; }
        .ai-msg-md li::marker { color: #f97316; }
        .ai-msg-md code {
          background: rgba(249,115,22,0.1);
          border: 1px solid rgba(249,115,22,0.25);
          border-radius: 4px; padding: 2px 6px;
          font-size: 12px; color: #f97316; font-family: monospace;
        }
        .ai-msg-md pre {
          background: var(--input-bg); border: 1px solid var(--border);
          border-radius: 10px; padding: 14px; overflow-x: auto; margin: 12px 0;
        }
        .ai-msg-md pre code {
          background: none; border: none; padding: 0;
          color: var(--text); font-size: 13px;
        }
        .ai-msg-md strong { font-weight: 700; color: var(--text); }
        .ai-msg-md em { font-style: italic; color: var(--muted); }
        .ai-msg-md blockquote {
          border-left: 3px solid #f97316;
          background: rgba(249,115,22,0.06);
          border-radius: 0 8px 8px 0;
          padding: 10px 14px; margin: 12px 0;
          color: var(--text); font-style: italic;
        }
        .ai-msg-md blockquote p { margin: 0; }
        .ai-msg-md a { color: #f97316; text-decoration: underline; }
        .ai-msg-md hr {
          border: none; border-top: 1px solid var(--border); margin: 14px 0;
        }
        .ai-msg-md table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .ai-msg-md th,.ai-msg-md td {
          border: 1px solid var(--border); padding: 8px 12px; font-size: 13px;
        }
        .ai-msg-md th { background: var(--input-bg); font-weight: 600; color: #f97316; }

        /* Cursor */
        .ai-cursor {
          display:inline-block; width:2px; height:16px;
          background:#f97316; margin-left:2px; vertical-align:middle;
          animation:cursorBlink 0.7s ease-in-out infinite; border-radius:1px;
        }

        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }

        /* Error */
        .ai-error {
          background:var(--danger-bg); color:var(--danger-text);
          border:1px solid rgba(239,68,68,0.2);
          border-radius:10px; padding:12px 16px;
          font-size:13px; display:flex; align-items:center; gap:8px;
          max-width:720px; width:100%; margin:0 auto;
        }

        /* Input */
        .ai-input-wrap {
          padding: 12px 32px 20px;
          border-top: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 8px;
          flex-shrink: 0;
        }

        .ai-input-row {
          display: flex; align-items: flex-end; gap: 10px;
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 14px; padding: 10px 10px 10px 16px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .ai-input-row:focus-within {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .ai-input {
          flex: 1; background: none; border: none; outline: none;
          font-size: 14px; color: var(--text);
          font-family: 'DM Sans', sans-serif;
          resize: none; line-height: 1.5; max-height: 120px; overflow-y: auto;
        }

        .ai-input::placeholder { color: var(--placeholder); }
        .ai-input:disabled { opacity: 0.6; }

        .ai-send-btn {
          width: 34px; height: 34px; border-radius: 9px;
          background: #f97316; color: white; border: none;
          font-size: 18px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(249,115,22,0.3);
        }

        .ai-send-btn:hover:not(:disabled) { background: #ea6c0a; transform: translateY(-1px); }
        .ai-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .ai-hint { font-size: 11px; color: var(--placeholder); text-align: center; margin: 0; }

        /* Spinners */
        .ai-spinner {
          width:16px; height:16px;
          border:2px solid rgba(255,255,255,0.3); border-top-color:white;
          border-radius:50%; animation:aiSpin 0.7s linear infinite; display:inline-block;
        }

        .ai-spinner-sm {
          width:20px; height:20px;
          border:2px solid var(--border); border-top-color:#f97316;
          border-radius:50%; animation:aiSpin 0.8s linear infinite; display:inline-block;
        }

        .ai-spinner-lg {
          width:32px; height:32px;
          border:3px solid var(--border); border-top-color:#f97316;
          border-radius:50%; animation:aiSpin 0.8s linear infinite; display:inline-block;
        }

        @keyframes aiSpin { to { transform:rotate(360deg); } }

        /* Modal */
        .ai-overlay {
          position:fixed; inset:0;
          background:rgba(0,0,0,0.5); backdrop-filter:blur(4px);
          display:flex; align-items:center; justify-content:center; z-index:1000;
        }

        .ai-modal {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius:20px; padding:32px; width:100%; max-width:380px;
          box-shadow:0 24px 64px rgba(0,0,0,0.3);
          animation:aiSlide 0.3s cubic-bezier(0.16,1,0.3,1);
        }

        @keyframes aiSlide {
          from{opacity:0;transform:translateY(20px)}
          to{opacity:1;transform:translateY(0)}
        }

        .ai-modal-header {
          display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;
        }

        .ai-modal-header h2 {
          font-family:'Syne',sans-serif; font-size:18px; font-weight:700; color:var(--text);
        }

        .ai-modal-close {
          background:none; border:none; color:var(--muted);
          font-size:16px; cursor:pointer; padding:4px 8px; border-radius:6px; transition:all 0.2s;
        }

        .ai-modal-close:hover { background:var(--hover-bg); color:var(--text); }

        .ai-modal-input {
          width:100%; background:var(--input-bg); border:1px solid var(--border);
          border-radius:10px; padding:11px 14px; font-size:14px; color:var(--text);
          font-family:'DM Sans',sans-serif; outline:none; box-sizing:border-box;
          transition:border-color 0.2s;
        }

        .ai-modal-input:focus { border-color:#f97316; }

        .ai-modal-submit {
          background:#f97316; color:white; border:none;
          border-radius:10px; padding:11px; font-size:14px; font-weight:600;
          font-family:'DM Sans',sans-serif; cursor:pointer; transition:all 0.2s;
          width:100%; box-shadow:0 4px 14px rgba(249,115,22,0.3);
        }

        .ai-modal-submit:hover { background:#ea6c0a; }
        .ai-modal-submit:disabled { opacity:0.7; cursor:not-allowed; }
      `}</style>
    </div>
  );
}
