# 카카오 로그인 무한 대기 및 환경변수 정리 트러블슈팅

## 1. 문제 요약

이번 이슈는 두 가지가 한 번에 겹쳐 있었습니다.

1. 카카오 콜백 화면에서 `카카오 로그인 처리 중...`만 계속 보이고 화면이 넘어가지 않는 문제
2. 프론트와 백엔드의 카카오 관련 환경변수 이름이 실제 용도와 맞지 않아 유지보수가 어려운 문제

---

## 2. 실제 원인

### 2-1. 무한 대기 원인

프론트의 [KakaoCallbackPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/KakaoCallbackPage.jsx) 는
기존에 `sessionStorage`로 `pending / success` 상태를 기록해 중복 호출을 막고 있었습니다.

문제는 개발 모드의 `React StrictMode` 입니다.

- 첫 번째 mount에서 `pending` 저장
- 비동기 요청이 끝나기 전에 cleanup 실행
- 두 번째 mount에서는 `pending`만 보고 바로 return
- 첫 번째 요청 결과는 cleanup 이후라서 화면 상태를 갱신하지 못함

즉 "중복 호출 방지"를 넣었지만, 실제로는 **두 번째 렌더가 진행 중인 요청 결과를 이어받지 못하고 멈추는 구조**였습니다.

### 2-2. 환경변수 혼선 원인

프론트는 로그인 버튼에서 아래 이름을 사용하고 있었습니다.

- `VITE_KAKAO_JS_KEY`

그런데 실제 사용 위치는 카카오 OAuth authorize URL의 `client_id` 였습니다.

즉 이름은 "JavaScript 키"처럼 보이는데, 실제 용도는 "OAuth client_id(REST API 키)"였습니다.
이 구조는 지금 당장은 값이 같아서 동작해도, 나중에 누군가 실제 JavaScript 키를 넣으면 장애가 다시 날 수 있습니다.

백엔드 `.env`도 비슷했습니다.

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`

하지만 [application.yml](/C:/Programmer/Work/AI-interview/backend/ai-interview/src/main/resources/application.yml) 은
실제로 `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`를 읽고 있었습니다.

즉 **설정 파일에 적힌 이름과 실제 코드에서 읽는 이름이 어긋나 있던 상태**였습니다.

---

## 3. 수정 전 코드

### 3-1. 카카오 콜백 중복 방지 로직

파일:

- [KakaoCallbackPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/KakaoCallbackPage.jsx)

```jsx
const storageKey = `${KAKAO_LOGIN_STATUS_KEY_PREFIX}${code}`;
const loginStatus = sessionStorage.getItem(storageKey);

if (loginStatus === 'pending') {
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
    setError('카카오 로그인에 실패했습니다.');
  }
}
```

문제점:

- 두 번째 mount가 첫 번째 요청 결과를 이어받지 못함
- `pending` 상태만 보고 멈출 수 있음

### 3-2. 카카오 로그인 버튼 환경변수

파일:

- [LoginPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/LoginPage.jsx)

```jsx
const kakaoClientId = import.meta.env.VITE_KAKAO_JS_KEY;
const redirectUri = `${window.location.origin}/auth/kakao/callback`;
```

문제점:

- `JS_KEY`라는 이름이 실제 용도와 다름
- redirect URI를 환경변수로 분리하지 않아 배포 환경 전환이 불편함

### 3-3. 백엔드 `.env`

파일:

- [backend/ai-interview/.env](/C:/Programmer/Work/AI-interview/backend/ai-interview/.env)

```env
SPRING_DATASOURCE_URL=...
SPRING_DATASOURCE_USERNAME=...
SPRING_DATASOURCE_PASSWORD=...

JWT_EXPIRATION=86400000
FRONTEND_URL=http://localhost:8080
```

문제점:

- datasource 이름이 `application.yml` 기준과 다름
- JWT 만료 시간도 access / refresh 가 분리되어 있지 않음
- 카카오 redirect URI가 명시되어 있지 않음

---

## 4. 수정 후 코드

### 4-1. 카카오 콜백 요청 공유 방식으로 변경

파일:

- [KakaoCallbackPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/KakaoCallbackPage.jsx)

```jsx
const pendingKakaoLoginRequests = new Map();

useEffect(() => {
  const code = searchParams.get('code');
  if (!code) {
    setError('카카오 인증 코드가 없습니다.');
    return;
  }

  let isActive = true;
  let loginRequestPromise = pendingKakaoLoginRequests.get(code);

  if (!loginRequestPromise) {
    loginRequestPromise = api.post('/api/auth/kakao', { code }).then((response) => {
      return response.data?.data ?? response.data;
    });

    pendingKakaoLoginRequests.set(code, loginRequestPromise);
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
      setError(err.response?.data?.error?.message ?? '카카오 로그인에 실패했습니다.');
    });

  return () => {
    isActive = false;
  };
}, [navigate, searchParams, setTokens, setUser]);
```

개선점:

- 같은 `code` 요청이 이미 진행 중이면 그 Promise를 재사용
- StrictMode의 재마운트에서도 결과를 이어받을 수 있음
- "처리 중에서 멈춤" 현상을 구조적으로 제거

### 4-2. 프론트 카카오 환경변수 이름 정리

파일:

- [LoginPage.jsx](/C:/Programmer/Work/AI-interview/frontend/src/pages/auth/LoginPage.jsx)
- [frontend/.env](/C:/Programmer/Work/AI-interview/frontend/.env)
- [frontend/.env.example](/C:/Programmer/Work/AI-interview/frontend/.env.example)

```jsx
const kakaoClientId =
  import.meta.env.VITE_KAKAO_CLIENT_ID ||
  import.meta.env.VITE_KAKAO_JS_KEY;

const redirectUri =
  import.meta.env.VITE_KAKAO_REDIRECT_URI ||
  `${window.location.origin}/auth/kakao/callback`;
```

```env
VITE_KAKAO_CLIENT_ID=...
VITE_KAKAO_REDIRECT_URI=http://localhost:5173/auth/kakao/callback
```

개선점:

- `VITE_KAKAO_CLIENT_ID`로 의미를 명확히 함
- 기존 `VITE_KAKAO_JS_KEY`도 잠시 호환해 바로 깨지지 않게 유지
- redirect URI도 환경변수로 관리 가능

### 4-3. 백엔드 `.env` 이름 정리

파일:

- [backend/ai-interview/.env](/C:/Programmer/Work/AI-interview/backend/ai-interview/.env)
- [application.yml](/C:/Programmer/Work/AI-interview/backend/ai-interview/src/main/resources/application.yml)

```env
DB_URL=...
DB_USERNAME=...
DB_PASSWORD=...

KAKAO_REDIRECT_URI=http://localhost:5173/auth/kakao/callback

JWT_ACCESS_EXPIRATION=3600000
JWT_REFRESH_EXPIRATION=86400000
```

```yml
url: ${DB_URL:${SPRING_DATASOURCE_URL:...}}
username: ${DB_USERNAME:${SPRING_DATASOURCE_USERNAME:root}}
password: ${DB_PASSWORD:${SPRING_DATASOURCE_PASSWORD:1234}}

access-expiration: ${JWT_ACCESS_EXPIRATION:3600000}
refresh-expiration: ${JWT_REFRESH_EXPIRATION:86400000}
```

개선점:

- `.env` 이름과 실제 사용 이름을 맞춤
- access / refresh 만료 시간을 분리
- 예전 `SPRING_DATASOURCE_*`도 잠시 호환해 기존 실행 환경이 바로 깨지지 않게 유지

---

## 5. 확인 방법

1. 프론트 개발 서버를 다시 실행합니다.
2. 카카오 로그인 버튼을 눌러 콜백 화면으로 돌아옵니다.
3. 이전처럼 `카카오 로그인 처리 중...`에서 멈추지 않고 대시보드로 이동하는지 확인합니다.
4. 브라우저 개발자도구 Network 탭에서 같은 `code`로 `/api/auth/kakao`가 중복 호출되지 않는지 확인합니다.
5. `.env`를 바꿨다면 프론트와 백엔드를 모두 재시작합니다.

---

## 6. 이번 정리의 핵심

- 문제의 본질은 카카오 서버가 아니라 **프론트 콜백 중복 방지 방식**이었습니다.
- 환경변수 장애 위험은 값이 아니라 **이름과 실제 용도의 불일치**에서 시작됐습니다.
- 그래서 이번 수정은
  - 카카오 콜백 처리 구조 개선
  - 프론트/백엔드 환경변수 이름 정리
  - 기존 이름 임시 호환
를 한 번에 묶어 안정성을 높이는 방향으로 진행했습니다.
