/**
 * 원형 점수 게이지 컴포넌트
 *
 * [역할]
 * SVG stroke-dasharray / dashoffset 기법으로
 * 점수를 원형 프로그레스 바로 시각화합니다.
 *
 * [동작 원리]
 * - 원의 둘레 = 2π × r
 * - stroke-dasharray = 전체 둘레 (선 전체 길이)
 * - stroke-dashoffset = 둘레 × (1 - score/max)
 *   → 값이 클수록 채워지지 않은 부분이 많음
 * - SVG를 -90도 회전해 진행 방향이 12시(위)에서 시작하도록 설정
 *
 * [Props]
 *   score  - 표시할 점수 (숫자)
 *   max    - 최대 점수 (기본 10, overallScore는 100으로 전달)
 *   label  - 게이지 아래 레이블 텍스트
 *   size   - SVG 크기 px (기본 110)
 *   color  - 진행 색상 hex 값 (기본 indigo-500)
 */
export default function ScoreGauge({
  score = 0,
  max = 10,
  label = '',
  size = 110,
  color = '#5B9BD5',
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  // 비율 0~1 클램핑
  const ratio = Math.min(Math.max(score / max, 0), 1);
  const dashOffset = circumference * (1 - ratio);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* 상대 위치 컨테이너 — SVG + 텍스트 오버레이 */}
      <div className="relative" style={{ width: size, height: size }}>

        {/* SVG 원형 게이지 — -90도 회전으로 12시 방향에서 시작 */}
        <svg
          width={size}
          height={size}
          style={{ transform: 'rotate(-90deg)' }}
          aria-label={`${label}: ${score}/${max}`}
        >
          {/* 배경 트랙 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
          />
          {/* 진행 트랙 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>

        {/* 점수 텍스트 — 원 중앙에 절대 위치 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-mentor-text leading-none">{score}</span>
          <span className="text-xs text-mentor-muted">/ {max}</span>
        </div>
      </div>

      {/* 레이블 */}
      <span className="text-sm font-medium text-mentor-muted text-center">{label}</span>
    </div>
  );
}
