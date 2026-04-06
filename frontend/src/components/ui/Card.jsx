/**
 * 재사용 Card 컴포넌트
 *
 * [Props]
 *   children    - 카드 내부 콘텐츠
 *   className   - 추가 Tailwind 클래스
 *   hover       - true이면 마우스 오버 시 그림자 강조 + 살짝 위로 이동
 *   padding     - 'none' | 'sm' | 'md'(기본) | 'lg'
 *   ...rest     - onClick 등 div 네이티브 속성 전달 (클릭 가능한 카드에 활용)
 *
 * [디자인 원칙]
 *   - 배경: mentor-surface (순백 #FFFFFF)
 *   - 테두리: mentor-border (연한 회색 #E2E8F0)
 *   - 모서리: rounded-2xl (16px) — 디자인 시스템 최소 radius
 *   - 그림자: --shadow-card (아주 연한 그림자, :root 변수)
 *   - hover 그림자: --shadow-card-hover (파란 계열 글로우)
 */
export default function Card({
  children,
  className = '',
  hover     = false,
  padding   = 'md',
  ...rest
}) {
  /**
   * padding 단계별 여백 클래스
   * 넉넉한 여백이 디자인 원칙 — md(24px) 이상 권장
   */
  const paddingClasses = {
    none: '',
    sm:   'p-4',
    md:   'p-6',
    lg:   'p-8',
  };

  return (
    <div
      className={`
        rounded-2xl border border-mentor-border bg-mentor-surface
        shadow-[var(--shadow-card)]
        ${hover
          /* hover 시: 파란 글로우 그림자 + 1px 위로 이동 */
          ? 'transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5'
          : ''
        }
        ${paddingClasses[padding] ?? paddingClasses.md}
        ${className}
      `}
      {...rest}
    >
      {children}
    </div>
  );
}
