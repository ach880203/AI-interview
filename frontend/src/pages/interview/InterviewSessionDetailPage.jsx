import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as interviewApi from '../../api/interview';
import FeedbackCard from '../../components/interview/FeedbackCard';

/**
 * 면접 세션 상세 페이지 (/interview/sessions/:id)
 *
 * [역할]
 * 특정 면접 세션에서 오간 전체 Q&A를 질문 순서대로 보여 줍니다.
 * - 각 질문은 항상 표시되고, 내 답변은 FeedbackCard(collapsible)로 접기/펼치기
 * - COMPLETED 세션에는 "AI 피드백 보기" 버튼을 표시합니다.
 *
 * [데이터]
 * GET /api/interviews/sessions/{id} → SessionDetailResponseDto
 *   { id, status, qaList: [{ id, orderNum, question, answerText }], startedAt, endedAt }
 */
export default function InterviewSessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── 세션 상세 조회 ────────────────────────────────────────────

  /**
   * 마운트 시 세션 ID로 전체 Q&A를 불러옵니다.
   */
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data } = await interviewApi.getSessionDetail(id);
        setDetail(data.data);
      } catch (err) {
        setError(
          err.response?.data?.error?.message ?? '세션 정보를 불러올 수 없습니다.'
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ── 날짜 포맷 유틸 ────────────────────────────────────────────

  /**
   * ISO datetime 문자열을 한국어 날짜·시각 형식으로 변환합니다.
   * @param {string|null} dt
   */
  function formatDate(dt) {
    if (!dt) return '-';
    return new Date(dt).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * 면접 소요 시간을 분 단위 문자열로 반환합니다.
   */
  function calcDuration(startedAt, endedAt) {
    if (!startedAt || !endedAt) return null;
    const diffMs = new Date(endedAt) - new Date(startedAt);
    const minutes = Math.round(diffMs / 60000);
    return minutes > 0 ? `약 ${minutes}분` : '1분 미만';
  }

  // ── 렌더링 ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mentor-bg">
        <div className="flex flex-col items-center gap-4">
          {/* 로딩 스피너 — mentor 색상 */}
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
          <p className="text-sm text-mentor-muted">세션 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mentor-bg px-4">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-mentor-text mb-2">불러오기 실패</p>
          <p className="text-sm text-mentor-muted mb-6">{error}</p>
          {/* 돌아가기 버튼 — mentor-primary */}
          <button
            type="button"
            onClick={() => navigate('/interview/history')}
            className="rounded-xl bg-mentor-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-mentor-primary-dark"
          >
            면접 이력으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = detail?.status === 'COMPLETED';
  const qaList = detail?.qaList ?? [];
  const answeredQuestionCount =
    detail?.answeredQuestionCount ??
    qaList.filter((qa) => qa.answerText).length;
  const plannedQuestionCount =
    detail?.plannedQuestionCount ?? Math.max(qaList.length, answeredQuestionCount);
  /**
   * 백엔드가 부분 완료 여부를 저장했다면 그 값을 우선 사용합니다.
   * 새로고침이나 다른 기기에서 다시 열어도 같은 판단 기준을 유지하려는 의도입니다.
   */
  const isPartialCompleted =
    detail?.partialCompleted ?? answeredQuestionCount < plannedQuestionCount;
  const duration = calcDuration(detail?.startedAt, detail?.endedAt);

  return (
    /* 전체 배경 — mentor-bg */
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-3xl flex flex-col gap-6">

        {/* ── 헤더 ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {/* 뒤로가기 링크 — mentor-muted */}
              <button
                type="button"
                onClick={() => navigate('/interview/history')}
                className="text-sm text-mentor-muted hover:text-mentor-text transition"
              >
                ← 면접 이력
              </button>
            </div>
            <h1 className="text-2xl font-bold text-mentor-text">
              면접 #{id} 상세
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mentor-muted">
              {isCompleted ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-700">
                  완료
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-700">
                  미완료
                </span>
              )}
              {isCompleted && isPartialCompleted && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-700">
                  부분 완료
                </span>
              )}
              <span>시작: {formatDate(detail?.startedAt)}</span>
              {isCompleted && <span>종료: {formatDate(detail?.endedAt)}</span>}
              {duration && <span>소요: {duration}</span>}
              <span className="font-medium text-mentor-text">
                답변 {answeredQuestionCount} / {plannedQuestionCount}
              </span>
            </div>
          </div>

          {/* AI 피드백 버튼 — mentor-primary */}
          {isCompleted && (
            <button
              type="button"
              onClick={() => navigate(`/interview/result/${id}`)}
              className="shrink-0 rounded-xl bg-mentor-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark active:scale-95"
            >
              AI 피드백 보기
            </button>
          )}
        </div>

        {/* ── Q&A 목록 ──────────────────────────────────────────── */}
        {qaList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-mentor-border py-16 text-center">
            <p className="text-sm text-mentor-muted">기록된 질문이 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {qaList.map((qa) => (
              <QaCard key={qa.id} qa={qa} />
            ))}
          </div>
        )}

        {/* ── 하단 액션 ─────────────────────────────────────────── */}
        <div className="flex gap-3 pb-8">
          {/* 이력 목록 버튼 — mentor-border 테두리 */}
          <button
            type="button"
            onClick={() => navigate('/interview/history')}
            className="flex-1 rounded-xl border border-mentor-border py-2.5 text-sm font-medium text-mentor-muted transition hover:bg-mentor-bg"
          >
            이력 목록으로
          </button>
          {isCompleted && (
            <button
              type="button"
              onClick={() => navigate(`/interview/result/${id}`)}
              className="flex-1 rounded-xl bg-mentor-primary py-2.5 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
            >
              AI 피드백 보기
            </button>
          )}
          {/* 새 면접 시작 — mentor-text */}
          <button
            type="button"
            onClick={() => navigate('/interview/setup')}
            className="flex-1 rounded-xl bg-mentor-text py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            새 면접 시작
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Q&A 카드 ──────────────────────────────────────────────────

/**
 * 질문-답변 단건 카드
 *
 * [역할]
 * 순서 번호와 질문은 항상 표시하고,
 * 내 답변은 FeedbackCard(collapsible)로 접기/펼치기합니다.
 * 답변이 없는 질문(미완료 세션의 마지막 질문 등)은 "답변 없음" 표시.
 *
 * @param {{ id, orderNum, question, answerText }} qa
 */
function QaCard({ qa }) {
  return (
    /* Q&A 카드 — mentor-surface 배경, mentor-border 테두리 */
    <article className="rounded-2xl border border-mentor-border bg-mentor-surface p-5 shadow-[var(--shadow-card)]">
      {/* 질문 순서 배지 + 질문 본문 */}
      <div className="flex items-start gap-3 mb-3">
        {/* 순서 번호 — mentor-primary 배경 */}
        <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-mentor-primary text-xs font-bold text-white">
          {qa.orderNum}
        </span>
        <p className="text-sm font-semibold leading-relaxed text-mentor-text pt-0.5">
          {qa.question}
        </p>
      </div>

      {/* 내 답변 */}
      {qa.answerText ? (
        <FeedbackCard
          variant="info"
          title="내 답변"
          content={qa.answerText}
          collapsible
          defaultExpanded={false}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-mentor-border px-4 py-3 text-sm text-mentor-muted">
          답변 없음
        </div>
      )}
    </article>
  );
}
