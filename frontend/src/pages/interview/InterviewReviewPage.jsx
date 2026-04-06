import { useEffect, useMemo, useState } from 'react';
import * as interviewApi from '../../api/interview';
import FeedbackCard from '../../components/interview/FeedbackCard';
import Button from '../../components/ui/Button';

const PAGE_SIZE = 6;

/**
 * 면접 복습 페이지입니다.
 *
 * [역할]
 * 이전 면접에서 받았던 질문과 사용자의 답변을 모아 복습 전용으로 보여 줍니다.
 *
 * [의도]
 * 기존 오답노트에 학습 오답과 면접 복습이 섞여 있어 사용 목적이 모호했습니다.
 * 면접 복습을 독립시키면 사용자가 "학습 오답"과 "면접 답변 복기"를 별도 흐름으로 이해할 수 있습니다.
 */
export default function InterviewReviewPage() {
  const [qaHistory, setQaHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  /**
   * 면접 Q&A 이력을 불러옵니다.
   */
  useEffect(() => {
    async function fetchQaHistory() {
      setLoading(true);
      setError('');

      try {
        const response = await interviewApi.getQaHistory();
        setQaHistory(response.data.data ?? []);
      } catch (requestError) {
        setError(
          requestError.response?.data?.error?.message ??
            '면접 복습 데이터를 불러오지 못했습니다.'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchQaHistory();
  }, []);

  /**
   * 최신 질문이 먼저 보이도록 정렬합니다.
   *
   * [주의]
   * 백엔드 정렬 기준이 바뀌더라도 화면에서 최신순을 유지할 수 있게 한 번 더 방어합니다.
   */
  const sortedHistory = useMemo(() => {
    return [...qaHistory].sort((left, right) => {
      return new Date(right.createdAt ?? 0) - new Date(left.createdAt ?? 0);
    });
  }, [qaHistory]);

  const totalPages = Math.max(1, Math.ceil(sortedHistory.length / PAGE_SIZE));
  const pagedHistory = sortedHistory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    /* 전체 배경 — mentor-bg */
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 헤더 — 밝은 그라디언트, 어두운 배경 제거 */}
        <section className="rounded-[28px] bg-gradient-to-br from-white via-mentor-sky-light to-mentor-warm border border-mentor-border px-7 py-8 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold text-mentor-primary">면접 복습</p>
          <h1 className="mt-3 text-3xl font-bold text-mentor-text">이전 면접 질문과 답변을 다시 정리하세요.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-mentor-muted">
            답변 길이, 핵심 전달력, 구체성 부족 구간을 다시 점검할 수 있도록 질문과 답변을 한 화면에 모았습니다.
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

        {!loading && !error && sortedHistory.length === 0 && (
          <div className="rounded-3xl border border-dashed border-mentor-border bg-mentor-surface px-6 py-16 text-center">
            <p className="text-base font-semibold text-mentor-text">복습할 면접 기록이 아직 없습니다.</p>
            <p className="mt-2 text-sm text-mentor-muted">면접을 완료하면 질문과 답변이 이곳에 쌓입니다.</p>
          </div>
        )}

        {!loading && !error && sortedHistory.length > 0 && (
          <>
            <div className="grid gap-4">
              {pagedHistory.map((item) => (
                <article
                  key={`${item.sessionId}-${item.orderNum}-${item.createdAt}`}
                  className="rounded-3xl border border-mentor-border bg-mentor-surface p-6 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 세션 배지 — mentor-accent */}
                    <span className="rounded-full bg-mentor-accent px-3 py-1 text-xs font-semibold text-mentor-primary">
                      세션 #{item.sessionId}
                    </span>
                    <span className="rounded-full bg-mentor-bg px-3 py-1 text-xs font-semibold text-mentor-muted">
                      질문 {item.orderNum}
                    </span>
                    <span className="ml-auto text-xs text-mentor-muted">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>

                  {/* 질문 박스 — mentor-bg 배경 */}
                  <div className="mt-4 rounded-2xl bg-mentor-bg p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mentor-muted">
                      질문
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-mentor-text">
                      {item.question}
                    </p>
                  </div>

                  <div className="mt-4">
                    <FeedbackCard
                      title="내 답변"
                      variant="info"
                      content={item.answerText || '아직 저장된 답변이 없습니다.'}
                      collapsible
                      defaultExpanded={false}
                    />
                  </div>
                </article>
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 복습 목록 페이지 이동 버튼 묶음입니다.
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
