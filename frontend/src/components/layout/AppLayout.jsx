import Navbar from './Navbar';

/**
 * 인증 후 공통 레이아웃 컴포넌트
 *
 * [역할]
 * 로그인한 사용자가 접근하는 모든 페이지에 공통으로 적용되는 최상위 레이아웃입니다.
 * - 상단: Navbar (공유 네비게이션 바)
 * - 하단: children (각 페이지 컴포넌트)
 *
 * [사용]
 * router/index.jsx 에서 ProtectedRoute 안에 감쌉니다.
 *   <AppLayout><DashboardPage /></AppLayout>
 *
 * [디자인]
 * 페이지 배경색(mentor-bg)은 각 페이지의 PageLayout이나 섹션에서 개별 설정합니다.
 * 여기서는 min-h-screen 만 적용해 콘텐츠가 화면을 채우도록 보장합니다.
 */
export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-mentor-bg">
      {/* 상단 고정 네비게이션 바 (sticky top-0) */}
      <Navbar />
      {/* 페이지 본문 영역 */}
      <main>{children}</main>
    </div>
  );
}
