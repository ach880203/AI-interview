import { Link } from 'react-router-dom';

/**
 * 랜딩 페이지 전용 헤더 (라이트 테마)
 * 비로그인 사용자용 — 로고, 로그인, 가입하기 버튼만 표시합니다.
 */
export default function LandingNavbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-mentor-border bg-mentor-surface/90 backdrop-blur-md shadow-[var(--shadow-card)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">

        {/* 로고 */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-mentor-primary text-white text-xs font-black shadow-md shadow-mentor-primary/30 transition group-hover:shadow-mentor-primary/50">
            AI
          </div>
          <span className="text-base font-bold text-mentor-text transition group-hover:text-mentor-primary">
            Interview Mentor
          </span>
        </Link>

        {/* 우측 액션 */}
        <nav className="flex items-center gap-2">
          <Link
            to="/auth/login"
            className="rounded-xl px-4 py-2 text-sm font-medium text-mentor-muted transition hover:bg-mentor-bg hover:text-mentor-text"
          >
            로그인
          </Link>
          <Link
            to="/auth/register"
            className="rounded-xl bg-mentor-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-mentor-primary/25 transition hover:bg-mentor-primary-dark active:scale-95"
          >
            가입하기
          </Link>
        </nav>
      </div>
    </header>
  );
}
