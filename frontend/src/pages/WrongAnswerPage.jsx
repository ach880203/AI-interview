import { useEffect, useMemo, useState } from 'react';
import * as learningApi from '../api/learning';
import Button from '../components/ui/Button';

const PAGE_SIZE = 8;

/**
 * 학습 오답노트 페이지입니다.
 *
 * [역할]
 * 틀린 학습 문제만 모아서 다시 풀고 정답과 피드백을 확인할 수 있게 합니다.
 *
 * [의도]
 * 면접 복습 기능을 분리한 뒤에는 이 페이지가 학습 보완에만 집중해야 합니다.
 * 그래서 학습 문제, 사용자 답안, 정답, AI 피드백 흐름만 남겨 단순하게 정리했습니다.
 */
export default function WrongAnswerPage() {
  const [wrongAttempts, setWrongAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [practiceItem, setPracticeItem] = useState(null);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [practiceResult, setPracticeResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * 학습 오답 데이터를 불러옵니다.
   */
  useEffect(() => {
    async function fetchWrongAttempts() {
      setLoading(true);
      setError('');

      try {
        const response = await learningApi.getWrongAttempts();
        setWrongAttempts(response.data.data ?? []);
      } catch (requestError) {
        setError(
          requestError.response?.data?.error?.message ??
            '오답노트 데이터를 불러오지 못했습니다.'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchWrongAttempts();
  }, []);

  /**
   * 최신 오답이 먼저 보이도록 정렬합니다.
   */
  const sortedAttempts = useMemo(() => {
    return [...wrongAttempts].sort((left, right) => {
      return new Date(right.createdAt ?? 0) - new Date(left.createdAt ?? 0);
    });
  }, [wrongAttempts]);

  const totalPages = Math.max(1, Math.ceil(sortedAttempts.length / PAGE_SIZE));
  const pagedAttempts = sortedAttempts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /**
   * 다시 풀기 모달을 엽니다.
   */
  function openPractice(item) {
    setPracticeItem(item);
    setPracticeAnswer('');
    setPracticeResult(null);
  }

  /**
   * 다시 풀기 모달을 닫습니다.
   */
  function closePractice() {
    setPracticeItem(null);
    setPracticeAnswer('');
    setPracticeResult(null);
  }

  /**
   * 다시 풀기 답안을 채점합니다.
   */
  async function handleSubmitPractice() {
    if (!practiceItem || !practiceAnswer.trim()) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await learningApi.submitAttempt({
        subjectId: practiceItem.subjectId,
        difficulty: practiceItem.difficulty,
        problemType: practiceItem.problemType,
        question: practiceItem.question,
        correctAnswer: practiceItem.correctAnswer,
        userAnswer: practiceAnswer,
      });

      const result = response.data.data ?? response.data;
      setPracticeResult(result);

      if (result.isCorrect) {
        setWrongAttempts((previous) =>
          previous.filter((attempt) => attempt.id !== practiceItem.id)
        );
      }
    } catch (requestError) {
      setPracticeResult({
        isCorrect: false,
        aiFeedback:
          requestError.response?.data?.error?.message ??
          '다시 풀기 채점에 실패했습니다.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    /* 전체 배경 — mentor-bg */
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 헤더 섹션 — mentor-surface 카드 */}
        <section className="rounded-[28px] bg-mentor-surface p-7 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold text-mentor-primary">학습 오답노트</p>
          <h1 className="mt-3 text-3xl font-bold text-mentor-text">
            틀린 문제를 바로 다시 풀 수 있게 정리했습니다.
          </h1>
          <p className="mt-3 text-sm leading-6 text-mentor-muted">
            학습 문제와 오답, 정답, AI 피드백을 한 카드 안에서 보도록 구성해 복습 속도를 높였습니다.
          </p>
        </section>

        {loading && (
          <div className="flex justify-center py-20">
            {/* 로딩 스피너 — mentor 색상 */}
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-mentor-danger">
            {error}
          </div>
        )}

        {!loading && !error && sortedAttempts.length === 0 && (
          /* 빈 상태 — mentor-surface 배경, mentor-border 점선 */
          <div className="rounded-3xl border border-dashed border-mentor-border bg-mentor-surface px-6 py-16 text-center">
            <p className="text-base font-semibold text-mentor-text">현재 오답이 없습니다.</p>
            <p className="mt-2 text-sm text-mentor-muted">학습을 진행하면 틀린 문제가 이곳에 쌓입니다.</p>
          </div>
        )}

        {!loading && !error && sortedAttempts.length > 0 && (
          <>
            <div className="grid gap-4">
              {pagedAttempts.map((item) => (
                /* 오답 카드 — mentor-surface, mentor-border */
                <article key={item.id} className="rounded-3xl border border-mentor-border bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 과목 배지 — mentor-accent */}
                    <span className="rounded-full bg-mentor-accent px-3 py-1 text-xs font-semibold text-mentor-primary">
                      {item.subject ?? '학습'}
                    </span>
                    {item.difficulty && (
                      <span className="rounded-full bg-mentor-bg px-3 py-1 text-xs font-semibold text-mentor-muted">
                        {item.difficulty}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-mentor-muted">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>

                  {/* 문제 박스 — mentor-bg 배경 */}
                  <div className="mt-4 rounded-2xl bg-mentor-bg p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">
                      문제
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-mentor-text">
                      {item.question}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <InfoBlock label="내 답안" text={item.userAnswer} tone="wrong" />
                    <InfoBlock label="정답" text={item.correctAnswer} tone="correct" />
                    <InfoBlock label="AI 피드백" text={item.aiFeedback || '피드백이 없습니다.'} tone="info" />
                  </div>

                  <div className="mt-4">
                    <Button className="w-auto px-4" onClick={() => openPractice(item)}>
                      다시 풀기
                    </Button>
                  </div>
                </article>
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>

      {practiceItem && (
        <PracticeModal
          item={practiceItem}
          answer={practiceAnswer}
          result={practiceResult}
          submitting={submitting}
          onChangeAnswer={setPracticeAnswer}
          onClose={closePractice}
          onSubmit={handleSubmitPractice}
        />
      )}
    </div>
  );
}

/**
 * 다시 풀기 모달입니다.
 */
function PracticeModal({
  item,
  answer,
  result,
  submitting,
  onChangeAnswer,
  onClose,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-3xl bg-mentor-surface p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-mentor-text">오답 다시 풀기</h2>
            <p className="mt-1 text-sm text-mentor-muted">기존 오답과 비교해 답변을 다시 정리해 보세요.</p>
          </div>
          {/* 닫기 버튼 — mentor-bg */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-mentor-bg px-3 py-1 text-sm font-semibold text-mentor-muted transition hover:bg-mentor-border"
          >
            닫기
          </button>
        </div>

        {/* 문제 박스 — mentor-bg 배경 */}
        <div className="mt-5 rounded-2xl bg-mentor-bg p-4">
          <p className="text-sm font-semibold leading-7 text-mentor-text">{item.question}</p>
        </div>

        {/* 답변 입력 — mentor-border, mentor-primary 포커스 */}
        <textarea
          rows={6}
          value={answer}
          onChange={(event) => onChangeAnswer(event.target.value)}
          placeholder="정답 근거를 포함해서 다시 작성해 보세요."
          className="mt-4 w-full rounded-2xl border border-mentor-border px-4 py-3 text-sm outline-none transition focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
        />

        {result && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <InfoBlock
              label="채점 결과"
              text={result.isCorrect ? '정답입니다.' : '아직 보완이 필요합니다.'}
              tone={result.isCorrect ? 'correct' : 'wrong'}
            />
            <InfoBlock
              label="AI 피드백"
              text={result.aiFeedback || '피드백이 없습니다.'}
              tone="info"
            />
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button loading={submitting} onClick={onSubmit}>
            AI 채점하기
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * 정보 블록입니다.
 */
function InfoBlock({ label, text, tone }) {
  const toneClassMap = {
    wrong: 'border-red-100 bg-red-50 text-red-700',
    correct: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    info: 'border-blue-100 bg-blue-50 text-blue-700',
  };

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClassMap[tone]}`}>
      <p className="text-xs font-semibold opacity-70">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{text}</p>
    </div>
  );
}

/**
 * 페이지 이동 버튼입니다.
 */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="secondary"
        className="w-auto px-4"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        이전
      </Button>
      {/* 페이지 표시 — mentor-muted */}
      <span className="text-sm font-semibold text-mentor-muted">
        {page} / {totalPages}
      </span>
      <Button
        variant="secondary"
        className="w-auto px-4"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        다음
      </Button>
    </div>
  );
}

/**
 * 날짜를 한국어 형식으로 변환합니다.
 */
function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('ko-KR');
}
