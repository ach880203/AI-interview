import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import * as interviewApi from '../../api/interview';
import FeedbackCard from '../../components/interview/FeedbackCard';
import ScoreGauge from '../../components/interview/ScoreGauge';
import Button from '../../components/ui/Button';

/**
 * 면접 결과 페이지 (/interview/result/:id)
 *
 * [역할]
 * 면접 세션의 AI 피드백을 시각적으로 표시합니다.
 * - 종합 점수: 원형 게이지 (0~100)
 * - 항목별 점수: 논리성·관련성·구체성·의사소통·전문성 게이지 (0~100)
 * - 피드백 텍스트: 잘한 부분, 부족한 점, 개선 방향, 질문별 분석, 추천 답변
 *
 * [데이터 취득 방법]
 * 1. location.state.feedback 가 있으면 → 즉시 표시 (endSession 응답 재사용)
 * 2. 없으면 → GET /api/interviews/sessions/{id}/feedback 호출
 */
export default function InterviewResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const historyState = useMemo(() => window.history.state?.usr ?? {}, []);
  const initialFeedback = location.state?.feedback ?? historyState.feedback ?? null;
  const initialCompletionInfo =
    location.state?.completionInfo ?? historyState.completionInfo ?? null;

  const [feedback, setFeedback] = useState(null);
  const [completionInfo, setCompletionInfo] = useState(initialCompletionInfo);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadFeedback() {
      try {
        const [feedbackResult, sessionResult] = await Promise.all([
          initialFeedback
            ? Promise.resolve(initialFeedback)
            : interviewApi.getFeedback(id).then((response) => response.data.data),
          initialCompletionInfo
            ? Promise.resolve(initialCompletionInfo)
            : interviewApi.getSessionDetail(id).then((response) => {
                const sessionDetail = response.data.data ?? {};
                const qaList = sessionDetail.qaList ?? [];
                const answeredQuestionCount =
                  sessionDetail.answeredQuestionCount ??
                  qaList.filter((qa) => qa.answerText != null).length;
                const totalQuestionCount =
                  sessionDetail.plannedQuestionCount ?? Math.max(5, qaList.length);

                return {
                  isPartial:
                    sessionDetail.partialCompleted ??
                    answeredQuestionCount < totalQuestionCount,
                  answeredQuestionCount,
                  totalQuestionCount,
                };
              }),
        ]);

        setFeedback(feedbackResult);
        setCompletionInfo(sessionResult);
      } catch (err) {
        const msg =
          err.response?.data?.error?.message ?? '피드백을 불러올 수 없습니다.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    loadFeedback();
  }, [id, initialCompletionInfo, initialFeedback]);

  /**
   * 점수 비율(0~1)에 따라 색상 반환
   * 0.7 이상: 초록, 0.4 이상: 노랑, 미만: 빨강
   */
  function scoreColor(score, max) {
    const ratio = score / max;
    if (ratio >= 0.7) return '#10b981';
    if (ratio >= 0.4) return '#f59e0b';
    return '#ef4444';
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
          <p className="text-sm text-mentor-muted">AI 피드백을 분석하는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-mentor-text mb-2">피드백 조회 실패</p>
          <p className="text-sm text-mentor-muted mb-6">{error}</p>
          <Button onClick={() => navigate('/interview/setup')} variant="secondary">
            면접 다시 하기
          </Button>
        </div>
      </div>
    );
  }

  const answeredQuestionCount = completionInfo?.answeredQuestionCount ?? 0;
  const totalQuestionCount = completionInfo?.totalQuestionCount ?? 5;
  const isPartial =
    completionInfo?.isPartial ?? answeredQuestionCount < totalQuestionCount;

  /** 주요 점수 배열 — 5개 카테고리 */
  const mainScores = [
    { key: 'logic', label: '논리성', score: feedback.logicScore ?? 0 },
    { key: 'relevance', label: '관련성', score: feedback.relevanceScore ?? 0 },
    { key: 'specificity', label: '구체성', score: feedback.specificityScore ?? 0 },
    { key: 'communication', label: '의사소통', score: feedback.communicationScore ?? 0 },
    { key: 'professionalism', label: '전문성', score: feedback.professionalismScore ?? 0 },
  ];

  /** 보조 점수 배열 — Wave 1 추가 3개 */
  const subScores = [
    { key: 'attitude', label: '면접 태도', score: feedback.attitudeScore ?? 0 },
    { key: 'star', label: 'STAR 기법', score: feedback.starScore ?? 0 },
    { key: 'consistency', label: '일관성', score: feedback.consistencyScore ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-8">
      <div className="mx-auto max-w-2xl flex flex-col gap-6">

        {/* 헤더 */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-mentor-text">면접 결과</h1>
          <p className="mt-1 text-sm text-mentor-muted">세션 #{id}</p>
          <button
            type="button"
            onClick={() => navigate(`/interview/sessions/${id}`)}
            className="mt-2 text-xs text-mentor-primary hover:text-mentor-primary-dark underline underline-offset-2 transition"
          >
            전체 Q&A 보기
          </button>
        </div>

        {/* 완료 상태 */}
        <FeedbackCard
          variant={isPartial ? 'warning' : 'success'}
          icon={isPartial ? '📝' : '🎯'}
          title={isPartial ? '부분 완료 결과' : '전체 완료 결과'}
          content={
            isPartial
              ? `총 ${totalQuestionCount}개 질문 중 ${answeredQuestionCount}개 답변 기준으로 점수와 피드백을 만들었습니다. 남은 질문은 이번 평가에 포함되지 않았습니다.`
              : `총 ${totalQuestionCount}개 질문을 모두 완료했습니다. 전체 답변 기준 점수와 피드백입니다.`
          }
        />

        {/* 종합 점수 카드 */}
        <div className="rounded-2xl bg-mentor-surface p-8 shadow-lg text-center">
          <h2 className="mb-6 text-base font-semibold text-mentor-text">종합 점수</h2>
          <div className="flex justify-center">
            <ScoreGauge
              score={feedback.overallScore}
              max={100}
              label="종합"
              size={160}
              color={scoreColor(feedback.overallScore, 100)}
            />
          </div>
        </div>

        {/* 주요 항목 점수 카드 — 5개 */}
        <div className="rounded-2xl bg-mentor-surface p-8 shadow-lg">
          <h2 className="mb-1 text-base font-semibold text-mentor-text">항목별 점수</h2>
          <p className="mb-5 text-xs text-mentor-muted">핵심 역량 5개 항목 (종합 점수 반영)</p>
          <div className="grid grid-cols-5 gap-3">
            {mainScores.map((cat) => (
              <ScoreGauge
                key={cat.key}
                score={cat.score}
                max={100}
                label={cat.label}
                size={100}
                color={scoreColor(cat.score, 100)}
              />
            ))}
          </div>
        </div>

        {/* 보조 점수 카드 — Wave 1: 태도·STAR·일관성 */}
        <div className="rounded-2xl bg-mentor-surface p-8 shadow-lg">
          <h2 className="mb-1 text-base font-semibold text-mentor-text">심층 분석 점수</h2>
          <p className="mb-5 text-xs text-mentor-muted">면접 태도·STAR 기법·답변 일관성 (종합 점수 미반영)</p>
          <div className="grid grid-cols-3 gap-6">
            {subScores.map((cat) => (
              <ScoreGauge
                key={cat.key}
                score={cat.score}
                max={100}
                label={cat.label}
                size={110}
                color={scoreColor(cat.score, 100)}
              />
            ))}
          </div>
        </div>

        {/* 잘한 부분 */}
        {feedback.strengths && (
          <FeedbackCard
            variant="success"
            icon="💪"
            title="잘한 부분"
            content={feedback.strengths}
            collapsible
            defaultExpanded
          />
        )}

        {/* 부족한 부분 */}
        {feedback.weakPoints && (
          <FeedbackCard
            variant="danger"
            icon="⚠️"
            title="부족한 부분"
            content={feedback.weakPoints}
            collapsible
            defaultExpanded
          />
        )}

        {/* 개선 방향 */}
        {feedback.improvements && (
          <FeedbackCard
            variant="warning"
            icon="💡"
            title="개선 방향"
            content={feedback.improvements}
            collapsible
            defaultExpanded
          />
        )}

        {/* 면접 태도 분석 */}
        {feedback.attitudeFeedback && (
          <FeedbackCard
            variant="info"
            icon="🎯"
            title="면접 태도 분석"
            content={feedback.attitudeFeedback}
            collapsible
            defaultExpanded
          />
        )}

        {/* 답변 일관성 분석 */}
        {feedback.consistencyFeedback && (
          <FeedbackCard
            variant="info"
            icon="🔍"
            title="답변 일관성 분석"
            content={feedback.consistencyFeedback}
            collapsible
            defaultExpanded
          />
        )}

        {/* 질문별 상세 분석 */}
        {feedback.questionFeedbacks && (
          <FeedbackCard
            variant="info"
            icon="📋"
            title="질문별 상세 분석"
            content={feedback.questionFeedbacks}
            collapsible
            defaultExpanded
          />
        )}

        {/* 추천 답변 예시 */}
        {feedback.recommendedAnswer && (
          <FeedbackCard
            variant="success"
            icon="✅"
            title="모범 답변 예시"
            content={feedback.recommendedAnswer}
            collapsible
            defaultExpanded
          />
        )}

        {/* 답변 시간 관리 분석 */}
        {feedback.timingAnalysis && (
          <FeedbackCard
            variant="info"
            icon="⏱️"
            title="답변 시간 분석"
            content={feedback.timingAnalysis}
            collapsible
            defaultExpanded={false}
          />
        )}

        {/* 채용공고 키워드 커버리지 분석 */}
        {feedback.keywordAnalysis && (
          <FeedbackCard
            variant="warning"
            icon="🔑"
            title="채용공고 키워드 분석"
            content={feedback.keywordAnalysis}
            collapsible
            defaultExpanded
          />
        )}

        {/* 액션 버튼 */}
        <div className="flex flex-col gap-3 pb-8 sm:flex-row">
          <Button
            variant="secondary"
            className="sm:flex-1"
            onClick={() => navigate('/interview/history')}
          >
            면접 마치기
          </Button>
          <Button
            className="sm:flex-1"
            onClick={() => navigate('/interview/setup')}
          >
            다시 면접하기
          </Button>
        </div>
      </div>
    </div>
  );
}
