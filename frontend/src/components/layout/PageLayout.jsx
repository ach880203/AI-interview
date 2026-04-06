/**
 * 페이지 공통 래퍼 컴포넌트
 *
 * [역할]
 * 페이지 단위의 배경 색상·여백·최대 너비·헤더 영역을 일관되게 처리합니다.
 * 각 페이지에서 반복되는 레이아웃 코드를 한 곳에서 관리합니다.
 *
 * [Props]
 *   children     - 페이지 본문 콘텐츠
 *   title        - 페이지 제목 h1 텍스트 (선택)
 *   description  - 페이지 부제목 텍스트 (선택)
 *   action       - 제목 옆 오른쪽 영역에 표시할 요소 (버튼 등, 선택)
 *   maxWidth     - 'sm' | 'md' | 'lg'(기본) | 'xl' | 'full'
 *   className    - 추가 Tailwind 클래스 (외부에서 배경색 등 오버라이드)
 *
 * [사용 예]
 *   <PageLayout
 *     title="면접 설정"
 *     description="사용할 문서와 면접 유형을 선택하세요."
 *     action={<Button size="sm">바로 시작</Button>}
 *     maxWidth="md"
 *   >
 *     <InterviewSetupForm />
 *   </PageLayout>
 */
export default function PageLayout({
  children,
  title,
  description,
  action,
  maxWidth  = 'lg',
  className = '',
}) {
  /**
   * maxWidth별 max-width 클래스
   * sm(512px) → md(672px) → lg(1024px) → xl(1280px) → full(제한없음)
   */
  const maxWidthClasses = {
    sm:   'max-w-lg',
    md:   'max-w-2xl',
    lg:   'max-w-5xl',
    xl:   'max-w-7xl',
    full: 'max-w-full',
  };

  return (
    /* 페이지 배경: mentor-bg (거의 흰색 #F8FAFC) */
    <div className={`min-h-screen bg-mentor-bg px-4 py-8 ${className}`}>
      <div className={`mx-auto ${maxWidthClasses[maxWidth] ?? maxWidthClasses.lg}`}>

        {/* 페이지 헤더 — title 또는 description이 있을 때만 렌더링 */}
        {(title || description) && (
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              {/* h1: 페이지 내 유일한 최상위 제목 (SEO·접근성) */}
              {title && (
                <h1 className="text-2xl font-semibold text-mentor-text">
                  {title}
                </h1>
              )}
              {description && (
                <p className="mt-1.5 text-sm text-mentor-muted">{description}</p>
              )}
            </div>

            {/* action: 우측 버튼 영역 (선택) */}
            {action && (
              <div className="shrink-0">{action}</div>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
