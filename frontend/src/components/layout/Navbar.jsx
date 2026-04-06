import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useCartStore from '../../store/cartStore';
import { HEADER_MENU_GROUPS, MY_PAGE_MENU_ITEMS } from '../../data/portalConfig';

/**
 * 상단 네비게이션 바입니다.
 *
 * [역할]
 * 면접, 학습, 도서, 관리자 메뉴를 드롭다운으로 묶고
 * 사용자 이름 클릭 시 마이페이지와 로그아웃 메뉴를 노출합니다.
 *
 * [의도]
 * 메뉴가 페이지 단위로 흩어져 있으면 사용자가 다음 행동을 찾기 어렵습니다.
 * 관련 기능을 묶은 드롭다운 구조로 바꾸면 기능 간 관계를 한눈에 이해하기 쉽습니다.
 */
export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const cartCount = useCartStore((state) => state.cartCount);
  const setCartActiveUser = useCartStore((state) => state.setActiveUser);
  const isAdmin = user?.role === 'ADMIN';

  const [openedMenuKey, setOpenedMenuKey] = useState('');
  const [openedProfileMenu, setOpenedProfileMenu] = useState(false);
  const [openedMobileMenu, setOpenedMobileMenu] = useState(false);
  const menuContainerRef = useRef(null);
  const profileMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);

  /**
   * 현재 경로에 맞는 메뉴 활성 상태를 계산합니다.
   */
  const menuGroups = useMemo(() => {
    return HEADER_MENU_GROUPS.map((group) => ({
      ...group,
      active: group.items.some((item) => location.pathname.startsWith(item.to)),
    }));
  }, [location.pathname]);

  /**
   * 바깥 영역을 클릭하면 드롭다운을 닫습니다.
   */
  useEffect(() => {
    // 로그인 사용자가 바뀌면 장바구니 배지 저장 영역도 같은 기준으로 전환합니다.
    setCartActiveUser(user?.email ?? 'anonymous');
  }, [setCartActiveUser, user?.email]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target)
      ) {
        setOpenedMenuKey('');
      }

      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setOpenedProfileMenu(false);
      }

      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target)
      ) {
        setOpenedMobileMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * 로그아웃 처리입니다.
   */
  async function handleLogout() {
    await logout();
    setCartActiveUser('anonymous');
    navigate('/auth/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-mentor-border bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        {/* 로고 — 뇌/AI SVG 아이콘 + 그라디언트 텍스트 */}
        <Link
          to="/dashboard"
          className="flex items-center gap-2 transition"
        >
          {/* 작은 AI 브레인 아이콘 */}
          <svg
            className="h-7 w-7 text-mentor-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2C8.5 2 6 4.5 6 7.5c0 1.2.4 2.3 1 3.2C5.4 11.5 4 13.1 4 15c0 2.8 2.2 5 5 5h6c2.8 0 5-2.2 5-5 0-1.9-1.4-3.5-3-4.3.6-.9 1-2 1-3.2C18 4.5 15.5 2 12 2z" />
            <path d="M9 12h6M9 15h6M10 9h4" />
          </svg>
          {/* 그라디언트 텍스트 — primary → sky */}
          <span className="hidden bg-gradient-to-r from-mentor-primary to-mentor-sky bg-clip-text text-transparent font-bold text-lg sm:block">
            AI Interview Mentor
          </span>
        </Link>

        <nav ref={menuContainerRef} className="hidden items-center gap-2 lg:flex">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-mentor-accent text-mentor-primary'
                  : 'text-mentor-muted hover:bg-mentor-bg hover:text-mentor-text'
              }`
            }
          >
            대시보드
          </NavLink>

          {menuGroups.map((group) => (
            <div key={group.key} className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenedMenuKey((previous) => (previous === group.key ? '' : group.key))
                }
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  group.active || openedMenuKey === group.key
                    ? 'bg-mentor-accent text-mentor-primary'
                    : 'text-mentor-muted hover:bg-mentor-bg hover:text-mentor-text'
                }`}
              >
                {group.label}
                <span className="text-xs">▾</span>
              </button>

              {openedMenuKey === group.key && (
                <div className="absolute left-0 top-[calc(100%+10px)] w-[320px] rounded-3xl border border-mentor-border bg-white p-3 shadow-[var(--shadow-card)]">
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpenedMenuKey('')}
                        className="block rounded-2xl px-4 py-3 transition hover:bg-mentor-bg"
                      >
                        <p className="text-sm font-semibold text-mentor-text">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-mentor-muted">
                          {item.description}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          <NavLink
            to="/support"
            className={({ isActive }) =>
              `rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-mentor-accent text-mentor-primary'
                  : 'text-mentor-muted hover:bg-mentor-bg hover:text-mentor-text'
              }`
            }
          >
            고객센터
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-mentor-accent text-mentor-primary'
                    : 'text-mentor-muted hover:bg-mentor-bg hover:text-mentor-text'
                }`
              }
            >
              관리자
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div ref={mobileMenuRef} className="relative lg:hidden">
            <button
              type="button"
              onClick={() => setOpenedMobileMenu((previous) => !previous)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-mentor-muted transition hover:bg-mentor-bg hover:text-mentor-text"
              aria-label="모바일 메뉴 열기"
            >
              ☰
            </button>

            {openedMobileMenu && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[320px] rounded-3xl border border-mentor-border bg-white p-3 shadow-[var(--shadow-card)]">
                <div className="space-y-2">
                  <Link
                    to="/dashboard"
                    onClick={() => setOpenedMobileMenu(false)}
                    className="block rounded-2xl px-4 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg"
                  >
                    대시보드
                  </Link>
                  {menuGroups.map((group) => (
                    <div key={`mobile-${group.key}`} className="rounded-2xl bg-mentor-bg px-3 py-3">
                      <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-mentor-muted">
                        {group.label}
                      </p>
                      <div className="mt-2 space-y-1">
                        {group.items.map((item) => (
                          <Link
                            key={`mobile-${item.to}`}
                            to={item.to}
                            onClick={() => setOpenedMobileMenu(false)}
                            className="block rounded-2xl px-3 py-2 text-sm font-semibold text-mentor-text transition hover:bg-white"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Link
                    to="/support"
                    onClick={() => setOpenedMobileMenu(false)}
                    className="block rounded-2xl px-4 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg"
                  >
                    고객센터
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setOpenedMobileMenu(false)}
                      className="block rounded-2xl px-4 py-3 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg"
                    >
                      관리자
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          <Link
            to="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-2xl text-mentor-muted transition hover:bg-mentor-bg hover:text-mentor-text"
            aria-label={`장바구니 ${cartCount}개`}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>

            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-mentor-danger px-1 text-[10px] font-bold text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setOpenedProfileMenu((previous) => !previous)}
              className="flex items-center gap-2 rounded-full bg-mentor-bg px-3 py-2 text-sm font-semibold text-mentor-text transition hover:bg-mentor-accent"
            >
              <span className="max-w-[96px] truncate">{user?.name ?? '내 메뉴'}</span>
              <span className="text-xs text-mentor-muted">▾</span>
            </button>

            {openedProfileMenu && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[260px] rounded-3xl border border-mentor-border bg-white p-3 shadow-[var(--shadow-card)]">
                <div className="border-b border-mentor-border px-3 pb-3">
                  <p className="text-sm font-semibold text-mentor-text">{user?.name ?? '사용자'}</p>
                  <p className="mt-1 text-xs text-mentor-muted">{user?.email ?? '로그인 정보 없음'}</p>
                </div>

                <div className="mt-3 space-y-1">
                  {MY_PAGE_MENU_ITEMS.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpenedProfileMenu(false)}
                      className="block rounded-2xl px-3 py-2 text-sm font-semibold text-mentor-text transition hover:bg-mentor-bg"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div className="mt-3 border-t border-mentor-border pt-3 space-y-2">
                  <Link
                    to="/subscription"
                    onClick={() => setOpenedProfileMenu(false)}
                    className="block rounded-2xl px-3 py-2 text-sm font-semibold text-mentor-primary transition hover:bg-mentor-accent"
                  >
                    구독 관리
                  </Link>
                  {/* 로그아웃 버튼 — mentor-primary 계열로 통일 */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-2xl bg-mentor-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
