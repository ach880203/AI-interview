# 카카오 로그인 트러블슈팅

## 1. 문서 목적

이 문서는 2026-04-03 기준 카카오 로그인에서 확인된 아래 두 문제를 정리한 기록입니다.

- 카카오 로그인이 실제로는 성공했는데 화면에 `로그인 실패` 문구가 뜨는 문제
- 로그아웃 후 다시 카카오 로그인을 누르면 같은 카카오 계정으로 자동 로그인되는 문제

이 문서는 원인, 수정 전/후 코드, 왜 이렇게 바꿨는지, 확인 방법을 함께 남기는 목적입니다.

---

## 2. 증상 정리

## 2-1. 증상 1: 실패 문구가 뜨는데 실제로는 로그인됨

사용자가 카카오 로그인 버튼을 누르면:

1. 잠깐 `로그인 실패` 문구가 뜸
2. 그런데 실제로는 대시보드에 들어가 있거나 로그인 상태가 잡혀 있음

즉 "실패한 것처럼 보이지만 실제로는 성공한 상태"가 섞여 있었습니다.

## 2-2. 증상 2: 로그아웃 후에도 같은 카카오 계정으로 자동 로그인됨

사용자가 서비스에서 로그아웃한 뒤 다시 카카오 로그인 버튼을 누르면:

- 카카오 계정 선택 화면 없이
- 직전에 쓰던 같은 카카오 계정으로 바로 로그인됨

즉 서비스 로그아웃은 됐지만 카카오 인증 세션은 그대로 남아 있었습니다.

---

## 3. 실제 원인

## 3-1. 원인 1: 카카오 콜백 처리 `useEffect`가 개발 모드에서 중복 실행될 수 있었다

수정 대상 파일:

- [KakaoCallbackPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/KakaoCallbackPage.jsx)
- [main.jsx](/C:/Programmer/Work/AI-interview/frontend/src/main.jsx)

앱은 [main.jsx](/C:/Programmer/Work/AI-interview/frontend/src/main.jsx) 에서 `StrictMode`로 감싸져 있습니다.

```jsx
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
)
```

이 상태에서 [KakaoCallbackPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/KakaoCallbackPage.jsx)의 `useEffect`가
개발 모드에서 두 번 실행될 수 있습니다.

카카오 인가 코드는 **1회용**입니다.
즉 같은 `code`로 두 번 `/api/auth/kakao`를 호출하면:

1. 첫 번째 호출은 성공
2. 두 번째 호출은 같은 코드 재사용이라 실패

그래서 실제 로그인은 이미 됐는데, 두 번째 실패가 화면에 `로그인 실패`로 나타날 수 있었습니다.

---

## 3-2. 원인 2: 서비스 로그아웃과 카카오 로그인 세션 로그아웃은 다른 문제였다

수정 대상 파일:

- [authStore.js](/C:/Programmer/Work/AI-interview/frontend/src/store/authStore.js)
- [useAuth.js](/C:/Programmer/Work/AI-interview/frontend/src/hooks/useAuth.js)
- [LoginPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/LoginPage.jsx)

기존 로그아웃은 아래만 처리했습니다.

- 우리 서비스의 accessToken 삭제
- 우리 서비스의 refreshToken 삭제
- 백엔드 `/api/auth/logout` 호출

하지만 카카오 브라우저 세션은 그대로 남아 있었습니다.

즉 사용자가 서비스에서는 로그아웃했더라도,
브라우저 안의 카카오 인증 세션은 유지되므로
다시 로그인 버튼을 누르면 같은 카카오 계정으로 새 인가 코드가 바로 발급될 수 있었습니다.

이건 "로그아웃이 안 됐다"기보다,
**우리 서비스 로그아웃과 카카오 로그아웃이 별개**였던 것입니다.

---

## 4. 수정 전 코드

## 4-1. 카카오 콜백 페이지 수정 전

파일:

- [KakaoCallbackPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/KakaoCallbackPage.jsx)

```jsx
useEffect(() => {
  const code = searchParams.get('code');
  if (!code) {
    setError('카카오 인증 코드가 없습니다.');
    return;
  }

  async function handleKakaoLogin() {
    try {
      const response = await api.post('/api/auth/kakao', { code });
      const data = response.data?.data ?? response.data;

      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ??
        '카카오 로그인에 실패했습니다.';
      setError(msg);
    }
  }

  handleKakaoLogin();
}, [searchParams, navigate, setTokens, setUser]);
```

문제점:

- 같은 `code`에 대한 중복 실행 방지가 없음
- 첫 성공 후 두 번째 실패가 화면 에러로 남을 수 있음

## 4-2. 카카오 로그인 버튼 수정 전

파일:

- [LoginPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/LoginPage.jsx)

```jsx
window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
```

문제점:

- 카카오 세션이 남아 있으면 같은 계정으로 바로 재로그인될 수 있음
- 계정 선택 또는 재인증을 강제하지 않음

---

## 5. 수정 후 코드

## 5-1. 카카오 콜백 페이지 수정 후

파일:

- [KakaoCallbackPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/KakaoCallbackPage.jsx)

```jsx
const KAKAO_LOGIN_STATUS_KEY_PREFIX = 'kakao-login-status:';

useEffect(() => {
  const code = searchParams.get('code');
  if (!code) {
    setError('카카오 인증 코드가 없습니다.');
    return;
  }

  const storageKey = `${KAKAO_LOGIN_STATUS_KEY_PREFIX}${code}`;
  const loginStatus = sessionStorage.getItem(storageKey);

  if (loginStatus === 'pending') {
    return;
  }

  if (loginStatus === 'success') {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
    return;
  }

  sessionStorage.setItem(storageKey, 'pending');
  let isCancelled = false;

  async function handleKakaoLogin() {
    try {
      const response = await api.post('/api/auth/kakao', { code });
      const data = response.data?.data ?? response.data;

      if (isCancelled) return;

      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      sessionStorage.setItem(storageKey, 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (isCancelled) return;

      sessionStorage.removeItem(storageKey);
      const msg =
        err.response?.data?.error?.message ??
        '카카오 로그인에 실패했습니다.';
      setError(msg);
    }
  }

  handleKakaoLogin();

  return () => {
    isCancelled = true;
  };
}, [searchParams, navigate, setTokens, setUser, user]);
```

### 왜 이렇게 바꿨는가

- `sessionStorage`에 현재 `code` 처리 상태를 기록
- 같은 `code`가 다시 들어오면 중복 요청을 막음
- 성공 후에는 상태를 `success`로 기록
- 실패 시에는 `pending` 기록을 지워 재시도 가능하게 함
- 언마운트 후 뒤늦게 응답이 와도 잘못된 상태 변경을 하지 않도록 `isCancelled`도 추가

즉 **카카오 1회용 인가 코드가 중복 소비되지 않게 막는 구조**입니다.

---

## 5-2. 카카오 로그인 버튼 수정 후

파일:

- [LoginPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/LoginPage.jsx)

```jsx
window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&prompt=login`;
```

### 왜 이렇게 바꿨는가

- `prompt=login`을 추가해서 카카오 쪽 로그인 화면을 다시 보여주도록 유도
- 브라우저에 카카오 세션이 남아 있어도 사용자가 계정을 다시 확인할 수 있음
- 같은 계정 자동 재로그인 문제를 줄임

즉 서비스 로그아웃 뒤 다시 카카오 로그인할 때
**카카오 인증 세션을 무조건 조용히 재사용하지 않게 만드는 방향**입니다.

---

## 6. 기대 동작

## 6-1. 수정 후 카카오 콜백 동작

1. 첫 번째 콜백 처리만 실제 로그인 요청 실행
2. 같은 code의 중복 요청은 무시
3. 성공했는데 실패 문구가 뜨는 현상 제거

## 6-2. 수정 후 로그인 버튼 동작

1. 로그아웃 후 다시 카카오 로그인 버튼 클릭
2. 카카오 로그인 화면이 다시 뜨거나 계정 확인 과정이 노출됨
3. 이전 계정으로 무조건 자동 진입되는 현상 완화

---

## 7. 확인 방법

1. 개발 환경에서 카카오 로그인 시도
   - 이전처럼 성공 후 `로그인 실패` 문구가 다시 뜨지 않는지 확인

2. 브라우저 개발자도구 Network 탭 확인
   - `/api/auth/kakao`가 같은 `code`로 중복 호출되지 않는지 확인

3. 로그아웃 후 다시 카카오 로그인 시도
   - 이전처럼 같은 카카오 계정으로 바로 들어가는 대신
   - 카카오 로그인 화면 또는 계정 확인 흐름이 다시 보이는지 확인

---

## 8. 주의 사항

1. 이 수정은 **우리 프론트 기준 안전장치**입니다.
2. 브라우저/카카오 정책에 따라 카카오 세션이 완전히 제거되는 것은 아닙니다.
3. 하지만 `prompt=login`을 붙이면 재로그인 강제 효과가 생겨,
   "같은 계정 자동 진입" 문제를 운영상 크게 줄일 수 있습니다.

---

## 9. 수정 파일 요약

- [KakaoCallbackPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/KakaoCallbackPage.jsx)
- [LoginPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/LoginPage.jsx)

필요하면 다음 단계로 `카카오 로그인 Network 재현 캡처 기준 체크리스트`까지 이어서 문서에 추가할 수 있습니다.
