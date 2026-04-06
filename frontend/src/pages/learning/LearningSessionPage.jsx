import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as learningApi from '../../api/learning';
import AiWorkStatusCard from '../../components/common/AiWorkStatusCard';
import ChoiceButton from '../../components/learning/ChoiceButton';
import FeedbackPopup from '../../components/learning/FeedbackPopup';
import ProblemCard from '../../components/learning/ProblemCard';
import ResultSummary from '../../components/learning/ResultSummary';
import Button from '../../components/ui/Button';

/**
 * 학습 세션 페이지 (/learning/session)
 *
 * [역할]
 * LearningPage에서 생성한 문제를 한 문제씩 풀고
 * 제출 즉시 AI 채점 결과와 피드백을 받습니다.
 *
 * [상태 진입 조건]
 * LearningPage의 navigate state로 다음 값을 전달받습니다:
 *   { problems, subjectName, difficulty, count, type, subjectId }
 * state 없이 직접 접근하면 /learning으로 리다이렉트합니다.
 *
 * [문제 풀이 흐름]
 * 1. 현재 문제 표시 (ProblemCard)
 * 2. MULTIPLE: ChoiceButton으로 선택 / SHORT: 텍스트 입력
 * 3. "제출" 버튼 → POST /api/learning/attempts
 * 4. FeedbackPopup으로 정오답 + AI 피드백 표시
 * 5. "다음 문제" 버튼 → 다음 문제로 전환 또는 ResultSummary 표시
 *
 * [상태]
 *   currentIndex   - 현재 문제 인덱스 (0부터 시작)
 *   userAnswer     - 사용자가 입력/선택한 답변
 *   submitResult   - AI 채점 결과 { isCorrect, aiFeedback } (null이면 미제출)
 *   results        - 각 문제 결과 배열 (ResultSummary에 전달)
 *   isSubmitting   - 채점 API 호출 중 여부
 *   isDone         - 완료(전체 풀이 또는 중도 종료) 여부 (ResultSummary 표시)
 *   showExitConfirm - 종료 확인 모달 표시 여부
 */
export default function LearningSessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state;
  const sessionKeyFromRoute = searchParams.get('sessionKey') ?? '';
  const learningSessionKey = state?.sessionKey ?? sessionKeyFromRoute;
  const [recoveredSessionResult, setRecoveredSessionResult] = useState(null);
  const [restoringSessionResult, setRestoringSessionResult] = useState(
    !state?.problems?.length && !!learningSessionKey
  );

  // state 없이 직접 접근 차단
  useEffect(() => {
    if (state?.problems?.length) {
      setRestoringSessionResult(false);
      return;
    }

    if (!learningSessionKey) {
      navigate('/learning', { replace: true });
      return;
    }

    async function restoreSessionResult() {
      try {
        const { data } = await learningApi.getSessionResult(learningSessionKey);
        const sessionResult = data.data;

        if (!sessionResult?.completedProblemCount) {
          navigate('/learning', { replace: true });
          return;
        }

        setRecoveredSessionResult(sessionResult);
        setResults(
          (sessionResult.results ?? []).map((result) => ({
            question: result.question,
            isCorrect: result.correct,
            userAnswer: result.userAnswer,
            correctAnswer: result.correctAnswer,
            aiFeedback: result.aiFeedback,
          }))
        );
        setIsDone(true);
      } catch {
        navigate('/learning', { replace: true });
      } finally {
        setRestoringSessionResult(false);
      }
    }

    restoreSessionResult();
  }, [state, navigate, learningSessionKey]);

  const {
    problems: stateProblems = [],
    subjectName,
    subjectId,
    difficulty,
    learningMode = 'NORMAL',
  } = state ?? {};
  const problems =
    stateProblems.length > 0
      ? stateProblems
      : Array.from(
          { length: recoveredSessionResult?.totalProblemCount ?? 0 },
          () => null
        );

  // ── 컴포넌트 상태 ────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [submitResult, setSubmitResult] = useState(null); // { isCorrect, aiFeedback }
  const [results, setResults] = useState([]);             // 누적 결과 배열
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // 현재 문제 객체
  const currentProblem = problems[currentIndex];
  const isLastProblem = currentIndex === problems.length - 1;

  // 문제가 바뀔 때마다 답변·결과 초기화
  useEffect(() => {
    setUserAnswer('');
    setSubmitResult(null);
    setError('');
  }, [currentIndex]);

  // ── 답변 제출 ────────────────────────────────────────────────

  /**
   * 현재 문제에 대한 사용자 답변을 서버에 제출합니다.
   *
   * POST /api/learning/attempts 에 전달하는 필드:
   *   question      - 문제 본문 (채점 AI 컨텍스트 제공)
   *   correctAnswer - 정답 (채점 기준, 사용자에게는 제출 후에만 노출)
   *   userAnswer    - 사용자가 입력/선택한 답변
   *   explanation   - 해설 (AI가 피드백 작성 시 참고)
   *
   * [응답] { isCorrect: boolean, aiFeedback: string }
   */
  const handleSubmit = async () => {
    if (!userAnswer.trim()) {
      setError('답변을 입력하거나 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      /**
       * 학습 통계는 사용자별, 과목별로 집계해야 하므로
       * 문제 본문 외에 subjectId, difficulty, problemType도 함께 전송합니다.
       * 이 값이 빠지면 채점은 가능해도 통계 정확도가 떨어집니다.
       */
      const { data } = await learningApi.submitAttempt({
        subjectId,
        difficulty,
        problemType: currentProblem.type,
        question: currentProblem.question,
        correctAnswer: currentProblem.correctAnswer,
        userAnswer: userAnswer.trim(),
        sessionKey: learningSessionKey,
        sessionProblemCount: problems.length,
        sessionProblemOrder: currentIndex + 1,
        explanation: currentProblem.explanation,
      });

      const rawResult = data?.data ?? {};
      const result = {
        isCorrect: Boolean(rawResult.isCorrect ?? rawResult.correct),
        aiFeedback:
          rawResult.aiFeedback ??
          rawResult.feedback ??
          '채점 결과를 받지 못했습니다.',
      };

      // 채점 결과 저장 → FeedbackPopup 열림
      setSubmitResult(result);

      // 누적 결과 배열에 추가
      setResults((prev) => [
        ...prev,
        {
          question: currentProblem.question,
          isCorrect: result.isCorrect,
          userAnswer: userAnswer.trim(),
          correctAnswer: currentProblem.correctAnswer,
          aiFeedback: result.aiFeedback,
        },
      ]);
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ?? '채점 중 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 다음 문제 이동 ────────────────────────────────────────────

  /**
   * FeedbackPopup의 "다음 문제" 버튼 클릭 처리
   * - 마지막 문제였으면 → isDone=true로 ResultSummary 표시
   * - 아니면 → 다음 문제 인덱스로 이동
   */
  const handleNext = () => {
    setSubmitResult(null); // 팝업 닫기

    if (isLastProblem) {
      setIsDone(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // ── 중도 종료 ────────────────────────────────────────────────

  /**
   * 종료 버튼 클릭 처리
   *
   * [동작 방식]
   * 0문제 풀이와 부분 완료를 같은 모달에서 안내해
   * "점수 없이 나가기"와 "지금까지 평가받기"를 분리해 보여줍니다.
   */
  const handleExitRequest = () => {
    setShowExitConfirm(true);
  };

  /**
   * 종료 확인 모달에서 "종료" 선택
   *
   * [동작 방식]
   * - 0문제 풀이 → 점수 없이 설정 화면으로 돌아갑니다.
   * - 1문제 이상 풀이 → 지금까지 제출한 결과만으로 부분 완료 결과를 만듭니다.
   */
  const handleExitConfirm = () => {
    setShowExitConfirm(false);
    if (results.length === 0) {
      navigate('/learning', { replace: true });
      return;
    }

    setIsDone(true);
  };

  // ── 재시도 / 홈 이동 ─────────────────────────────────────────

  /**
   * 같은 설정으로 다시 문제를 생성합니다.
   * LearningPage가 navigate state를 받아서 처리하는 게 아니라,
   * LearningPage 자체에서 다시 설정을 선택하도록 이동합니다.
   */
  const handleRetry = () => {
    navigate('/learning', { replace: true });
  };

  /**
   * 심화 학습은 현재 세션 결과를 바탕으로 복습용 기본값만 먼저 채워 줍니다.
   * 백엔드 전용 API를 나중에 붙여도 이 이동 지점은 그대로 재사용할 수 있습니다.
   */
  const handleDeepLearning = () => {
    const incorrectCount = visibleResults.filter((result) => !result.isCorrect).length;
    const accuracyRate =
      visibleResults.length > 0
        ? Math.round((visibleResults.filter((result) => result.isCorrect).length / visibleResults.length) * 100)
        : 0;

    navigate('/learning', {
      state: {
        deepLearningPreset: {
          subjectId: visibleSubjectId,
          subjectName: visibleSubjectName,
          difficulty: accuracyRate < 40 ? 'EASY' : accuracyRate >= 75 ? 'HARD' : 'MEDIUM',
          count: incorrectCount >= 3 ? 8 : 4,
          type: 'MIX',
          reason:
            incorrectCount > 0
              ? `방금 학습에서 ${incorrectCount}문제를 틀려 약한 부분 중심으로 다시 복습합니다.`
              : '정답률은 높지만 반복 학습으로 더 안정적으로 굳힐 수 있습니다.',
          source: 'result-summary',
        },
      },
    });
  };

  const recoveredResults = (recoveredSessionResult?.results ?? []).map((result) => ({
    question: result.question,
    isCorrect: result.correct,
    userAnswer: result.userAnswer,
    correctAnswer: result.correctAnswer,
    aiFeedback: result.aiFeedback,
  }));
  const visibleResults = results.length > 0 ? results : recoveredResults;
  const visibleSubjectId = subjectId ?? recoveredSessionResult?.subjectId ?? null;
  const visibleSubjectName = subjectName || recoveredSessionResult?.subjectName || '';
  const visibleTotalProblemCount =
    problems.length > 0
      ? problems.length
      : recoveredSessionResult?.totalProblemCount ?? visibleResults.length;

  // ── 렌더링 ───────────────────────────────────────────────────

  if (restoringSessionResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F0F7FF] px-4">
        <div className="w-full max-w-lg">
          <AiWorkStatusCard
            title="AI 학습 결과를 다시 불러오고 있습니다."
            description="방금까지 저장된 풀이 기록을 기준으로 부분 완료 결과를 복원하고 있습니다."
            hint="새로고침 직후에는 백엔드에 저장된 마지막 기록을 먼저 확인합니다."
          />
        </div>
      </div>
    );
  }

  if (!state?.problems?.length && !recoveredSessionResult) return null;

  // 완료(전체 풀이 or 중도 종료) → 결과 요약 화면
  if (isDone) {
    const isEarlyExit =
      recoveredSessionResult?.partialCompletion ??
      visibleResults.length < visibleTotalProblemCount;
    return (
      <div className="min-h-screen bg-[#F0F7FF] px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-mentor-text">
              {isEarlyExit ? '학습 부분 완료' : '학습 완료'}
            </h1>
            <p className="text-sm text-mentor-muted">
              {visibleSubjectName}
              {isEarlyExit && (
                <span className="ml-2 text-amber-500">
                  ({results.length}/{problems.length}문제 기준 평가)
                </span>
              )}
            </p>
          </div>
          <ResultSummary
            results={visibleResults}
            subjectName={visibleSubjectName}
            totalProblemCount={visibleTotalProblemCount}
            isPartialCompletion={isEarlyExit}
            onRetry={handleRetry}
            onHome={() => navigate('/learning/weakness')}
            onDeepLearning={handleDeepLearning}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F7FF] px-4 py-8">
      <div className="mx-auto max-w-[780px] flex flex-col gap-5">

        {/* 페이지 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-mentor-text">{subjectName}</h1>
            <p className="text-xs text-mentor-muted">
              {learningMode === 'DEEP' ? '심화 학습' : '기본 학습'} · {DIFFICULTY_LABEL[difficulty]}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* 현재 문제 번호 표시 */}
            <span className="rounded-full bg-mentor-accent px-3 py-1 text-sm font-semibold text-mentor-primary">
              {currentIndex + 1} / {problems.length}
            </span>
            {/* 중도 종료 버튼 */}
            <button
              type="button"
              onClick={handleExitRequest}
              className="rounded-lg border border-mentor-border px-3 py-1.5 text-sm text-mentor-muted transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
            >
              그만두기
            </button>
          </div>
        </div>

        {/* 문제 카드 */}
        <ProblemCard
          orderNum={currentIndex + 1}
          totalProblems={problems.length}
          type={currentProblem.type}
          question={currentProblem.question}
        >
          {/* 객관식: ChoiceButton 목록 */}
          {currentProblem.type === 'MULTIPLE' && (
            <div className="flex flex-col gap-2 mt-2">
              {(currentProblem.choices ?? []).map((choice, i) => (
                <ChoiceButton
                  key={i}
                  index={i}
                  label={choice}
                  isSelected={userAnswer === choice}
                  // 제출 후: 정답 보기 강조, 사용자가 선택한 오답 강조
                  isCorrect={submitResult ? choice === currentProblem.correctAnswer : null}
                  isSubmitted={!!submitResult}
                  onClick={() => {
                    if (!submitResult) setUserAnswer(choice);
                  }}
                />
              ))}
            </div>
          )}

          {/* 주관식: 텍스트 입력창 */}
          {currentProblem.type === 'SHORT' && (
            <div className="mt-2">
              <textarea
                value={userAnswer}
                onChange={(e) => {
                  if (!submitResult) setUserAnswer(e.target.value);
                  if (error) setError('');
                }}
                disabled={!!submitResult}
                placeholder="답변을 입력하세요..."
                rows={4}
                className="w-full rounded-xl border border-mentor-border bg-mentor-bg px-4 py-3 text-sm
                           text-mentor-text outline-none transition resize-none min-h-[120px]
                           placeholder:text-mentor-muted/60
                           focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent
                           disabled:cursor-not-allowed"
              />
            </div>
          )}
        </ProblemCard>

        {/* 오류 메시지 */}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* 제출 버튼 — 제출 전에만 표시 */}
        {!submitResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Button
              onClick={handleSubmit}
              loading={isSubmitting}
              fullWidth
              size="lg"
              disabled={!userAnswer.trim()}
            >
              {isSubmitting ? '채점 중...' : '제출하기'}
            </Button>
          </motion.div>
        )}
      </div>

      {/* AI 채점 피드백 팝업 — 제출 후 표시 */}
      <FeedbackPopup
        isOpen={!!submitResult}
        isCorrect={submitResult?.isCorrect ?? false}
        correctAnswer={currentProblem?.correctAnswer}
        aiFeedback={submitResult?.aiFeedback ?? ''}
        isLast={isLastProblem}
        onNext={handleNext}
      />

      {/* 종료 확인 모달 */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-mentor-surface p-6 shadow-xl">
            <h2 className="text-base font-bold text-mentor-text">
              {results.length === 0 ? '학습을 그만둘까요?' : '지금까지 평가받을까요?'}
            </h2>
            <p className="mt-2 text-sm text-mentor-muted">
              {results.length === 0 ? (
                <>
                  아직 푼 문제가 없어 점수와 피드백은 생성되지 않습니다.
                  <br />
                  지금 나가면 학습 설정 화면으로 돌아갑니다.
                </>
              ) : (
                <>
                  지금까지 푼{' '}
                  <span className="font-semibold text-mentor-primary">{results.length}문제</span>
                  의 결과만 집계됩니다.
                  <br />
                  남은 {problems.length - results.length}문제는 이번 평가에 포함되지 않습니다.
                </>
              )}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 rounded-xl border border-mentor-border py-2.5 text-sm font-medium text-mentor-muted transition hover:bg-mentor-bg"
              >
                계속 풀기
              </button>
              <button
                type="button"
                onClick={handleExitConfirm}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                {results.length === 0 ? '설정으로 돌아가기' : '지금까지 평가받기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 상수 ──────────────────────────────────────────────────────

/** 난이도 영문 → 한글 레이블 변환 */
const DIFFICULTY_LABEL = {
  EASY:   '쉬움',
  MEDIUM: '보통',
  HARD:   '어려움',
};
