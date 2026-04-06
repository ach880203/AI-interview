import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllMemos, addMemo, updateMemo, migrateOldMemo } from '../../utils/memoStorage';
import useAuthStore from '../../store/authStore';

export default function MemoWidget({ loading }) {
  const user = useAuthStore((state) => state.user);
  const userStorageKey = user?.email ?? 'anonymous';
  const [memoId, setMemoId] = useState(null);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    migrateOldMemo(userStorageKey);
    const memos = getAllMemos(userStorageKey);
    if (memos.length > 0) {
      setMemoId(memos[0].id);
      setText(memos[0].text);
    } else {
      setMemoId(null);
      setText('');
    }
  }, [userStorageKey]);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setText(value);
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (memoId) {
        updateMemo(memoId, value, userStorageKey);
      } else if (value.trim()) {
        const memo = addMemo(value, userStorageKey);
        setMemoId(memo.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 500);
  }, [memoId, userStorageKey]);

  const handleNew = useCallback(() => {
    if (text.trim() && !memoId) {
      addMemo(text.trim(), userStorageKey);
    }
    const memo = addMemo('', userStorageKey);
    setMemoId(memo.id);
    setText('');
  }, [text, memoId, userStorageKey]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-mentor-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-mentor-muted">면접 준비 메모, 할 일, 아이디어 등 자유롭게 기록하세요.</p>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-emerald-500 font-medium animate-pulse">저장됨</span>
          )}
          <button
            type="button"
            onClick={handleNew}
            className="rounded-lg px-2 py-1 text-xs font-medium text-mentor-primary hover:bg-mentor-accent/50 transition-colors"
          >
            + 새 메모
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="메모를 입력하세요..."
        className="flex-1 resize-none rounded-xl border border-mentor-border bg-mentor-bg/50 p-3 text-sm text-mentor-text placeholder:text-mentor-muted/50 focus:border-mentor-primary focus:outline-none focus:ring-1 focus:ring-mentor-primary/30 leading-relaxed"
      />
    </div>
  );
}
