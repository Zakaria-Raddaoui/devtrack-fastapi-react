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
          background: var(--bg);
        }

        /* ── Sidebar ── */
        .ai-sidebar {
          width: 300px; min-width: 300px; height: 100vh;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column; overflow: hidden;
        }

        .ai-sidebar-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 24px 20px 16px; flex-shrink: 0;
        }

        .ai-sidebar-title {
          font-family: var(--font-heading);
          font-size: 20px; font-weight: 800;
          color: var(--text); margin: 0; letter-spacing: -0.5px;
        }

        .ai-new-btn {
          width: 32px; height: 32px;
          background: #f97316; color: white; border: none;
          border-radius: 10px; font-size: 20px; line-height: 1;
          cursor: pointer; display: flex;
          align-items: center; justify-content: center;
          transition: all 0.2s; box-shadow: 0 4px 12px rgba(249,115,22,0.3);
        }

        .ai-new-btn:hover { background: #ea6c0a; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(249,115,22,0.4); }

        .ai-conv-list {
          flex: 1; overflow-y: auto; padding: 0 12px 24px;
        }

        .ai-conv-list::-webkit-scrollbar { width: 6px; }
        .ai-conv-list::-webkit-scrollbar-track { background: transparent; }
        .ai-conv-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

        .ai-conv-loading, .ai-conv-empty {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 60px 16px; gap: 16px; text-align: center;
          color: var(--muted); font-size: 14px; font-weight: 500;
        }

        .ai-conv-new-btn {
          background: none; border: 2px dashed var(--border);
          border-radius: 12px; padding: 10px 16px;
          font-size: 13px; font-weight: 600; color: var(--muted);
          cursor: pointer; font-family: var(--font-body);
          transition: all 0.2s; width: 100%;
        }

        .ai-conv-new-btn:hover { border-color: #f97316; color: #f97316; background: rgba(249,115,22,0.05); }

        .ai-conv-item {
          display: flex; align-items: center;
          justify-content: space-between; gap: 10px;
          padding: 14px 12px; border-radius: 14px;
          cursor: pointer; border: 1px solid transparent;
          transition: all 0.2s; margin-bottom: 4px;
          position: relative;
        }

        .ai-conv-item:hover { background: var(--card-bg); border-color: var(--border); box-shadow: 0 4px 12px var(--shadow); transform: translateY(-1px); }

        .ai-conv-item.active {
          background: rgba(249,115,22,0.1);
          border-color: rgba(249,115,22,0.2);
          box-shadow: 0 4px 12px rgba(249,115,22,0.05);
        }

        .ai-conv-item-body {
          display: flex; flex-direction: column; gap: 4px;
          flex: 1; min-width: 0;
        }

        .ai-conv-title {
          font-size: 14px; font-weight: 600; color: var(--text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .ai-conv-item.active .ai-conv-title { color: #f97316; font-weight: 700; }

        .ai-conv-time {
          font-size: 11px; font-weight: 500; color: var(--placeholder);
        }

        .ai-conv-actions {
          display: flex; gap: 4px; flex-shrink: 0;
        }

        .ai-conv-btn {
          background: var(--bg); border: 1px solid var(--border);
          border-radius: 8px; padding: 4px 8px;
          font-size: 12px; font-weight: 600; color: var(--muted);
          cursor: pointer; transition: all 0.2s;
        }

        .ai-conv-btn:hover { background: var(--hover-bg); color: var(--text); border-color: var(--text); }
        .ai-conv-btn.danger:hover { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.3); }

        /* ── Main ── */
        .ai-main {
          flex: 1; display: flex; flex-direction: column;
          overflow: hidden; min-width: 0; background: var(--bg);
        }

        .ai-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 24px 48px 20px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0; background: var(--bg);
        }

        .ai-header-left { display: flex; align-items: center; gap: 16px; }

        .ai-logo {
          width: 48px; height: 48px;
          background: rgba(249,115,22,0.15);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; color: #f97316; flex-shrink: 0; border: 1px solid rgba(249,115,22,0.2);
        }

        .ai-title {
          font-family: var(--font-heading);
          font-size: 22px; font-weight: 800;
          color: var(--text); margin: 0 0 4px; letter-spacing: -0.5px;
          white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; max-width: 500px;
        }

        .ai-sub { font-size: 13px; font-weight: 500; color: var(--muted); margin: 0; }

        /* Chat */
        .ai-chat {
          flex: 1; overflow-y: auto; padding: 32px 48px;
          display: flex; flex-direction: column;
        }

        .ai-chat::-webkit-scrollbar { width: 8px; }
        .ai-chat::-webkit-scrollbar-track { background: transparent; }
        .ai-chat::-webkit-scrollbar-thumb { background: var(--border); border-radius: 8px; }

        .ai-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; gap: 20px;
          max-width: 680px; margin: 0 auto; width: 100%;
        }

        .ai-empty-icon {
          font-size: 64px; color: #f97316; opacity: 0.8;
          animation: aiPulse 3s ease-in-out infinite; margin-bottom: 8px;
        }

        @keyframes aiPulse {
          0%,100% { opacity:0.8; transform:scale(1); }
          50%      { opacity:0.5; transform:scale(0.92); }
        }

        .ai-empty-title {
          font-family: var(--font-heading);
          font-size: 32px; font-weight: 800;
          color: var(--text); margin: 0; letter-spacing: -1px;
        }

        .ai-empty-sub { font-size: 16px; font-weight: 500; color: var(--muted); margin: 0 0 16px; line-height: 1.5; }

        .ai-suggestions {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
          width: 100%;
        }

        .ai-suggestion {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 14px; padding: 16px 20px;
          font-size: 14px; font-weight: 500; color: var(--text);
          font-family: var(--font-body); box-shadow: 0 4px 12px var(--shadow);
          cursor: pointer; text-align: left; transition: all 0.2s cubic-bezier(0.16,1,0.3,1); line-height: 1.4;
        }

        .ai-suggestion:hover { border-color: #f97316; color: #f97316; box-shadow: 0 8px 24px rgba(249,115,22,0.15); transform: translateY(-2px); }

        /* Messages */
        .ai-messages {
          display: flex; flex-direction: column; gap: 32px;
          max-width: 800px; width: 100%; margin: 0 auto;
        }

        .ai-msg-wrap {
          display: flex; gap: 16px; align-items: flex-start; width: 100%;
        }

        .ai-msg-wrap.user { flex-direction: row-reverse; }

        .ai-msg-avatar {
          width: 36px; height: 36px; border-radius: 12px;
          background: rgba(249,115,22,0.15);
          border: 1px solid rgba(249,115,22,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; color: #f97316; flex-shrink: 0; font-weight: 700;
        }

        .ai-msg-avatar.user {
          background: var(--card-bg); border: 1px solid var(--border);
          color: var(--text); font-family: var(--font-heading); font-size: 14px;
        }

        .ai-msg-bubble {
          max-width: 75%; border-radius: 20px; padding: 18px 24px; box-shadow: 0 8px 24px var(--shadow);
        }

        .ai-msg-bubble.user {
          background: #f97316; color: white;
          border-radius: 20px 4px 20px 20px;
          box-shadow: 0 8px 24px rgba(249,115,22,0.2);
        }

        .ai-msg-bubble.assistant {
          background: var(--card-bg); border: 1px solid var(--border);
          border-radius: 4px 20px 20px 20px;
        }

        .ai-msg-bubble.typing {
          display: flex; align-items: center; gap: 6px; padding: 18px 24px;
        }

        .ai-msg-text {
          font-size: 15px; font-weight: 500; line-height: 1.6; margin: 0; color: white;
        }

        .dot {
          width: 8px; height: 8px; border-radius: 50%; background: #f97316;
          animation: aiDot 1.4s ease-in-out infinite; display: inline-block; opacity: 0.8;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes aiDot {
          0%,60%,100% { transform:translateY(0); opacity:0.4; }
          30%          { transform:translateY(-6px); opacity:1; }
        }

        /* Markdown */
        .ai-msg-md { font-size: 15px; color: var(--text); line-height: 1.8; }
        .ai-msg-md p { margin: 0 0 16px; font-weight: 400; }
        .ai-msg-md p:last-child { margin: 0; }
        .ai-msg-md h1,.ai-msg-md h2,.ai-msg-md h3 {
          font-family:var(--font-heading); font-weight:800; color:var(--text);
          margin: 24px 0 12px; letter-spacing: -0.5px; line-height: 1.3;
        }
        .ai-msg-md h1 { font-size: 24px; border-bottom: 2px solid var(--border); padding-bottom: 10px; }
        .ai-msg-md h2 { font-size: 20px; color: var(--text); }
        .ai-msg-md h3 { font-size: 16px; color: #f97316; }
        .ai-msg-md ul,.ai-msg-md ol { padding-left: 24px; margin: 12px 0 20px; }
        .ai-msg-md li { margin-bottom: 8px; line-height: 1.6; font-weight: 400; }
        .ai-msg-md li::marker { color: #f97316; font-weight: 700; }
        .ai-msg-md code {
          background: rgba(249,115,22,0.1);
          border: 1px solid rgba(249,115,22,0.2);
          border-radius: 6px; padding: 3px 8px;
          font-size: 13.5px; color: #ea6c0a; font-family: monospace; font-weight: 600;
        }
        .ai-msg-md pre {
          background: rgba(0,0,0,0.4); border: 1px solid var(--border);
          border-radius: 14px; padding: 20px; overflow-x: auto; margin: 16px 0;
          box-shadow: inset 0 4px 12px rgba(0,0,0,0.2);
        }
        .ai-msg-md pre code {
          background: none; border: none; padding: 0;
          color: #e5e5e5; font-size: 13.5px; font-weight: 500;
        }
        .ai-msg-md strong { font-weight: 700; color: var(--text); }
        .ai-msg-md em { font-style: italic; color: var(--muted); }
        .ai-msg-md blockquote {
          border-left: 4px solid #f97316;
          background: rgba(249,115,22,0.06);
          border-radius: 0 12px 12px 0;
          padding: 14px 20px; margin: 20px 0;
          color: var(--text); font-style: italic; font-weight: 500;
        }
        .ai-msg-md blockquote p { margin: 0; line-height: 1.6; }
        .ai-msg-md a { color: #f97316; text-decoration: underline; font-weight: 600; transition: color 0.15s; }
        .ai-msg-md a:hover { color: #ea6c0a; }
        .ai-msg-md hr {
          border: none; border-top: 2px dashed var(--border); margin: 24px 0; opacity: 0.5;
        }
        .ai-msg-md table { width: 100%; border-collapse: collapse; margin: 20px 0; background: var(--bg); border-radius: 12px; overflow: hidden; border: 1px solid var(--border); }
        .ai-msg-md th,.ai-msg-md td {
          border: 1px solid var(--border); padding: 12px 16px; font-size: 14px; text-align: left;
        }
        .ai-msg-md th { background: rgba(249,115,22,0.1); font-weight: 700; color: #f97316; }

        /* Cursor */
        .ai-cursor {
          display:inline-block; width:3px; height:18px;
          background:#f97316; margin-left:4px; vertical-align:middle;
          animation:cursorBlink 0.8s ease-in-out infinite; border-radius:2px;
        }

        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }

        /* Error */
        .ai-error {
          background:rgba(239,68,68,0.1); color:#ef4444;
          border:1px solid rgba(239,68,68,0.3);
          border-radius:14px; padding:16px 20px;
          font-size:14px; font-weight:600; display:flex; align-items:center; gap:12px;
          max-width:800px; width:100%; margin:0 auto; box-shadow: 0 8px 24px rgba(239,68,68,0.15);
        }

        /* Input */
        .ai-input-wrap {
          padding: 16px 48px 32px;
          background: var(--bg);
          border-top: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 10px;
          flex-shrink: 0; box-shadow: 0 -12px 40px rgba(0,0,0,0.1); z-index: 10;
        }

        .ai-input-row {
          display: flex; align-items: flex-end; gap: 12px;
          background: var(--card-bg); border: 2px solid var(--border);
          border-radius: 20px; padding: 12px 12px 12px 20px;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 16px var(--shadow); max-width: 800px; width: 100%; margin: 0 auto;
        }

        .ai-input-row:focus-within {
          border-color: #f97316;
          box-shadow: 0 8px 32px rgba(249,115,22,0.15);
        }

        .ai-input {
          flex: 1; background: none; border: none; outline: none;
          font-size: 15px; color: var(--text); font-weight: 500;
          font-family: var(--font-body);
          resize: none; line-height: 1.6; max-height: 160px; overflow-y: auto; padding: 4px 0;
        }

        .ai-input::placeholder { color: var(--placeholder); font-weight: 400; }
        .ai-input:disabled { opacity: 0.6; }

        .ai-send-btn {
          width: 44px; height: 44px; border-radius: 14px;
          background: #f97316; color: white; border: none;
          font-size: 22px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(249,115,22,0.3);
        }

        .ai-send-btn:hover:not(:disabled) { background: #ea6c0a; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(249,115,22,0.4); }
        .ai-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; background: var(--muted); }

        .ai-hint { font-size: 12px; font-weight: 600; color: var(--placeholder); text-align: center; margin: 0; }

        /* Spinners */
        .ai-spinner {
          width:20px; height:20px;
          border:3px solid rgba(255,255,255,0.3); border-top-color:white;
          border-radius:50%; animation:aiSpin 0.7s linear infinite; display:inline-block;
        }

        .ai-spinner-sm {
          width:24px; height:24px;
          border:3px solid var(--border); border-top-color:#f97316;
          border-radius:50%; animation:aiSpin 0.8s linear infinite; display:inline-block;
        }

        .ai-spinner-lg {
          width:40px; height:40px;
          border:4px solid var(--border); border-top-color:#f97316;
          border-radius:50%; animation:aiSpin 0.8s linear infinite; display:inline-block;
        }

        @keyframes aiSpin { to { transform:rotate(360deg); } }

        /* Modal */
        .ai-overlay {
          position:fixed; inset:0;
          background:rgba(0,0,0,0.6); backdrop-filter:blur(8px);
          display:flex; align-items:center; justify-content:center; z-index:1000;
        }

        .ai-modal {
          background:var(--card-bg); border:1px solid var(--border);
          border-radius: 28px; padding: 40px; width:100%; max-width:420px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px var(--border);
          animation:aiSlide 0.3s cubic-bezier(0.16,1,0.3,1);
        }

        @keyframes aiSlide {
          from{opacity:0;transform:translateY(24px) scale(0.96)}
          to{opacity:1;transform:translateY(0) scale(1)}
        }

        .ai-modal-header {
          display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;
        }

        .ai-modal-header h2 {
          font-family:var(--font-heading); font-size:24px; font-weight:800; color:var(--text); margin:0; letter-spacing:-0.5px;
        }

        .ai-modal-close {
          background:none; border:none; color:var(--muted);
          font-size:18px; cursor:pointer; padding:6px 10px; border-radius:10px; transition:all 0.2s;
        }

        .ai-modal-close:hover { background:var(--hover-bg); color:var(--text); }

        .ai-modal-input {
          width:100%; background:var(--bg); border:2px solid var(--border);
          border-radius:14px; padding:14px 18px; font-size:16px; font-weight:500; color:var(--text);
          font-family:var(--font-body); outline:none; box-sizing:border-box;
          transition:border-color 0.2s, box-shadow 0.2s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }

        .ai-modal-input:focus { border-color:#f97316; box-shadow: 0 0 0 4px rgba(249,115,22,0.15); }

        .ai-modal-submit {
          background:#f97316; color:white; border:none;
          border-radius:14px; padding:16px; font-size:16px; font-weight:700;
          font-family:var(--font-heading); cursor:pointer; transition:all 0.2s;
          width:100%; box-shadow:0 8px 24px rgba(249,115,22,0.3); margin-top: 8px;
        }

        .ai-modal-submit:hover { background:#ea6c0a; box-shadow:0 12px 32px rgba(249,115,22,0.4); transform: translateY(-2px); }
        .ai-modal-submit:disabled { opacity:0.7; cursor:not-allowed; transform:none; }
      `}</style>
    </div>
  );
}

