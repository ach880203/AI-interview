/**
 * 재사용 Button 컴포넌트
 *
 * [Props]
 *   children   - 버튼 내부 텍스트 또는 React 요소
 *   loading    - true이면 스피너를 표시하고 비활성화 (API 호출 중 중복 제출 방지)
 *   variant    - 'primary'(기본) | 'secondary'(외곽선) | 'ghost'(배경 없음) | 'danger'(위험)
 *   size       - 'sm' | 'md'(기본) | 'lg'
 *   fullWidth  - true이면 부모 너비 전체 차지 (기본: false, 폼 버튼에 활용)
 *   className  - 추가 Tailwind 클래스 (외부에서 너비·마진 등 오버라이드)
 *   ...rest    - type, onClick, disabled 등 <button> 네이티브 속성 전달
 *
 * [디자인 원칙]
 *   - 둥근 모서리: rounded-2xl (16px), sm 사이즈는 rounded-xl (12px)
 *   - Primary: mentor-primary (#5B9BD5 하늘색), hover 시 mentor-primary-dark (#4A8BC4)
 *   - 눌림 피드백: active:scale-[0.98] 로 미세한 클릭감 제공
 *   - 포커스 링: focus:ring-2 + ring-offset-2 (키보드 접근성)
 *   - 로딩 시: 스피너 아이콘 + 버튼 비활성화 (이중 제출 방지)
 */
export default function Button({
  children,
  loading    = false,
  variant    = 'primary',
  size       = 'md',
  fullWidth  = false,
  className  = '',
  ...rest
}) {
  /**
   * variant별 색상·테두리 클래스
   *
   * primary   — 채워진 파란 버튼: 주요 행동 (제출, 시작)
   * secondary — 외곽선 버튼: 보조 행동 (취소, 돌아가기)
   * ghost     — 배경 없는 버튼: 탭·토글 등 UI 내 동작
   * danger    — 빨간 버튼: 삭제·위험한 동작
   */
  const variantClasses = {
    primary:
      'bg-mentor-primary text-white shadow-sm shadow-mentor-primary/20 ' +
      'hover:bg-mentor-primary-dark hover:shadow-mentor-primary/30 ' +
      'focus:ring-mentor-primary/40 ' +
      'disabled:bg-mentor-primary-light disabled:shadow-none',

    secondary:
      'border border-mentor-border bg-mentor-surface text-mentor-text ' +
      'hover:bg-mentor-accent hover:border-mentor-primary/30 hover:text-mentor-primary ' +
      'focus:ring-mentor-primary/30 ' +
      'disabled:opacity-50',

    ghost:
      'bg-transparent text-mentor-muted ' +
      'hover:bg-mentor-accent hover:text-mentor-primary ' +
      'focus:ring-mentor-primary/30 ' +
      'disabled:opacity-50',

    danger:
      'bg-mentor-danger text-white shadow-sm shadow-mentor-danger/20 ' +
      'hover:bg-red-600 ' +
      'focus:ring-mentor-danger/40 ' +
      'disabled:opacity-60',
  };

  /**
   * size별 패딩·폰트·모서리 클래스
   * border-radius는 디자인 원칙상 16px(2xl) 이상 유지
   */
  const sizeClasses = {
    sm: 'rounded-xl  px-3   py-1.5 text-xs  font-medium',
    md: 'rounded-2xl px-4   py-2.5 text-sm  font-semibold',
    lg: 'rounded-2xl px-6   py-3   text-base font-semibold',
  };

  return (
    <button
      disabled={loading || rest.disabled}
      className={`
        inline-flex items-center justify-center gap-2
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:cursor-not-allowed active:scale-[0.98]
        ${fullWidth ? 'w-full' : ''}
        ${variantClasses[variant] ?? variantClasses.primary}
        ${sizeClasses[size]    ?? sizeClasses.md}
        ${className}
      `}
      {...rest}
    >
      {/* 로딩 중이면 회전 스피너 아이콘 표시 (border-t-transparent 기법) */}
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
