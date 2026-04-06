# 대시보드 인증 부트스트랩 트러블슈팅 + 위젯 확장 계획

> 이 문서는 대시보드 진입 시 발생하던 다수의 인증 오류를 실제로 재현하고, 원인을 분해해서 수정한 과정과 결과를 포트폴리오 용도로 정리한 문서다.
> 함께 진행한 추가 기획으로, AWS 콘솔처럼 배치 가능한 대시보드 위젯을 "숨기기 / 다시 추가하기"로 확장하는 계획도 포함했다.

---

## 1. 문제 한 줄 요약

대시보드 오류 13개처럼 보이던 현상은 서로 다른 버그 13개가 아니라, **인증이 준비되기 전에 보호 API를 먼저 호출해서 발생한 중복 401 오류 묶음**이 핵심이었다.

---

## 2. 육하원칙 정리

| 구분 | 내용 |
|------|------|
| **누가(Who)** | 로그인한 일반 사용자, 특히 새로고침 직후 대시보드에 들어오는 사용자 |
| **언제(When)** | 로그인 후 새로고침하거나, 브라우저를 다시 열어 `refreshToken`만 남아 있는 상태에서 `/dashboard`에 진입할 때 |
| **어디서(Where)** | 프론트엔드 `ProtectedRoute`, `authStore`, `DashboardPage`와 백엔드 면접 세션 목록/피드백 조회 흐름 |
| **무엇을(What)** | 대시보드 진입 시 네트워크 탭에 401 오류가 한 번이 아니라 여러 번 쌓이고, 조건에 따라 피드백 404까지 추가로 보이던 문제 |
| **왜(Why)** | `accessToken`은 메모리에만 있고 `refreshToken`만 저장되는데, 보호 라우트가 `refreshToken`만 있어도 화면 렌더링을 허용했고, 대시보드가 진입 즉시 보호 API를 병렬 호출했기 때문 |
| **어떻게(How)** | 인증 복구를 렌더링 전에 끝내는 `인증 부트스트랩`을 추가하고, 대시보드 비동기 요청 정리와 `feedbackReady` 필드를 도입해 불필요한 404까지 막았다 |

---

## 3. 실제 증상

### 3-1. 사용자가 본 현상

- 대시보드에 들어가면 빨간 오류가 13개 정도 찍힌다.
- 화면은 결국 보이기도 하지만, 개발자도구 네트워크 탭은 실패가 가득하다.
- 일부 계정에서는 최근 면접 결과 위젯이 비어 있거나 404가 추가로 보인다.

### 3-2. 실제 재현 결과

HAR 기준으로 최초 재현 시 다음 패턴이 확인됐다.

- `401 Unauthorized` 12건
- 보호 API 6종이 각각 2번씩 실패
- 이후 `POST /api/auth/refresh` 1회 성공
- 같은 요청들이 다시 200으로 재시도

실패한 API는 아래 6개였다.

1. `GET /api/resumes`
2. `GET /api/cover-letters`
3. `GET /api/job-postings`
4. `GET /api/interviews/sessions`
5. `GET /api/learning/stats`
6. `GET /api/learning/analytics`

여기에 계정 상태에 따라 `GET /api/interviews/sessions/{id}/feedback` 404가 1건 더 붙을 수 있어서, 사용자는 체감상 "오류가 13개쯤"으로 느끼게 된다.

---

## 4. 원인 분석

## 4-1. 1차 원인: 인증 저장 구조와 라우트 진입 조건이 어긋남

현재 인증 구조는 보안상 `accessToken`을 메모리에만 두고, `refreshToken`과 `user`만 `localStorage`에 저장한다.
이 설계 자체는 괜찮다. 문제는 **보호 라우트가 `accessToken`이 없어도 `refreshToken`만 있으면 페이지 렌더링을 허용했다는 점**이다.

즉, 새로고침 직후의 실제 순서는 아래와 같았다.

1. 브라우저 복원: `refreshToken`만 있음
2. 보호 라우트 통과: "로그인 상태"라고 판단
3. 대시보드 마운트
4. 대시보드가 보호 API 6개를 즉시 호출
5. 아직 `Authorization` 헤더가 없어서 401 연속 발생
6. 뒤늦게 refresh로 토큰 복구
7. 요청 재시도

정리하면, **입장은 먼저 시키고 인증은 나중에 복구하는 순서가 문제**였다.

## 4-2. 2차 원인: React StrictMode가 개발 환경에서 중복 호출을 확대

대시보드 데이터 로딩은 `useEffect(..., [])`에서 실행되고 있었다.
React 개발 모드의 `StrictMode`에서는 mount / unmount / remount가 한 번 더 일어날 수 있어서, 같은 로딩 effect가 두 번 실행됐다.

그 결과 실제 보호 API 호출 수는 다음처럼 불어났다.

`보호 API 6개 x 2회 = 12개의 401`

즉, "오류가 유난히 많은" 이유는 근본적으로 한 번의 인증 설계 문제가 **개발 모드 중복 호출과 결합되었기 때문**이다.

## 4-3. 3차 원인: 완료 세션과 피드백 생성 완료 시점이 같다고 가정함

대시보드는 완료된 면접 세션이 하나라도 있으면, 가장 최근 완료 세션의 피드백을 바로 조회했다.
하지만 실제 데이터에서는 `COMPLETED` 상태가 먼저 저장되고, 피드백 레코드가 아직 없거나 누락된 케이스가 있을 수 있다.

이 경우 다음 문제가 생긴다.

1. 세션 목록은 정상 조회
2. "완료된 세션이 있으니 피드백도 있겠지"라고 가정
3. `feedback` 조회
4. 404 발생

즉, **"완료됨"과 "피드백 조회 가능"은 같은 의미가 아니었다.**

---

## 5. 수정 전략

이번 수정은 화면을 억지로 덜 실패하게 만드는 수준이 아니라, **인증 준비 순서 자체를 바로잡는 것**에 초점을 맞췄다.

1. 보호 라우트에서 인증 복구가 끝나기 전에는 자식 페이지를 렌더링하지 않는다.
2. `refreshToken`으로 `accessToken`을 복구하는 동작을 공용 Promise로 묶어 중복 실행을 막는다.
3. 대시보드 비동기 요청은 정리(cleanup) 이후 상태를 덮지 못하게 막는다.
4. 세션 목록 응답에 `feedbackReady`를 추가해서, 피드백이 없는 완료 세션에 대해 불필요한 404를 만들지 않는다.

---

## 6. 수정 전 / 수정 후 코드

### 6-1. `ProtectedRoute.jsx`

#### 수정 전

```jsx
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { accessToken, refreshToken, user } = useAuthStore();

  if (!accessToken && !refreshToken) {
    return <Navigate to="/auth/login" replace />;
  }

  if (requireAdmin && user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
```

#### 수정 후

```jsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

function AuthPreparingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mentor-bg px-4">
      <div className="w-full max-w-md rounded-3xl border border-mentor-border bg-mentor-surface p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mentor-accent">
          <span className="h-6 w-6 animate-spin rounded-full border-4 border-mentor-border border-t-mentor-primary" />
        </div>
        <h1 className="mt-5 text-lg font-bold text-mentor-text">로그인 상태를 확인하고 있습니다.</h1>
        <p className="mt-2 text-sm leading-6 text-mentor-muted">
          새로고침 직후에는 접근 토큰을 먼저 복구한 뒤에 화면을 안전하게 보여줍니다.
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
    const unsubscribeHydrate = useAuthStore.persist.onHydrate(() => setIsHydrated(false));
    const unsubscribeFinishHydration = useAuthStore.persist.onFinishHydration(() => setIsHydrated(true));

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
        if (isMounted) setIsPreparingAuth(false);
        return;
      }

      if (isMounted) setIsPreparingAuth(true);

      try {
        await restoreAccessToken();
      } finally {
        if (isMounted) setIsPreparingAuth(false);
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
```

#### 핵심 차이

- 수정 전: `refreshToken`만 있어도 바로 자식 페이지 렌더링
- 수정 후: `accessToken` 복구가 끝날 때까지 로딩 화면 유지

---

### 6-2. `authStore.js`

#### 수정 전

```jsx
const BASE_URL = 'http://localhost:8080';

const useAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) throw new Error('리프레시 토큰이 없습니다.');

        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;
        set({ accessToken: newAccessToken, refreshToken: newRefreshToken });
        return newAccessToken;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);
```

#### 수정 후

```jsx
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/**
 * 새로고침 직후 여러 보호 페이지가 동시에 인증 복구를 시도하지 않도록
 * 현재 진행 중인 복구 Promise를 모듈 범위에서 공유합니다.
 */
let accessTokenRestorePromise = null;

const useAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      restoreAccessToken: async () => {
        const { accessToken, refreshToken, clearAuth } = get();

        if (accessToken) return accessToken;
        if (!refreshToken) return null;

        if (!accessTokenRestorePromise) {
          accessTokenRestorePromise = axios
            .post(`${BASE_URL}/api/auth/refresh`, { refreshToken })
            .then(({ data }) => {
              const newAccessToken = data.data.accessToken;
              const newRefreshToken = data.data.refreshToken;

              set({
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
              });

              return newAccessToken;
            })
            .catch((error) => {
              clearAuth();
              throw error;
            })
            .finally(() => {
              accessTokenRestorePromise = null;
            });
        }

        return accessTokenRestorePromise;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);
```

#### 핵심 차이

- 수정 전: 복구 API는 존재했지만 "페이지 렌더링 전에 복구"라는 개념이 없음
- 수정 후: `restoreAccessToken()`을 별도 두고, 중복 복구도 Promise 공유로 막음
- 추가 개선: 인증 API 기본 주소를 환경변수 기반으로 통일

---

### 6-3. `DashboardPage.jsx`

#### 수정 전

```jsx
useEffect(() => {
  async function fetchDashboardData() {
    const [
      resumeResult,
      coverLetterResult,
      jobPostingResult,
      sessionResult,
      learningStatsResult,
      analyticsResult,
    ] = await Promise.allSettled([
      profileApi.getResumes(),
      profileApi.getCoverLetters(),
      profileApi.getJobPostings(),
      interviewApi.getSessions(),
      learningApi.getStats(),
      learningApi.getAnalytics(),
    ]);

    const nextData = { ... };
    setDashboardData(nextData);

    const latestCompleted = nextData.sessions.find(
      (session) => session.status === 'COMPLETED'
    );

    if (latestCompleted) {
      const feedbackResult = await interviewApi.getFeedback(latestCompleted.id);
      setRecentFeedback({ ...feedbackResult.data.data, sessionId: latestCompleted.id });
    }

    setLoading(false);
  }

  fetchDashboardData();
}, []);
```

#### 수정 후

```jsx
useEffect(() => {
  let shouldIgnore = false;

  async function fetchDashboardData() {
    setLoading(true);
    setError('');

    const [
      resumeResult,
      coverLetterResult,
      jobPostingResult,
      sessionResult,
      learningStatsResult,
      analyticsResult,
    ] = await Promise.allSettled([
      profileApi.getResumes(),
      profileApi.getCoverLetters(),
      profileApi.getJobPostings(),
      interviewApi.getSessions(),
      learningApi.getStats(),
      learningApi.getAnalytics(),
    ]);

    const nextData = { ... };

    if (shouldIgnore) return;
    setDashboardData(nextData);

    /**
     * 목록 응답에 feedbackReady를 함께 내려받아
     * 피드백이 아직 저장되지 않은 COMPLETED 세션으로 404를 만들지 않도록 막습니다.
     */
    const latestCompleted = nextData.sessions.find(
      (session) => session.status === 'COMPLETED' && session.feedbackReady
    );

    if (latestCompleted) {
      try {
        const feedbackResult = await interviewApi.getFeedback(latestCompleted.id);
        if (shouldIgnore) return;
        setRecentFeedback({ ...feedbackResult.data.data, sessionId: latestCompleted.id });
      } catch {
        if (shouldIgnore) return;
        setRecentFeedback(null);
      }
    } else {
      setRecentFeedback(null);
    }

    if (shouldIgnore) return;
    setLoading(false);
  }

  fetchDashboardData();

  return () => {
    /**
     * StrictMode 개발 환경에서는 mount / unmount가 한 번 더 일어날 수 있습니다.
     * 정리 중인 요청의 응답이 늦게 도착해 현재 화면 상태를 덮어쓰지 않도록 막습니다.
     */
    shouldIgnore = true;
  };
}, []);
```

#### 핵심 차이

- 수정 전: 완료 세션이면 무조건 피드백 조회
- 수정 후: `feedbackReady`가 있는 경우에만 피드백 조회
- 수정 전: 정리된 요청도 늦게 상태를 덮을 수 있음
- 수정 후: cleanup 이후 응답은 무시

---

### 6-4. 백엔드 `SessionSummaryResponseDto` / `InterviewService`

#### 수정 전

```java
public record SessionSummaryResponseDto(
        Long id,
        InterviewSessionEntity.SessionStatus status,
        Long resumeId,
        Long coverLetterId,
        Long jobPostingId,
        LocalDateTime startedAt,
        LocalDateTime endedAt,
        LocalDateTime createdAt,
        Integer plannedQuestionCount,
        Integer answeredQuestionCount,
        Boolean partialCompleted
) {
    public static SessionSummaryResponseDto from(InterviewSessionEntity session) {
        return new SessionSummaryResponseDto(
                session.getId(),
                session.getStatus(),
                session.getResumeId(),
                session.getCoverLetterId(),
                session.getJobPostingId(),
                session.getStartedAt(),
                session.getEndedAt(),
                session.getCreatedAt(),
                session.getPlannedQuestionCount(),
                session.getAnsweredQuestionCount(),
                session.isPartialCompleted()
        );
    }
}
```

```java
public List<SessionSummaryResponseDto> getSessions(String email) {
    UserEntity user = getUser(email);
    return interviewRepository.findByUserIdOrderByStartedAtDesc(user.getId())
            .stream()
            .map(SessionSummaryResponseDto::from)
            .toList();
}
```

#### 수정 후

```java
public record SessionSummaryResponseDto(
        Long id,
        InterviewSessionEntity.SessionStatus status,
        Long resumeId,
        Long coverLetterId,
        Long jobPostingId,
        LocalDateTime startedAt,
        LocalDateTime endedAt,
        LocalDateTime createdAt,
        Integer plannedQuestionCount,
        Integer answeredQuestionCount,
        Boolean partialCompleted,
        Boolean feedbackReady
) {
    public static SessionSummaryResponseDto from(InterviewSessionEntity session, boolean feedbackReady) {
        return new SessionSummaryResponseDto(
                session.getId(),
                session.getStatus(),
                session.getResumeId(),
                session.getCoverLetterId(),
                session.getJobPostingId(),
                session.getStartedAt(),
                session.getEndedAt(),
                session.getCreatedAt(),
                session.getPlannedQuestionCount(),
                session.getAnsweredQuestionCount(),
                session.isPartialCompleted(),
                feedbackReady
        );
    }
}
```

```java
public List<SessionSummaryResponseDto> getSessions(String email) {
    UserEntity user = getUser(email);

    List<InterviewSessionEntity> sessions = interviewRepository.findByUserIdOrderByStartedAtDesc(user.getId());
    List<Long> completedSessionIds = sessions.stream()
            .filter(session -> session.getStatus() == InterviewSessionEntity.SessionStatus.COMPLETED)
            .map(InterviewSessionEntity::getId)
            .toList();

    Set<Long> feedbackReadySessionIds = completedSessionIds.isEmpty()
            ? Set.of()
            : new HashSet<>(feedbackRepository.findExistingSessionIds(completedSessionIds));

    return sessions.stream()
            .map(session -> SessionSummaryResponseDto.from(
                    session,
                    feedbackReadySessionIds.contains(session.getId())))
            .toList();
}
```

#### 핵심 차이

- 수정 전: 프론트가 "완료 세션이면 피드백 있음"이라고 추측
- 수정 후: 백엔드가 "피드백 조회 가능 여부"를 명시적으로 내려줌

---

## 7. 수정한 파일

- `frontend/src/store/authStore.js`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/pages/DashboardPage.jsx`
- `backend/ai-interview/src/main/java/com/aimentor/domain/interview/InterviewFeedbackRepository.java`
- `backend/ai-interview/src/main/java/com/aimentor/domain/interview/InterviewService.java`
- `backend/ai-interview/src/main/java/com/aimentor/domain/interview/dto/SessionSummaryResponseDto.java`

---

## 8. 검증 결과

### 8-1. 수정 전

- HAR 기준 `401`이 12건 발생
- 필요 시 `feedback 404` 1건 추가
- 사용자는 "오류가 13개 정도"로 체감

### 8-2. 수정 후

- 최신 소스를 `18081` 포트로 별도 기동해 검증
- `GET /api/interviews/sessions`는 최신 소스 기준 `200` 확인
- 프론트엔드 `npm run build` 성공
- 백엔드 `./gradlew.bat compileJava` 성공

### 8-3. 해석 주의

기존 `8080`에서 떠 있던 오래된 프로세스는 한때 `/api/interviews/sessions`에서 500을 반환했지만,
현재 소스를 별도 포트에서 띄운 결과 같은 API가 200으로 내려왔기 때문에 이는 **최신 수정본 자체의 문제라기보다, 기존 프로세스 상태 또는 오래된 코드 실행본의 영향**으로 판단했다.

---

## 9. 포트폴리오에서 강조할 포인트

### 9-1. 단순 401 대응이 아니라 "순서 문제"를 해결했다

이번 이슈는 백엔드 권한 설정이 틀린 문제가 아니었다.
오히려 백엔드는 정상적으로 보호하고 있었고, 프론트가 **인증이 준비되기 전에 데이터를 먼저 요청하는 순서 설계**가 잘못되어 있었다.

즉, "오류 메시지를 숨긴 것"이 아니라 **렌더링 순서와 인증 복구 순서를 재설계한 작업**이라고 설명하는 것이 좋다.

### 9-2. 프론트만 고친 것이 아니라 API 계약도 함께 정리했다

`feedbackReady`는 중요한 포인트다.
이 값이 없으면 프론트는 완료 세션만 보고 피드백 존재 여부를 추측할 수밖에 없다.
이번 수정은 프론트의 예외 처리만 추가한 것이 아니라, **백엔드가 프론트에 더 정확한 상태를 전달하도록 API 계약을 개선한 것**이다.

### 9-3. 개발 모드와 실제 사용자 체감을 구분해서 설명할 수 있다

StrictMode 때문에 오류 수가 두 배로 보였다는 점은, 단순히 "버그가 많다"가 아니라
**개발 환경의 동작 특성을 이해하고 디버깅했다**는 근거가 된다.

---

## 10. 남은 리스크와 후속 과제

이번 작업 범위 밖이지만, 별도 포트에서 로그인 검증을 반복하는 과정에서 `refresh_tokens` 업데이트 충돌이 한 번 확인됐다.
이는 동시에 두 서버 또는 두 요청이 같은 refresh token row를 갱신할 때 생길 수 있는 별도 이슈로 보인다.

즉, 이번 문서의 핵심 문제는 해결했지만 아래 항목은 후속 과제로 남겨둘 수 있다.

1. refresh token rotation 충돌 방지
2. 인증 갱신 API의 동시성 제어
3. 오래 떠 있는 개발 서버와 최신 소스 서버가 섞이지 않도록 실행 절차 정리

---

## 11. 추가 기획: 위젯을 없애고 다시 불러오게 만들 수 있는가

결론부터 말하면 **충분히 가능하다.**
현재 구조는 이미 `react-grid-layout`으로 위젯 배치와 크기 저장이 되어 있어서,
여기에 **"보이는 위젯 목록"과 "숨긴 위젯 목록" 상태만 분리해서 추가**하면 된다.

---

## 12. 현재 구조의 한계

현재 대시보드는 아래 정보만 저장한다.

```jsx
const LAYOUT_STORAGE_KEY = 'dashboard-widget-layout';
```

즉, **배치 정보만 있고 위젯의 표시 여부 상태는 없다.**
그래서 지금은 위젯 위치를 옮기는 것은 가능하지만, 특정 위젯을 숨기거나 다시 추가하는 기능은 없다.

---

## 13. 목표 UX

AWS 콘솔처럼 만들려면 아래 흐름이 자연스럽다.

1. 각 위젯 우측 상단 메뉴에서 `위젯 숨기기`
2. 상단 액션 바에서 `위젯 추가`
3. 숨긴 위젯 목록에서 다시 선택
4. 이전 위치가 있으면 그 위치로 복원
5. 이전 위치가 없으면 기본 위치로 추가
6. 필요하면 `레이아웃 초기화`도 함께 제공

---

## 14. 추천 데이터 구조

### 14-1. 위젯 레지스트리

```jsx
const DASHBOARD_WIDGETS = [
  { id: 'stats', title: '통계 요약', removable: false },
  { id: 'dday', title: 'D-Day', removable: true },
  { id: 'feedback', title: '최근 면접 결과', removable: true },
  { id: 'sessions', title: '최근 면접 기록', removable: true },
  { id: 'weakness', title: '학습 약점 요약', removable: true },
  { id: 'recent-learning', title: '최근 학습 기록', removable: true },
];
```

### 14-2. 저장 상태 분리

```jsx
const LAYOUT_STORAGE_KEY = 'dashboard-widget-layout';
const HIDDEN_WIDGET_STORAGE_KEY = 'dashboard-hidden-widgets';
const LAST_LAYOUT_SNAPSHOT_KEY = 'dashboard-last-widget-layout';
```

### 14-3. 핵심 상태

```jsx
const [layouts, setLayouts] = useState(loadSavedLayouts);
const [hiddenWidgetIds, setHiddenWidgetIds] = useState(loadHiddenWidgetIds);
const [lastWidgetLayouts, setLastWidgetLayouts] = useState(loadLastWidgetLayouts);
```

---

## 15. 구현 계획

### 15-1. 1단계: 위젯 표시 상태 추가

- `hiddenWidgetIds`를 `localStorage`에 저장
- 렌더링 시 `hiddenWidgetIds`에 포함된 위젯은 제외

### 15-2. 2단계: 위젯 숨기기 액션 추가

- `DraggableWidgetWrapper`에 메뉴 버튼 추가
- `숨기기` 클릭 시:
  - 현재 위젯 id를 `hiddenWidgetIds`에 추가
  - 현재 레이아웃 정보를 `lastWidgetLayouts`에 보관
  - 화면 렌더링 목록에서는 제거

### 15-3. 3단계: 위젯 다시 추가 패널 추가

- 상단 툴바에 `위젯 추가` 버튼 추가
- 모달 또는 드롭다운에서 숨겨진 위젯 목록 표시
- 선택 시:
  - 숨김 목록에서 제거
  - 저장된 이전 레이아웃이 있으면 복원
  - 없으면 `DEFAULT_LAYOUTS` 기준 위치로 추가

### 15-4. 4단계: 예외 상황 처리

- 모든 위젯이 숨겨진 경우 빈 상태 화면 제공
- 모바일 / 태블릿 / 데스크톱 breakpoint별 복원 위치 보정
- 동일 위치 충돌 시 아래쪽 자동 재배치

### 15-5. 5단계: 사용성 보강

- `레이아웃 초기화`
- `기본 위젯 복원`
- `숨긴 위젯 3개`처럼 상태 배지 표시

---

## 16. 구현 시 주의할 점

1. `layouts`만 지우면 위젯이 사라지는 것이 아니라 배치 정보가 깨질 수 있으므로, **표시 여부와 레이아웃은 분리**해야 한다.
2. `sm / md / lg` breakpoint별 위치가 다르므로, **복원할 때도 breakpoint별 스냅샷**을 관리하는 편이 안전하다.
3. 사용자가 편집 모드가 아닐 때는 실수로 숨기지 않도록, 숨기기 액션은 편집 모드에서만 노출하는 것이 좋다.
4. `stats`처럼 핵심 위젯은 `removable: false`로 고정할 수 있다.

---

## 17. 테스트 시나리오

1. 위젯 하나를 숨긴 뒤 새로고침해도 숨김 상태가 유지되는지 확인
2. 숨긴 위젯을 다시 추가했을 때 이전 위치로 복원되는지 확인
3. 데스크톱에서 숨긴 뒤 모바일로 바꿔도 레이아웃이 깨지지 않는지 확인
4. 모든 위젯을 숨겼을 때 빈 상태 화면과 `위젯 추가` 버튼이 정상 동작하는지 확인
5. `레이아웃 초기화` 후 숨김 상태와 위치 상태가 의도대로 복구되는지 확인

---

## 18. 최종 결론

이번 대시보드 오류는 "요청이 실패한다"는 표면 현상보다,
**인증 준비와 화면 렌더링 순서가 뒤바뀐 구조적 문제**가 본질이었다.

수정은 아래 두 가지를 동시에 달성했다.

1. 인증 복구가 끝난 뒤에만 대시보드가 보호 API를 호출하도록 변경
2. 완료 세션과 피드백 조회 가능 상태를 분리해 불필요한 404를 제거할 수 있는 기반 마련

추가로, 현재 위젯 시스템은 이미 배치 저장 구조를 갖추고 있으므로
`숨기기 / 다시 추가하기` 기능도 무리 없이 확장 가능한 상태다.
