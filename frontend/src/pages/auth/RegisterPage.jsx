import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as authApi from '../../api/auth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

/**
 * 회원가입 페이지 (/auth/register)
 *
 * [흐름]
 *   1. 이름·이메일·비밀번호·비밀번호 확인·연락처 입력
 *   2. 가입 버튼 클릭 → 클라이언트 유효성 검사 수행
 *   3. 통과 시 authApi.register() 호출 (POST /api/auth/register)
 *   4. 성공 : /auth/login으로 이동 (성공 메시지 전달)
 *   5. 실패 : 서버 오류 메시지 표시
 *
 * [유효성 검사 규칙]
 *   - 이름      : 필수
 *   - 이메일    : 필수 + 이메일 형식 (@, . 포함)
 *   - 비밀번호  : 필수 + 8자 이상
 *   - 비밀번호 확인 : 비밀번호와 동일해야 함
 *   - 연락처    : 선택 (입력 시 숫자·하이픈만 허용)
 *
 * [상태]
 *   form       - 입력값 객체 { name, email, password, passwordConfirm, phone }
 *   fieldErrors - 필드별 인라인 오류 객체 (Input 컴포넌트 error prop으로 전달)
 *   serverError - API 응답 오류 (폼 하단 에러 박스에 표시)
 *   loading    - API 호출 중 여부
 */
export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    phone: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * 입력 필드 변경 핸들러
   * name 속성으로 form 객체의 해당 키를 동적으로 업데이트하고,
   * 수정된 필드의 인라인 오류 메시지를 즉시 제거합니다.
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // 해당 필드 오류만 제거 (다른 필드 오류는 유지)
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (serverError) setServerError('');
  };

  /**
   * 클라이언트 유효성 검사
   * 각 필드의 규칙을 순서대로 검증하여 오류 맵을 반환합니다.
   * @returns {{ [fieldName]: string }} 오류가 없으면 빈 객체 반환
   */
  const validate = () => {
    const errors = {};

    if (!form.name.trim()) {
      errors.name = '이름을 입력해주세요.';
    }

    if (!form.email) {
      errors.email = '이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      // 이메일 형식 정규식: @ 앞뒤 문자 존재 + 도메인에 . 포함
      errors.email = '올바른 이메일 형식이 아닙니다.';
    }

    if (!form.password) {
      errors.password = '비밀번호를 입력해주세요.';
    } else if (form.password.length < 8) {
      errors.password = '비밀번호는 8자 이상이어야 합니다.';
    }

    if (!form.passwordConfirm) {
      errors.passwordConfirm = '비밀번호 확인을 입력해주세요.';
    } else if (form.password !== form.passwordConfirm) {
      errors.passwordConfirm = '비밀번호가 일치하지 않습니다.';
    }

    // 연락처는 선택 항목 — 입력된 경우에만 형식 검사
    if (form.phone && !/^[\d-]+$/.test(form.phone)) {
      errors.phone = '숫자와 하이픈(-)만 입력 가능합니다.';
    }

    return errors;
  };

  /**
   * 폼 제출 핸들러
   * 유효성 검사 → API 호출 → 성공 시 로그인 페이지 이동
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1단계: 클라이언트 유효성 검사
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setServerError('');

    try {
      // passwordConfirm은 서버에 전송하지 않음 (클라이언트 전용 필드)
      const { passwordConfirm: _, ...payload } = form;
      await authApi.register(payload);

      // 성공 시 로그인 페이지로 이동 (state로 성공 메시지 전달)
      navigate('/auth/login', {
        replace: true,
        state: { message: '회원가입이 완료되었습니다. 로그인해주세요.' },
      });
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ??
        err.response?.data?.message ??
        '회원가입 중 오류가 발생했습니다. 다시 시도해주세요.';
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    /* 전체 화면 중앙 정렬 — mentor-bg 배경 */
    <div className="flex min-h-screen items-center justify-center bg-mentor-bg px-4 py-8">

      {/* 회원가입 카드 — 순백 배경 + 연한 테두리 + 아주 연한 그림자 */}
      <div className="w-full max-w-md rounded-3xl border border-mentor-border bg-mentor-surface p-8 shadow-[var(--shadow-card)]">

        {/* 로고 + 헤더 */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mentor-primary text-sm font-black text-white shadow-md shadow-mentor-primary/25">
            AI
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-mentor-text">회원가입</h1>
            <p className="mt-1 text-sm text-mentor-muted">
              AI Interview Mentor 계정을 만들어보세요
            </p>
          </div>
        </div>

        {/* 회원가입 폼 */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

          {/* 이름 */}
          <Input
            id="name"
            name="name"
            type="text"
            label="이름"
            placeholder="홍길동"
            value={form.name}
            onChange={handleChange}
            error={fieldErrors.name}
            autoComplete="name"
            autoFocus
          />

          {/* 이메일 */}
          <Input
            id="email"
            name="email"
            type="email"
            label="이메일"
            placeholder="example@email.com"
            value={form.email}
            onChange={handleChange}
            error={fieldErrors.email}
            autoComplete="email"
          />

          {/* 비밀번호 */}
          <Input
            id="password"
            name="password"
            type="password"
            label="비밀번호"
            placeholder="8자 이상 입력하세요"
            value={form.password}
            onChange={handleChange}
            error={fieldErrors.password}
            autoComplete="new-password"
          />

          {/* 비밀번호 확인 */}
          <Input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            label="비밀번호 확인"
            placeholder="비밀번호를 다시 입력하세요"
            value={form.passwordConfirm}
            onChange={handleChange}
            error={fieldErrors.passwordConfirm}
            autoComplete="new-password"
          />

          {/* 연락처 (선택) */}
          <Input
            id="phone"
            name="phone"
            type="tel"
            label="연락처 (선택)"
            placeholder="010-0000-0000"
            value={form.phone}
            onChange={handleChange}
            error={fieldErrors.phone}
            autoComplete="tel"
          />

          {/* 서버 오류 메시지 박스 */}
          {serverError && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-mentor-danger border border-red-200" role="alert">
              {serverError}
            </div>
          )}

          <Button type="submit" loading={loading} fullWidth className="mt-2">
            {loading ? '가입 중...' : '회원가입'}
          </Button>
        </form>

        {/* 로그인 링크 */}
        <p className="mt-6 text-center text-sm text-mentor-muted">
          이미 계정이 있으신가요?{' '}
          <Link
            to="/auth/login"
            className="font-semibold text-mentor-primary hover:text-mentor-primary-dark transition-colors"
          >
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
