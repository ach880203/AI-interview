import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as interviewApi from '../../api/interview';
import Button from '../../components/ui/Button';
import ScoreTrendChart from '../../components/interview/ScoreTrendChart';

/**
 * 면접 이력 페이지 (/interview/history)
 *
 * [역할]
 * 사용자가 진행한 면접 세션 목록을 최신순으로 표시합니다.
 * - COMPLETED 세션: "결과 보기" 버튼으로 피드백 페이지로 이동
 * - STARTED 세션: 미완료 배지 표시 (재진입 불가)
 *
 * [데이터]
 * GET /api/interviews/sessions 를 통해 본인 세션 목록을 조회합니다.
 * 응답 형식: SessionSummaryResponseDto 배열
 *   { id, status, resumeId, coverLetterId, jobPostingId, startedAt, endedAt, createdAt }
 */

const PAGE_SIZE = 8;

export default function InterviewHistoryPage() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [growthSessions, setGrowthSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [endingSessionId, setEndingSessionId] = useState(null);

  // ── 세션 목록 + 성장 추적 조회 ───────────────────────────────

  /**
   * 마운트 시 면접 세션 목록과 성장 추적 데이터를 함께 불러옵니다.
   */
  useEffect(() => {
    async function loadSessions() {
      setLoading(true);
      setError('');
      try {
        const [sessionsResult, growthResult] = await Promise.allSettled([
          interviewApi.getSessions(),
          interviewApi.getGrowthReport(),
        ]);
        if (sessionsResult.status === 'fulfilled') {
          setSessions(sessionsResult.value.data.data ?? []);
        } else {
          setError(
            sessionsResult.reason?.response?.data?.error?.message ?? '면접 이력을 불러오지 못했습니다.'
          );
        }
        if (growthResult.status === 'fulfilled') {
          setGrowthSessions(growthResult.value.data.data?.sessions ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []);

  // 페이지네이션 계산
  const totalPages = Math.ceil(sessions.length / PAGE_SIZE);
  const paged = sessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── 렌더링 ───────────────────────────────────────────────────

  return (
    /* 전체 배경 — mentor-bg (거의 흰색) */
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto max-w-3xl">

        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            {/* 제목 — mentor-text (진한 네이비) */}
            <h1 className="text-2xl font-bold text-mentor-text">면접 이력</h1>
            <p className="mt-1 text-sm text-mentor-muted">
              지금까지 진행한 AI 모의 면접 세션 목록입니다.
            </p>
          </div>
          <Button onClick={() => navigate('/interview/setup')}>
            새 면접 시작
          </Button>
        </div>

        {/* 성장 추적 차트 */}
        {!loading && !error && (
          <div className="mb-6">
            <ScoreTrendChart sessions={growthSessions} loading={loading} />
          </div>
        )}

        {/* 로딩 스피너 — mentor 색상 */}
        {loading && (
          <div className="flex justify-center py-20">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
          </div>
        )}

        {/* 에러 */}
        {!loading && error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-mentor-danger">
            {error}
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && !error && sessions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-mentor-border bg-mentor-surface px-6 py-20 text-center">
            <p className="text-base font-semibold text-mentor-text">면접 이력이 없습니다.</p>
            <p className="mt-2 text-sm text-mentor-muted">
              AI 모의 면접을 진행하면 결과가 여기에 쌓입니다.
            </p>
            {/* 첫 면접 시작 버튼 — mentor-primary */}
            <button
              type="button"
              onClick={() => navigate('/interview/setup')}
              className="mt-6 rounded-xl bg-mentor-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
            >
              첫 면접 시작하기
            </button>
          </div>
        )}

        {/* 세션 목록 */}
        {!loading && !error && paged.length > 0 && (
          <>
            <div className="space-y-4">
              {paged.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  endingSessionId={endingSessionId}
                  onViewDetail={() => navigate(`/interview/sessions/${session.id}`)}
                  onViewResult={() => navigate(`/interview/result/${session.id}`)}
                  onResume={() => navigate(`/interview/session/${session.id}`)}
                  onEndForFeedback={async () => {
                    setEndingSessionId(session.id);
                    try {
                      const res = await interviewApi.endSession(session.id);
                      const feedback = res.data.data;
                      navigate(`/interview/result/${session.id}`, { state: { feedback } });
                    } catch (err) {
                      alert(err.response?.data?.error?.message ?? '피드백 생성에 실패했습니다.');
                    } finally {
                      setEndingSessionId(null);
                    }
                  }}
                />
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-8 flex flex-col items-center gap-3">
                {/* 페이지 정보 — muted 색상 */}
                <p className="text-xs text-mentor-muted">
                  전체 {sessions.length}개 · {page} / {totalPages} 페이지
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                    className="rounded-lg border border-mentor-border px-3 py-1.5 text-sm text-mentor-muted transition hover:bg-mentor-bg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`min-w-[2rem] rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                        p === page
                          ? 'border-mentor-primary bg-mentor-primary text-white'
                          : 'border-mentor-border text-mentor-muted hover:bg-mentor-bg'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === totalPages}
                    className="rounded-lg border border-mentor-border px-3 py-1.5 text-sm text-mentor-muted transition hover:bg-mentor-bg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 세션 카드 ─────────────────────────────────────────────────

/**
 * 면접 세션 요약 카드
 *
 * [역할]
 * 단일 면접 세션의 상태·날짜·소요 시간을 카드 형태로 표시합니다.
 * - COMPLETED: 초록 배지 + "결과 보기" 버튼
 * - STARTED(진행중): 노랑 배지 + "이어서 하기" / "중단하고 피드백 받기" 버튼
 *
 * @param {object}   session          - SessionSummaryResponseDto 객체
 * @param {number|null} endingSessionId - 현재 피드백 생성 중인 세션 ID
 * @param {Function} onViewDetail     - "Q&A 보기" 클릭 콜백
 * @param {Function} onViewResult     - "결과 보기" 클릭 콜백
 * @param {Function} onResume         - "이어서 하기" 클릭 콜백 (STARTED 세션)
 * @param {Function} onEndForFeedback - "중단하고 피드백 받기" 클릭 콜백 (STARTED 세션)
 */
function SessionCard({ session, endingSessionId, onViewDetail, onViewResult, onResume, onEndForFeedback }) {
  const isCompleted = session.status === 'COMPLETED';
  const isStarted = session.status === 'ONGOING';
  const isEndingThis = endingSessionId === session.id;
  /**
   * 이력 카드도 백엔드가 저장한 답변 수와 부분 완료 여부를 그대로 보여줘야
   * 새로고침 뒤에도 프런트 임시 계산과 어긋나지 않습니다.
   */
  const answeredQuestionCount = session.answeredQuestionCount ?? 0;
  const plannedQuestionCount =
    session.plannedQuestionCount ?? Math.max(answeredQuestionCount, 5);
  const isPartialCompleted =
    session.partialCompleted ?? answeredQuestionCount < plannedQuestionCount;

  /**
   * LocalDateTime 문자열(ISO 형식)을 사람이 읽기 쉬운 형태로 변환합니다.
   * @param {string|null} dt - ISO datetime 문자열
   */
  function formatDate(dt) {
    if (!dt) return '-';
    const d = new Date(dt);
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * 면접 소요 시간을 분 단위 문자열로 반환합니다.
   * startedAt과 endedAt이 모두 있을 때만 계산합니다.
   */
  function calcDuration(startedAt, endedAt) {
    if (!startedAt || !endedAt) return null;
    const diffMs = new Date(endedAt) - new Date(startedAt);
    const minutes = Math.round(diffMs / 60000);
    return minutes > 0 ? `${minutes}분` : '1분 미만';
  }

  const duration = calcDuration(session.startedAt, session.endedAt);

  return (
    /* 세션 카드 — mentor-surface(흰색) 배경, mentor-border 테두리 */
    <article className="rounded-2xl border border-mentor-border bg-mentor-surface p-5 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-start justify-between gap-4">

        {/* 왼쪽: 세션 정보 */}
        <div className="flex-1 min-w-0">
          {/* 상단: 세션 제목(회사·이력서) + 상태 배지 */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-mentor-text">
              {session.company
                ? `${session.company}${session.position ? ` · ${session.position}` : ''}`
                : session.resumeName
                  ? session.resumeName
                  : `면접 #${session.id}`}
            </span>
            {isCompleted ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                완료
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                진행중
              </span>
            )}
          </div>

          {/* 날짜 / 소요 시간 — muted 색상 */}
          {isCompleted && isPartialCompleted && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              부분 완료
            </span>
          )}
          <div className="space-y-1 text-xs text-mentor-muted">
            <p>시작: {formatDate(session.startedAt ?? session.createdAt)}</p>
            {isCompleted && session.endedAt && (
              <p>종료: {formatDate(session.endedAt)}</p>
            )}
            {duration && (
              <p className="font-medium text-mentor-text">소요: {duration}</p>
            )}
          </div>

          {/* 사용 서류 태그 — mentor 토큰으로 통일 */}
          <p className="mt-2 text-xs font-medium text-mentor-text">
            답변 {answeredQuestionCount} / {plannedQuestionCount}
          </p>
          {isCompleted && isPartialCompleted && (
            <p className="mt-1 text-xs text-mentor-muted">
              답변한 질문까지만 기준으로 평가한 결과입니다.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {session.resumeId && (
              <span className="rounded-full bg-mentor-accent px-2 py-0.5 text-xs text-mentor-primary">
                이력서: {session.resumeName ?? `#${session.resumeId}`}
              </span>
            )}
            {session.coverLetterId && (
              <span className="rounded-full bg-mentor-accent px-2 py-0.5 text-xs text-mentor-primary">
                자소서 #{session.coverLetterId}
              </span>
            )}
            {session.jobPostingId && (
              <span className="rounded-full bg-mentor-sky-light px-2 py-0.5 text-xs text-mentor-sky">
                {session.company ?? `공고 #${session.jobPostingId}`}
              </span>
            )}
            {!session.resumeId && !session.coverLetterId && !session.jobPostingId && (
              <span className="rounded-full bg-mentor-bg px-2 py-0.5 text-xs text-mentor-muted">
                서류 없음
              </span>
            )}
          </div>
        </div>

        {/* 오른쪽: 액션 버튼 */}
        <div className="shrink-0 flex flex-col gap-2">
          {/* 완료 세션: Q&A 보기 + 결과 보기 */}
          {isCompleted && (
            <>
              <button
                type="button"
                onClick={onViewDetail}
                className="rounded-xl border border-mentor-border px-4 py-2 text-sm font-medium text-mentor-muted transition hover:bg-mentor-bg active:scale-95"
              >
                Q&A 보기
              </button>
              <button
                type="button"
                onClick={onViewResult}
                className="rounded-xl bg-mentor-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark active:scale-95"
              >
                결과 보기
              </button>
            </>
          )}
          {/* 진행중 세션: 이어서 하기 + 중단하고 피드백 */}
          {isStarted && (
            <>
              <button
                type="button"
                onClick={onResume}
                className="rounded-xl bg-mentor-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark active:scale-95"
              >
                이어서 하기
              </button>
              <button
                type="button"
                onClick={onEndForFeedback}
                disabled={isEndingThis}
                className="rounded-xl border border-mentor-border px-4 py-2 text-sm font-medium text-mentor-muted transition hover:bg-mentor-bg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEndingThis ? '생성 중...' : '중단하고 피드백'}
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
