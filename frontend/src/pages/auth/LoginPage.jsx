import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import useAuthStore from '../../store/authStore';

/**
 * 로그인 페이지 (/auth/login)
 *
 * [흐름]
 * 1. 이메일과 비밀번호로 일반 로그인을 처리합니다.
 * 2. 카카오 로그인 버튼을 누르면 카카오 인가 페이지로 이동합니다.
 * 3. 성공 시 대시보드로 이동합니다.
 * 4. 실패 시 사용자에게 바로 이해되는 한글 문구를 보여줍니다.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* 회원가입 완료 후 navigate state로 전달된 성공 메시지 */
  const successMessage = location.state?.message ?? '';

  /**
   * 입력 필드 변경 핸들러입니다.
   * 사용자가 다시 입력을 시작하면 이전 오류 문구는 바로 지웁니다.
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  /**
   * 일반 로그인 제출 핸들러입니다.
   * authStore.login()은 axios 원본으로 직접 호출하므로 api/axios 인터셉터를 거치지 않습니다.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.password) {
      setError('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(form.email, form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.error?.message ??
        err.response?.data?.message ??
        '이메일 또는 비밀번호가 올바르지 않습니다.';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 카카오 로그인 인가 페이지로 이동합니다.
   *
   * [주의]
   * - VITE_KAKAO_CLIENT_ID를 우선 사용하고, 예전 이름인 VITE_KAKAO_JS_KEY도 잠시 호환합니다.
   * - redirect URI도 환경변수 우선으로 두어 로컬/배포 환경을 분리하기 쉽게 유지합니다.
   */
  const handleKakaoLogin = () => {
    const kakaoClientId =
      import.meta.env.VITE_KAKAO_CLIENT_ID ||
      import.meta.env.VITE_KAKAO_JS_KEY;

    const redirectUri =
      import.meta.env.VITE_KAKAO_REDIRECT_URI ||
      `${window.location.origin}/auth/kakao/callback`;

    if (!kakaoClientId) {
      setError('카카오 로그인 설정이 비어 있습니다. 관리자에게 문의해주세요.');
      return;
    }

    // [의도]
    // prompt=login 을 붙여 카카오 세션이 브라우저에 남아 있어도
    // 계정 확인 과정을 다시 거치게 해서 자동 재로그인을 줄입니다.
    window.location.href =
      `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoClientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      '&response_type=code&prompt=login';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-mentor-bg px-4">
      <div className="w-full max-w-md rounded-3xl border border-mentor-border bg-mentor-surface p-8 shadow-[var(--shadow-card)]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mentor-primary text-sm font-black text-white shadow-md shadow-mentor-primary/25">
            AI
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-mentor-text">로그인</h1>
            <p className="mt-1 text-sm text-mentor-muted">
              AI Interview Mentor에 오신 것을 환영합니다
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Input
            id="email"
            name="email"
            type="email"
            label="이메일"
            placeholder="example@email.com"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            autoFocus
          />

          <Input
            id="password"
            name="password"
            type="password"
            label="비밀번호"
            placeholder="비밀번호를 입력하세요"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
          />

          {successMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          {error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-mentor-danger"
              role="alert"
            >
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} fullWidth className="mt-2">
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-mentor-border" />
          <span className="text-xs text-mentor-muted">또는</span>
          <div className="h-px flex-1 bg-mentor-border" />
        </div>

        <button
          type="button"
          onClick={handleKakaoLogin}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-3 text-sm font-semibold text-[#191919] transition hover:bg-[#F5DC00]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#191919">
            <path d="M12 3C6.48 3 2 6.36 2 10.5c0 2.62 1.74 4.93 4.38 6.26l-1.1 4.02c-.08.3.25.54.52.38L10.14 18c.61.09 1.23.13 1.86.13 5.52 0 10-3.36 10-7.5S17.52 3 12 3z" />
          </svg>
          카카오 로그인
        </button>

        <p className="mt-6 text-center text-sm text-mentor-muted">
          계정이 없으신가요?{' '}
          <Link
            to="/auth/register"
            className="font-semibold text-mentor-primary transition-colors hover:text-mentor-primary-dark"
          >
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
