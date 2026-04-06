import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useCartStore from '../store/cartStore';

/**
 * 인증 관련 액션을 제공하는 커스텀 훅
 *
 * authStore의 login·logout 액션을 래핑하여
 * 성공/실패 후 페이지 이동 처리를 담당합니다.
 *
 * 컴포넌트에서 직접 useAuthStore를 사용할 수도 있지만,
 * 이 훅을 통하면 navigate 로직을 컴포넌트 밖으로 분리할 수 있습니다.
 *
 * [반환값]
 *   login(email, password) - 로그인 후 /dashboard 이동
 *   logout()               - 로그아웃 후 /auth/login 이동
 *   user                   - 현재 로그인한 사용자 정보
 *   isLoggedIn             - 로그인 여부 (accessToken 또는 refreshToken 존재)
 */
export default function useAuth() {
  const navigate = useNavigate();
  const setCartActiveUser = useCartStore((state) => state.setActiveUser);
  const { login: storeLogin, logout: storeLogout, user, accessToken, refreshToken } =
    useAuthStore();

  /**
   * 로그인
   * authStore.login()이 API 호출과 토큰 저장을 담당하고,
   * 이 훅은 성공 후 /dashboard로 이동하는 역할만 합니다.
   */
  const login = async (email, password) => {
    await storeLogin(email, password);
    navigate('/dashboard', { replace: true });
  };

  /**
   * 로그아웃
   * authStore.logout()이 API 호출과 상태 초기화를 담당하고,
   * 이 훅은 /auth/login으로 이동합니다.
   */
  const logout = async () => {
    await storeLogout();
    setCartActiveUser('anonymous');
    navigate('/auth/login', { replace: true });
  };

  return {
    login,
    logout,
    user,
    isLoggedIn: !!(accessToken || refreshToken),
  };
}
