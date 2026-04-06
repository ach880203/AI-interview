import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import api from '../../api/axios';

// [의도]
// React StrictMode 개발 모드에서는 같은 화면이 아주 짧게 두 번 마운트될 수 있습니다.
// 카카오 인가 코드는 1회용이므로, 같은 code로 요청이 두 번 나가면 한 번은 성공하고 한 번은 실패합니다.
// 이를 막기 위해 code별 로그인 요청 Promise를 모듈 범위에서 공유합니다.
const pendingKakaoLoginRequests = new Map();

/**
 * 카카오 OAuth 콜백 페이지입니다.
 *
 * [흐름]
 * 1. 카카오가 redirect_uri로 code를 붙여서 이 페이지로 돌아옵니다.
 * 2. 프론트는 /api/auth/kakao 로 code를 전달합니다.
 * 3. 백엔드는 카카오 토큰 교환, 사용자 조회, JWT 발급을 처리합니다.
 * 4. 프론트는 받은 JWT를 저장하고 대시보드로 이동합니다.
 */
export default function KakaoCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setTokens = useAuthStore((state) => state.setTokens);
  const setUser = useAuthStore((state) => state.setUser);
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('카카오 인증 코드가 없습니다.');
      return;
    }

    let isActive = true;

    // [중요]
    // 같은 code 요청이 이미 진행 중이면 새 요청을 만들지 않고,
    // 진행 중인 Promise 결과를 그대로 이어받습니다.
    let loginRequestPromise = pendingKakaoLoginRequests.get(code);

    if (!loginRequestPromise) {
      loginRequestPromise = api.post('/api/auth/kakao', { code }).then((response) => {
        return response.data?.data ?? response.data;
      });

      pendingKakaoLoginRequests.set(code, loginRequestPromise);

      // [주의]
      // 성공/실패와 관계없이 이 code 요청이 끝나면 Map에서 제거해야
      // 다음 로그인 시 새 code로 다시 정상 처리할 수 있습니다.
      loginRequestPromise.finally(() => {
        pendingKakaoLoginRequests.delete(code);
      });
    }

    loginRequestPromise
      .then((data) => {
        if (!isActive) return;

        setTokens(data.accessToken, data.refreshToken);
        setUser(data.user);
        navigate('/dashboard', { replace: true });
      })
      .catch((err) => {
        if (!isActive) return;

        const message =
          err.response?.data?.error?.message ??
          '카카오 로그인에 실패했습니다.';

        setError(message);
      });

    return () => {
      // [의도]
      // 콜백 처리 중에 화면이 사라져도 setState가 남은 화면에 닿지 않게 막습니다.
      isActive = false;
    };
  }, [navigate, searchParams, setTokens, setUser]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mentor-bg px-4">
        <div className="w-full max-w-md rounded-3xl border border-mentor-border bg-mentor-surface p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-lg font-bold text-mentor-danger">로그인 실패</p>
          <p className="mt-3 text-sm text-mentor-muted">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/auth/login', { replace: true })}
            className="mt-5 rounded-full bg-mentor-primary px-6 py-2 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark"
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mentor-bg">
      <div className="text-center">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
        <p className="mt-4 text-sm text-mentor-muted">카카오 로그인 처리 중...</p>
      </div>
    </div>
  );
}
