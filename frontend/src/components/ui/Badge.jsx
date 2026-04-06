/**
 * 재사용 Badge 컴포넌트
 *
 * [Props]
 *   children  - 뱃지 텍스트 (짧은 상태 레이블)
 *   variant   - 'info'(기본, 파랑) | 'success'(초록) | 'warning'(주황) | 'danger'(빨강) | 'neutral'(회색)
 *   size      - 'sm'(기본) | 'md'
 *   className - 추가 Tailwind 클래스
 *
 * [사용 예]
 *   <Badge variant="success">완료</Badge>
 *   <Badge variant="danger" size="md">오답</Badge>
 *
 * [디자인 원칙]
 *   - 모서리: rounded-full (완전히 둥근 알약 형태)
 *   - 테두리 있음: 배경만 있는 것보다 섬세하게 보임
 *   - info: mentor-accent 배경 + mentor-primary 텍스트 (브랜드 일관성)
 */
export default function Badge({
  children,
  variant   = 'info',
  size      = 'sm',
  className = '',
}) {
  /**
   * variant별 색상 클래스
   * bg(배경) + text(텍스트) + border(테두리) 조합
   */
  const variantClasses = {
    info:    'bg-mentor-accent     text-mentor-primary       border-mentor-primary-light',
    success: 'bg-emerald-50        text-emerald-700          border-emerald-200',
    warning: 'bg-amber-50          text-amber-700            border-amber-200',
    danger:  'bg-red-50            text-red-600              border-red-200',
    neutral: 'bg-mentor-bg        text-mentor-muted          border-mentor-border',
  };

  /**
   * size별 패딩·폰트 클래스
   * sm: 리스트·테이블 내 좁은 공간용
   * md: 카드·섹션 헤더 등 넓은 공간용
   */
  const sizeClasses = {
    sm: 'px-2   py-0.5 text-xs',
    md: 'px-2.5 py-1   text-sm',
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full border font-medium
        ${variantClasses[variant] ?? variantClasses.info}
        ${sizeClasses[size]       ?? sizeClasses.sm}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
