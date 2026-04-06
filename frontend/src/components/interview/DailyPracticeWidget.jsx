import { useCallback, useEffect, useState } from 'react';
import * as interviewApi from '../../api/interview';
import DAILY_PRACTICE_QUESTIONS from '../../data/dailyPracticeQuestions';
import useAuthStore from '../../store/authStore';

const STORAGE_KEY = 'daily-practice-state';

function buildDailyPracticeStorageKey(userStorageKey = 'anonymous') {
  return `${STORAGE_KEY}:${userStorageKey}`;
}

/**
 * 오늘의 날짜 문자열 (YYYY-MM-DD)
 */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 오늘의 질문을 날짜 기반 시드로 결정합니다.
 * 같은 날에는 항상 같은 질문이 나옵니다.
 */
function getQuestionForToday() {
  const today = todayKey();
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = ((hash << 5) - hash + today.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % DAILY_PRACTICE_QUESTIONS.length;
  return DAILY_PRACTICE_QUESTIONS[index];
}

/**
 * localStorage에서 오늘의 연습 결과를 로드합니다.
 */
function loadTodayState(userStorageKey) {
  try {
    const saved = localStorage.getItem(buildDailyPracticeStorageKey(userStorageKey));
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed.date !== todayKey()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveTodayState(state, userStorageKey) {
  localStorage.setItem(
    buildDailyPracticeStorageKey(userStorageKey),
    JSON.stringify({ ...state, date: todayKey() })
  );
}

export default function DailyPracticeWidget({ loading: parentLoading }) {
  const user = useAuthStore((state) => state.user);
  const userStorageKey = user?.email ?? 'anonymous';
  const question = getQuestionForToday();
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null); // { score, feedback }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 오늘 이미 제출한 결과가 있으면 복원
  useEffect(() => {
    const saved = loadTodayState(userStorageKey);
    if (saved?.result) {
      setAnswer(saved.answer || '');
      setResult(saved.result);
    } else {
      setAnswer('');
      setResult(null);
    }
  }, [userStorageKey]);

  const handleSubmit = useCallback(async () => {
    if (!answer.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await interviewApi.evaluateDailyPractice(question, answer.trim());
      const data = res.data.data;
      setResult(data);
      saveTodayState({ answer: answer.trim(), result: data }, userStorageKey);
    } catch (err) {
      setError('평가에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [answer, question]);

  const handleReset = useCallback(() => {
    setAnswer('');
    setResult(null);
    setError('');
    localStorage.removeItem(buildDailyPracticeStorageKey(userStorageKey));
  }, [userStorageKey]);

  if (parentLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-mentor-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 질문 */}
      <div className="rounded-2xl bg-mentor-accent/40 p-4">
        <p className="text-xs font-semibold text-mentor-primary mb-1.5">오늘의 질문</p>
        <p className="text-sm font-medium text-mentor-text leading-relaxed">{question}</p>
      </div>

      {result ? (
        /* 결과 표시 */
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white ${
              result.score >= 70 ? 'bg-emerald-500' : result.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
            }`}>
              {result.score}
            </div>
            <div>
              <p className="text-sm font-semibold text-mentor-text">
                {result.score >= 70 ? '좋은 답변이에요!' : result.score >= 40 ? '조금 더 보완해 보세요' : '다시 도전해 보세요'}
              </p>
              <p className="text-xs text-mentor-muted">AI 평가 점수</p>
            </div>
          </div>
          <div className="flex-1 rounded-xl bg-mentor-bg/60 p-3">
            <p className="text-xs leading-relaxed text-mentor-text">{result.feedback}</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="self-end rounded-lg px-3 py-1.5 text-xs font-medium text-mentor-primary hover:bg-mentor-accent/50 transition-colors"
          >
            다시 답변하기
          </button>
        </div>
      ) : (
        /* 입력 폼 */
        <div className="flex flex-1 flex-col gap-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="답변을 입력하세요..."
            className="flex-1 resize-none rounded-xl border border-mentor-border bg-mentor-bg/50 p-3 text-sm text-mentor-text placeholder:text-mentor-muted/50 focus:border-mentor-primary focus:outline-none focus:ring-1 focus:ring-mentor-primary/30"
            disabled={submitting}
          />
          {error && <p className="text-xs text-mentor-danger">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !answer.trim()}
            className="self-end rounded-xl bg-mentor-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-mentor-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? '평가 중...' : 'AI 평가 받기'}
          </button>
        </div>
      )}
    </div>
  );
}
