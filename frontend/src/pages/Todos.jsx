import React, { useState, useEffect } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

const STORAGE_KEY = 'devtrack-todos-v2';
const OLD_STORAGE_KEY = 'devtrack-todos-v1';

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function loadLists() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);

        // Migration from v1
        const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
        const oldTodos = oldRaw ? JSON.parse(oldRaw) : [];

        return [
            {
                id: 'inbox',
                name: 'Inbox',
                icon: '📥',
                color: '#f97316',
                todos: Array.isArray(oldTodos) ? oldTodos : []
            }
        ];
    } catch (_) {
        return [{ id: 'inbox', name: 'Inbox', icon: '📥', color: '#f97316', todos: [] }];
    }
}

export default function Todos() {
    const [lists, setLists] = useState(loadLists);
    const [activeListId, setActiveListId] = useState('inbox');
    const [text, setText] = useState('');
    const [showNewList, setShowNewList] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [newListIcon, setNewListIcon] = useState('📋');

    const [todoToDelete, setTodoToDelete] = useState(null);
    const [listToDelete, setListToDelete] = useState(null);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    }, [lists]);

    const activeList = lists.find(l => l.id === activeListId) || lists[0];

    const addTodo = () => {
        const value = text.trim();
        if (!value) return;

        setLists(prev => prev.map(list => {
            if (list.id === activeListId) {
                return {
                    ...list,
                    todos: [{ id: uid(), title: value, done: false, createdAt: new Date().toISOString() }, ...list.todos]
                };
            }
            return list;
        }));
        setText('');
    };

    const toggleTodo = (id) => {
        setLists(prev => prev.map(list => {
            if (list.id === activeListId) {
                return { ...list, todos: list.todos.map(t => t.id === id ? { ...t, done: !t.done } : t) };
            }
            return list;
        }));
    };

    const removeTodo = (id) => {
        setLists(prev => prev.map(list => {
            if (list.id === activeListId) {
                return { ...list, todos: list.todos.filter(t => t.id !== id) };
            }
            return list;
        }));
        setTodoToDelete(null);
    };

    const clearCompleted = () => {
        setLists(prev => prev.map(list => {
            if (list.id === activeListId) {
                return { ...list, todos: list.todos.filter(t => !t.done) };
            }
            return list;
        }));
    };

    const createList = () => {
        const name = newListName.trim();
        if (!name) return;
        const newList = {
            id: uid(),
            name,
            icon: newListIcon,
            color: ['#3b82f6', '#10b981', '#8b5cf6', '#eab308', '#f43f5e'][lists.length % 5],
            todos: []
        };
        setLists([...lists, newList]);
        setActiveListId(newList.id);
        setNewListName('');
        setShowNewList(false);
    };

    const deleteList = (id) => {
        setLists(prev => prev.filter(l => l.id !== id));
        if (activeListId === id) setActiveListId('');
        setListToDelete(null);
    };

    const activeCount = activeList ? activeList.todos.filter(t => !t.done).length : 0;
    const doneCount = activeList ? activeList.todos.length - activeCount : 0;
    const progress = activeList && activeList.todos.length > 0 ? Math.round((doneCount / activeList.todos.length) * 100) : 0;

    return (
        <div className="tdo-wrapper">
            <div className="tdo-sidebar">
                <div className="tdo-sidebar-h">
                    <h2>My Lists</h2>
                    <button onClick={() => setShowNewList(true)} title="New List">+</button>
                </div>

                {showNewList && (
                    <div className="tdo-new-list-form">
                        <input
                            autoFocus
                            placeholder="List name..."
                            value={newListName}
                            onChange={e => setNewListName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') createList(); if (e.key === 'Escape') setShowNewList(false); }}
                        />
                        <div className="tdo-icon-picker">
                            {['📋', '🎮', '🏫', '💼', '🛒', '💡'].map(i => (
                                <button
                                    key={i}
                                    className={newListIcon === i ? 'active' : ''}
                                    onClick={() => setNewListIcon(i)}
                                >{i}</button>
                            ))}
                        </div>
                        <div className="tdo-nl-actions">
                            <button onClick={createList} className="tdo-btn-primary">Create</button>
                            <button onClick={() => setShowNewList(false)} className="tdo-btn-ghost">Cancel</button>
                        </div>
                    </div>
                )}

                <div className="tdo-lists">
                    {lists.map(list => (
                        <div
                            key={list.id}
                            className={`tdo-list-item ${activeListId === list.id ? 'active' : ''}`}
                            onClick={() => setActiveListId(list.id)}
                        >
                            <span className="tdo-list-icon" style={{ background: list.color + '20', color: list.color }}>{list.icon}</span>
                            <span className="tdo-list-name">{list.name}</span>
                            <span className="tdo-list-count">{list.todos.filter(t => !t.done).length || ''}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="tdo-main">
                {!activeList ? (
                   <div className="tdo-empty-state-global">
                      <h2>No Lists Found</h2>
                      <p>Create a new list to start tracking your tasks.</p>
                      <button onClick={() => setShowNewList(true)}>Create List</button>
                   </div>
                ) : (
                    <>
                        <div className="tdo-header">
                            <div>
                                <div className="tdo-title-row">
                                    <span className="tdo-title-icon" style={{ color: activeList.color, background: activeList.color + '20' }}>{activeList.icon}</span>
                                    <h1 className="tdo-title">{activeList.name}</h1>
                                </div>
                                <div className="tdo-progress-bar">
                                    <div className="tdo-progress-fill" style={{ width: progress + '%', background: activeList.color }}></div>
                                </div>
                                <p className="tdo-sub">{progress}% completed ({activeCount} remaining)</p>
                            </div>
                            <button className="tdo-delete-list" onClick={() => setListToDelete(activeList)}>Delete List</button>
                        </div>

                        <div className="tdo-card">
                            <div className="tdo-input-row">
                                <input
                                    className="tdo-input"
                                    placeholder={`Add task to ${activeList.name}...`}
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTodo(); } }}
                                />
                                <button className="tdo-add" style={{ background: activeList.color }} onClick={addTodo}>Add</button>
                            </div>

                            <div className="tdo-toolbar">
                                <button className="tdo-clear" onClick={clearCompleted} disabled={doneCount === 0}>Clear completed</button>
                            </div>

                            <div className="tdo-list">
                                {activeList.todos.length === 0 ? (
                                    <div className="tdo-empty">No tasks in this list.</div>
                                ) : (
                                    activeList.todos.map(task => (
                                        <div key={task.id} className={`tdo-item ${task.done ? 'done' : ''}`}>
                                            <button className="tdo-check" style={task.done ? { background: activeList.color, borderColor: activeList.color } : {}} onClick={() => toggleTodo(task.id)} aria-label="Toggle task">
                                                {task.done ? '✓' : ''}
                                            </button>
                                            <div className="tdo-body">
                                                <p className="tdo-text">{task.title}</p>
                                            </div>
                                            <button className="tdo-del" onClick={() => setTodoToDelete(task)} aria-label="Delete task">✕</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {listToDelete && (
                <ConfirmDialog
                    title="Delete List?"
                    message={`Are you sure you want to delete '${listToDelete.name}'? This will permanently erase all ${listToDelete.todos.length} tasks inside it.`}
                    onConfirm={() => deleteList(listToDelete.id)}
                    onCancel={() => setListToDelete(null)}
                    danger={true}
                />
            )}

            {todoToDelete && (
                <ConfirmDialog
                    title="Delete Task?"
                    message={`Are you sure you want to permanently delete '${todoToDelete.title}'?`}
                    onConfirm={() => removeTodo(todoToDelete.id)}
                    onCancel={() => setTodoToDelete(null)}
                    danger={true}
                />
            )}

            <style>{`
        .tdo-wrapper {
          display: flex;
          min-height: 100vh;
          width: 100%;
          background: var(--bg);
          align-items: flex-start;
        }

        .tdo-sidebar {
          width: 320px;
          border-right: 1px solid var(--border);
          background: var(--sidebar-bg);
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          flex-shrink: 0;
        }

        .tdo-sidebar::-webkit-scrollbar { width: 6px; }
        .tdo-sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

        .tdo-sidebar-h {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .tdo-sidebar-h h2 {
          font-family: var(--font-heading);
          font-size: 18px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0;
        }

        .tdo-sidebar-h button {
          background: var(--input-bg);
          border: 1px solid var(--border);
          color: var(--text);
          width: 28px;
          height: 28px;
          border-radius: 8px;
          font-size: 18px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        
        .tdo-sidebar-h button:hover { background: var(--hover-bg); color: #f97316; }

        .tdo-new-list-form {
          background: var(--card-bg);
          border: 1px solid var(--border);
          padding: 16px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 8px 24px var(--shadow);
        }

        .tdo-new-list-form input {
          width: 100%;
          background: var(--input-bg);
          border: 1px solid var(--border);
          padding: 8px 12px;
          border-radius: 8px;
          color: var(--text);
          font-family: var(--font-body);
        }

        .tdo-icon-picker { display: flex; gap: 8px; justify-content: space-between; }
        .tdo-icon-picker button {
          background: none; border: 1px solid transparent; font-size: 18px; cursor: pointer; padding: 4px; border-radius: 8px;
        }
        .tdo-icon-picker button.active { background: var(--input-bg); border-color: var(--border); }

        .tdo-nl-actions { display: flex; gap: 8px; }
        .tdo-btn-primary { flex: 1; background: var(--text); color: var(--bg); border: none; padding: 8px; border-radius: 8px; cursor: pointer; font-weight: 600; }
        .tdo-btn-ghost { flex: 1; background: transparent; color: var(--muted); border: 1px solid var(--border); padding: 8px; border-radius: 8px; cursor: pointer; }

        .tdo-lists {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .tdo-list-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--muted);
          font-weight: 500;
        }

        .tdo-list-item:hover { background: var(--input-bg); color: var(--text); }
        .tdo-list-item.active { background: var(--card-bg); color: var(--text); box-shadow: 0 4px 12px var(--shadow); }

        .tdo-list-icon {
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 14px;
        }

        .tdo-list-name { flex: 1; }
        .tdo-list-count { font-size: 12px; background: var(--input-bg); padding: 2px 8px; border-radius: 12px; }

        .tdo-main {
          flex: 1;
          padding: 64px 48px;
          max-width: 960px;
          margin: 0 auto;
          width: 100%;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tdo-empty-state-global {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; min-height: 400px; text-align: center; gap: 16px;
        }
        .tdo-empty-state-global h2 { font-family: var(--font-heading); font-size: 32px; color: var(--text); margin: 0; }
        .tdo-empty-state-global p { color: var(--muted); font-size: 16px; }
        .tdo-empty-state-global button { 
          background: #f97316; color: white; border: none; padding: 14px 28px; border-radius: 14px; 
          font-family: var(--font-heading); font-weight: 700; font-size: 16px; cursor: pointer;
          transition: all 0.2s; box-shadow: 0 8px 24px rgba(249,115,22,0.3);
        }
        .tdo-empty-state-global button:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(249,115,22,0.4); }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .tdo-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 32px;
        }

        .tdo-title-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }

        .tdo-title-icon { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; font-size: 24px; border-radius: 16px; }

        .tdo-title {
          font-family: var(--font-heading);
          font-size: 42px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -1.2px;
          color: var(--text);
        }

        .tdo-progress-bar { width: 100%; height: 6px; background: var(--input-bg); border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
        .tdo-progress-fill { height: 100%; transition: width 0.4s cubic-bezier(0.16,1,0.3,1); }

        .tdo-sub {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
          font-weight: 500;
        }

        .tdo-delete-list {
          background: var(--danger-bg); color: var(--danger-text); border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
        }

        .tdo-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 12px 32px var(--shadow);
        }

        .tdo-input-row {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
        }

        .tdo-input {
          flex: 1;
          background: var(--input-bg);
          color: var(--text);
          border: 2px solid transparent;
          border-radius: 12px;
          padding: 16px 20px;
          font-size: 16px;
          font-weight: 500;
          outline: none;
          transition: all 0.2s;
        }

        .tdo-input:focus {
          background: var(--card-bg);
          border-color: var(--border);
          box-shadow: 0 8px 24px var(--shadow);
        }

        .tdo-add {
          border: none;
          border-radius: 12px;
          color: #fff;
          padding: 0 28px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          font-family: var(--font-heading);
        }

        .tdo-toolbar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 20px;
        }

        .tdo-clear {
          border: 1px solid var(--border);
          border-radius: 10px;
          background: transparent;
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
          padding: 8px 16px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .tdo-clear:hover:not(:disabled) { background: var(--danger-bg); color: var(--danger-text); border-color: transparent; }
        .tdo-clear:disabled { opacity: 0.4; cursor: not-allowed; }

        .tdo-list {
          display: flex; flex-direction: column; gap: 12px; min-height: 160px;
        }

        .tdo-item {
          display: flex; align-items: center; gap: 16px;
          border: 1px solid var(--border); border-radius: 14px;
          padding: 16px 20px; background: var(--bg); transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s cubic-bezier(0.16,1,0.3,1);
        }
        
        .tdo-item:hover { border-color: var(--border); transform: translateX(4px); box-shadow: 0 4px 12px var(--shadow); }

        .tdo-item.done { background: var(--input-bg); border-style: dashed; opacity: 0.6; }
        .tdo-item.done:hover { transform: none; box-shadow: none; }

        .tdo-check {
          width: 26px; height: 26px; border: 2px solid var(--border); border-radius: 8px;
          background: var(--card-bg); color: transparent; display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 14px; cursor: pointer; transition: all 0.2s;
        }
        
        .tdo-item.done .tdo-check { color: white; }

        .tdo-body { flex: 1; display: flex; flex-direction: column; gap: 4px; }

        .tdo-text { margin: 0; color: var(--text); font-size: 16px; font-weight: 500; word-break: break-word; transition: all 0.2s; }
        .tdo-item.done .tdo-text { text-decoration: line-through; color: var(--placeholder); }

        .tdo-del {
          border: none; background: var(--card-bg); color: var(--placeholder);
          width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
          font-size: 14px; cursor: pointer; opacity: 0; transform: scale(0.9); transition: all 0.2s;
          box-shadow: 0 2px 8px var(--shadow);
        }

        .tdo-item:hover .tdo-del { opacity: 1; transform: scale(1); }
        .tdo-del:hover { background: var(--danger-bg); color: var(--danger-text); }

        .tdo-empty {
          border: 2px dashed var(--border); border-radius: 12px; padding: 40px;
          text-align: center; color: var(--placeholder); font-size: 15px; font-weight: 500; background: var(--bg);
        }
      `}</style>
        </div>
    );
}