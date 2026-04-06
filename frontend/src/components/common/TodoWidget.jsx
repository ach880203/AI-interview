import { useCallback, useEffect, useState } from 'react';
import useAuthStore from '../../store/authStore';

const TODO_STORAGE_KEY = 'dashboard-todos';

function buildTodoStorageKey(userStorageKey = 'anonymous') {
  return `${TODO_STORAGE_KEY}:${userStorageKey}`;
}

function loadTodos(userStorageKey) {
  try {
    const raw = localStorage.getItem(buildTodoStorageKey(userStorageKey));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTodos(todos, userStorageKey) {
  localStorage.setItem(buildTodoStorageKey(userStorageKey), JSON.stringify(todos));
}

export default function TodoWidget({ loading }) {
  const user = useAuthStore((state) => state.user);
  const userStorageKey = user?.email ?? 'anonymous';
  const [todos, setTodos] = useState([]);
  const [newText, setNewText] = useState('');

  useEffect(() => {
    setTodos(loadTodos(userStorageKey));
  }, [userStorageKey]);

  const persist = useCallback((next) => {
    setTodos(next);
    saveTodos(next, userStorageKey);
  }, [userStorageKey]);

  const handleAdd = useCallback(() => {
    if (!newText.trim()) return;
    persist([...todos, { id: crypto.randomUUID(), text: newText.trim(), done: false, createdAt: new Date().toISOString() }]);
    setNewText('');
  }, [newText, todos, persist]);

  const handleToggle = useCallback((id) => {
    persist(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }, [todos, persist]);

  const handleDelete = useCallback((id) => {
    persist(todos.filter((t) => t.id !== id));
  }, [todos, persist]);

  const handleClearDone = useCallback(() => {
    persist(todos.filter((t) => !t.done));
  }, [todos, persist]);

  const doneCount = todos.filter((t) => t.done).length;
  const totalCount = todos.length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-mentor-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-mentor-muted">
          {totalCount > 0 ? `${doneCount}/${totalCount} 완료` : '할 일을 추가해 보세요.'}
        </p>
        {doneCount > 0 && (
          <button
            type="button"
            onClick={handleClearDone}
            className="rounded-lg px-2 py-1 text-xs font-medium text-mentor-muted hover:text-mentor-danger hover:bg-red-50 transition-colors"
          >
            완료 항목 삭제
          </button>
        )}
      </div>

      {/* 진행 바 */}
      {totalCount > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-mentor-border/50">
          <div
            className="h-full rounded-full bg-mentor-primary transition-all duration-300"
            style={{ width: `${(doneCount / totalCount) * 100}%` }}
          />
        </div>
      )}

      {/* 입력 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="새 할 일..."
          className="flex-1 rounded-lg border border-mentor-border bg-mentor-bg/50 px-3 py-1.5 text-xs text-mentor-text placeholder:text-mentor-muted/50 focus:border-mentor-primary focus:outline-none focus:ring-1 focus:ring-mentor-primary/30"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newText.trim()}
          className="rounded-lg bg-mentor-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-mentor-primary/90 disabled:opacity-50"
        >
          추가
        </button>
      </div>

      {/* 목록 */}
      <ul className="flex-1 space-y-1 overflow-auto">
        {todos.length === 0 ? (
          <li className="flex items-center justify-center py-6 text-xs text-mentor-muted/60">
            아직 할 일이 없습니다.
          </li>
        ) : (
          todos.map((todo) => (
            <li
              key={todo.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-mentor-bg/60"
            >
              <button
                type="button"
                onClick={() => handleToggle(todo.id)}
                className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition ${
                  todo.done
                    ? 'border-mentor-primary bg-mentor-primary text-white'
                    : 'border-mentor-border hover:border-mentor-primary/50'
                }`}
              >
                {todo.done && (
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M2.5 6l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span className={`flex-1 text-xs leading-snug ${todo.done ? 'text-mentor-muted line-through' : 'text-mentor-text'}`}>
                {todo.text}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(todo.id)}
                className="shrink-0 rounded p-0.5 text-mentor-muted/40 opacity-0 transition hover:text-mentor-danger group-hover:opacity-100"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                </svg>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
