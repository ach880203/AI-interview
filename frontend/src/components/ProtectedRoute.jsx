import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

/**
 * 인증/권한 보호 라우트 래퍼
 *
 * - 비로그인 상태(accessToken·refreshToken 모두 없음) → /auth/login 리다이렉트
 * - requireAdmin=true인데 ADMIN 권한 없음 → /dashboard 리다이렉트
 */
function AuthPreparingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mentor-bg px-4">
      <div className="w-full max-w-md rounded-3xl border border-mentor-border bg-mentor-surface p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mentor-accent">
          <span className="h-6 w-6 animate-spin rounded-full border-4 border-mentor-border border-t-mentor-primary" />
        </div>
        <h1 className="mt-5 text-lg font-bold text-mentor-text">로그인 상태를 확인하고 있습니다.</h1>
        <p className="mt-2 text-sm leading-6 text-mentor-muted">
          새로고침 직후에는 접근 토큰을 먼저 복구한 뒤 화면을 안전하게 보여줍니다.
        </p>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { accessToken, refreshToken, user, restoreAccessToken } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  const [isPreparingAuth, setIsPreparingAuth] = useState(false);
  const shouldPrepareAuth = isHydrated && !accessToken && !!refreshToken;

  useEffect(() => {
    const unsubscribeHydrate = useAuthStore.persist.onHydrate(() => {
      setIsHydrated(false);
    });
    const unsubscribeFinishHydration = useAuthStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    setIsHydrated(useAuthStore.persist.hasHydrated());

    return () => {
      unsubscribeHydrate();
      unsubscribeFinishHydration();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function prepareAuth() {
      if (!isHydrated) return;

      if (!shouldPrepareAuth) {
        if (isMounted) {
          setIsPreparingAuth(false);
        }
        return;
      }

      if (isMounted) {
        setIsPreparingAuth(true);
      }

      try {
        await restoreAccessToken();
      } catch {
        // restoreAccessToken 내부에서 인증 상태를 정리하므로 여기서는 화면 전환만 기다립니다.
      } finally {
        if (isMounted) {
          setIsPreparingAuth(false);
        }
      }
    }

    prepareAuth();

    return () => {
      isMounted = false;
    };
  }, [restoreAccessToken, shouldPrepareAuth]);

  if (!isHydrated || isPreparingAuth || shouldPrepareAuth) {
    return <AuthPreparingScreen />;
  }

  if (!accessToken && !refreshToken) {
    return <Navigate to="/auth/login" replace />;
  }

  if (requireAdmin && user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
