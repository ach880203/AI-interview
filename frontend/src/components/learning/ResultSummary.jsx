/**
 * 학습 결과 요약 컴포넌트
 *
 * [역할]
 * 모든 문제를 푼 뒤 전체 결과를 요약해서 보여줍니다.
 * - 총 정답률
 * - 틀린 문제 요약
 * - 문제별 결과
 * - 다시 학습 / 심화 학습 / 약점 분석 이동
 *
 * [Props]
 *   results - 각 문제 결과 배열
 *   subjectName - 학습한 과목 이름
 *   totalProblemCount - 세션 전체 문제 수
 *   isPartialCompletion - 중간 종료 여부
 *   onRetry - 같은 설정으로 다시 풀기
 *   onHome - 약점 분석 페이지로 이동
 *   onDeepLearning - 심화 학습 시작
 */
export default function ResultSummary({
  results = [],
  subjectName,
  totalProblemCount = results.length,
  isPartialCompletion = false,
  onRetry,
  onHome,
  onDeepLearning,
}) {
  const correctCount = results.filter((result) => result.isCorrect).length;
  const total = results.length;
  const wrongResults = results.filter((result) => !result.isCorrect);
  const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  function getMessage() {
    if (rate >= 80) {
      return { emoji: '🎯', text: '훌륭합니다. 핵심 내용을 안정적으로 이해하고 있습니다.' };
    }

    if (rate >= 50) {
      return { emoji: '📘', text: '좋습니다. 약한 부분만 한 번 더 정리하면 더 빠르게 올라갑니다.' };
    }

    return { emoji: '🧠', text: '이번 결과를 바탕으로 다시 복습하면 실력이 빠르게 올라갑니다.' };
  }

  const { emoji, text } = getMessage();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-mentor-surface p-8 text-center shadow-lg">
        <div className="mb-4 inline-flex rounded-full bg-mentor-accent px-3 py-1 text-xs font-semibold text-mentor-primary">
          {isPartialCompletion ? '부분 완료 결과' : '전체 완료 결과'}
        </div>
        <p className="mb-2 text-4xl">{emoji}</p>
        {subjectName && (
          <p className="mb-2 text-sm font-medium text-mentor-muted">
            {subjectName} 학습 결과
          </p>
        )}
        <h2 className="mb-1 text-xl font-bold text-mentor-text">
          {correctCount} / {total} 문제 정답
        </h2>
        <p className="mb-3 text-3xl font-bold text-mentor-primary">{rate}%</p>
        <p className="text-sm text-mentor-muted">{text}</p>
        <p className="mt-3 text-xs leading-relaxed text-mentor-muted">
          {isPartialCompletion
            ? `총 ${totalProblemCount}문제 중 ${total}문제까지 풀이한 기록으로 결과를 계산했습니다.`
            : `총 ${totalProblemCount}문제를 모두 완료한 결과입니다.`}
        </p>

        <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-mentor-bg">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>

      {wrongResults.length > 0 && (
        <div className="rounded-2xl bg-mentor-surface p-6 shadow-lg">
          <h3 className="mb-4 text-sm font-semibold text-mentor-text">오답 요약</h3>
          <div className="flex flex-col gap-3">
            {wrongResults.map((result, index) => (
              <div
                key={`${result.question}-${index}`}
                className="rounded-xl border border-mentor-border bg-mentor-bg px-4 py-3"
              >
                <p className="text-sm font-medium text-mentor-text">
                  Q{results.indexOf(result) + 1}. {result.question}
                </p>
                <p className="mt-1 text-xs text-mentor-muted">
                  정답: <span className="font-semibold text-emerald-600">{result.correctAnswer}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-mentor-surface p-6 shadow-lg">
        <h3 className="mb-4 text-sm font-semibold text-mentor-text">문제별 결과</h3>
        <ul className="flex flex-col gap-3">
          {results.map((result, index) => (
            <li key={`${result.question}-${index}`} className="flex gap-3 rounded-xl border border-mentor-border p-3">
              <span
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                  result.isCorrect ? 'bg-emerald-500' : 'bg-red-400'
                }`}
                aria-label={result.isCorrect ? '정답' : '오답'}
              >
                {result.isCorrect ? 'O' : 'X'}
              </span>

              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm text-mentor-text">
                  Q{index + 1}. {result.question}
                </p>
                {!result.isCorrect && (
                  <p className="mt-0.5 text-xs text-mentor-muted">
                    정답: <span className="text-emerald-600">{result.correctAnswer}</span>
                  </p>
                )}
                {result.aiFeedback && (
                  <p className="mt-2 rounded-xl bg-mentor-bg px-3 py-2 text-xs leading-relaxed text-mentor-muted">
                    {result.aiFeedback}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-mentor-surface p-6 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-mentor-text">심화 학습하기</h3>
            <p className="mt-1 text-xs leading-relaxed text-mentor-muted">
              이번 결과를 바탕으로 약한 과목과 복습 난이도를 자동으로 추천해 다시 학습할 수 있습니다.
            </p>
          </div>
          <span className="rounded-full bg-mentor-accent px-3 py-1 text-xs font-semibold text-mentor-primary">
            1차 연결 완료
          </span>
        </div>
        <p className="mt-3 rounded-xl bg-mentor-bg px-4 py-3 text-sm leading-relaxed text-mentor-muted">
          현재는 과목, 난이도, 문제 수를 자동으로 채운 뒤 학습 시작 화면으로 연결합니다.
          다음 단계에서는 오답 개념 중심 문제를 더 정교하게 뽑도록 확장할 예정입니다.
        </p>
      </div>

      <div className="grid gap-3 pb-8 sm:grid-cols-2">
        <button
          type="button"
          onClick={onRetry}
          className="w-full rounded-xl bg-mentor-primary py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
        >
          같은 설정으로 다시 풀기
        </button>
        <button
          type="button"
          onClick={onDeepLearning}
          className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          심화 학습 시작하기
        </button>
        <button
          type="button"
          onClick={onHome}
          className="w-full rounded-xl border border-mentor-border bg-mentor-surface py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg sm:col-span-2"
        >
          약점 분석 페이지 보기
        </button>
      </div>
    </div>
  );
}
