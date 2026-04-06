import { NavLink } from 'react-router-dom';

/**
 * 사이드바 내비게이션 컴포넌트
 *
 * [역할]
 * 특정 섹션 내에서 하위 페이지를 전환하는 사이드바 메뉴입니다.
 * 현재 경로와 일치하는 항목에 활성 스타일을 자동으로 적용합니다.
 *
 * [Props]
 *   items     - { to: string, label: string, icon?: string }[] 메뉴 항목 배열
 *   title     - 사이드바 상단 섹션 제목 (선택)
 *   className - 추가 Tailwind 클래스 (외부에서 너비 등 오버라이드)
 *
 * [사용 예]
 *   <Sidebar
 *     title="프로필 관리"
 *     items={[
 *       { to: '/profile/resume',       label: '이력서',      icon: '📄' },
 *       { to: '/profile/cover-letter', label: '자기소개서',  icon: '✍️' },
 *       { to: '/profile/job-posting',  label: '채용공고',    icon: '📋' },
 *     ]}
 *   />
 *
 * [디자인 원칙]
 *   - 너비: 기본 w-56 (224px), 외부에서 오버라이드 가능
 *   - 활성 항목: mentor-accent 배경 + mentor-primary 텍스트
 *   - 비활성 항목: mentor-muted 텍스트, hover 시 mentor-bg 배경
 */
export default function Sidebar({ items = [], title, className = '' }) {
  return (
    <aside
      className={`
        w-56 shrink-0 rounded-2xl border border-mentor-border
        bg-mentor-surface p-3 shadow-[var(--shadow-card)]
        ${className}
      `}
    >
      {/* 섹션 제목 — 소문자 전용, 추적 간격으로 구분감 표현 */}
      {title && (
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-mentor-muted">
          {title}
        </p>
      )}

      <nav className="flex flex-col gap-0.5">
        {items.map(({ to, label, icon }) => (
          /**
           * NavLink: react-router-dom이 현재 경로를 감지해
           * isActive를 자동으로 계산하므로 별도 상태 관리가 불필요합니다.
           */
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150
               ${isActive
                 /* 활성: 연한 파랑 배경 + mentor-primary 텍스트 */
                 ? 'bg-mentor-accent text-mentor-primary'
                 /* 비활성: hover 시 연한 배경 전환 */
                 : 'text-mentor-muted hover:bg-mentor-bg hover:text-mentor-text'
               }`
            }
          >
            {/* 아이콘 — aria-hidden으로 스크린리더에서 중복 읽기 방지 */}
            {icon && <span aria-hidden="true" className="text-base">{icon}</span>}
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
