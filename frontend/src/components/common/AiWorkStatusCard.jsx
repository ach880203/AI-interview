/**
 * AI 작업 상태 카드
 *
 * [역할]
 * AI가 질문, 문제, 음성을 준비하는 동안
 * 사용자가 왜 기다리고 있는지 한눈에 이해할 수 있게 안내합니다.
 *
 * [디자인 원칙]
 * 기존 mentor 색상과 카드 리듬을 유지하면서,
 * 과한 애니메이션 대신 "노트에 펜이 적히는 느낌"을 가볍게 표현합니다.
 */
export default function AiWorkStatusCard({
  title,
  description,
  hint = '',
  compact = false,
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border border-mentor-primary/15 bg-mentor-surface shadow-sm ${
        compact ? 'px-4 py-4' : 'px-5 py-5'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`relative flex shrink-0 items-center justify-center rounded-2xl bg-mentor-accent ${
            compact ? 'h-14 w-14' : 'h-16 w-16'
          }`}
          aria-hidden="true"
        >
          <span className="absolute inset-3 rounded-xl border border-white/80 bg-white/85" />
          <span className="absolute left-5 top-5 h-0.5 w-6 rounded-full bg-mentor-primary/40" />
          <span className="absolute left-5 top-8 h-0.5 w-7 rounded-full bg-mentor-primary/30" />
          <span className="absolute left-5 top-11 h-0.5 w-5 rounded-full bg-mentor-primary/25" />
          <span className="absolute right-4 top-4 text-base text-mentor-primary animate-bounce">
            ✏️
          </span>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-mentor-text">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-mentor-muted">
            {description}
          </p>
          {hint && (
            <p className="mt-2 text-xs leading-relaxed text-mentor-primary">
              {hint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
