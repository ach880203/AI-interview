# 대시보드 잔여 오류 2건 트러블슈팅 문서

> 대상 오류
> 1. `GET /api/interviews/sessions 500 (Internal Server Error)`
> 2. `Each child in a list should have a unique "key" prop.`
>
> 참고로 `Download the React DevTools for a better development experience` 는 오류가 아니라 개발 환경 안내 메시지다.

---

## 1. 개요

2026년 3월 25일 기준 대시보드에서는 인증 401 폭주 문제를 먼저 정리했지만,
브라우저 콘솔에는 아래 두 문제가 추가로 남아 있었다.

1. 면접 세션 목록 API 500
2. 약점 위젯 렌더링 시 React `key` 경고

이 문서는 두 문제를 포트폴리오에 바로 옮겨 적을 수 있도록
**원인 - 과정 - 결과** 중심으로 정리하고, **수정 전 코드 / 수정 후 코드**까지 함께 남긴다.

---

## 2. 오류 1: `/api/interviews/sessions` 500

## 2-1. 육하원칙 정리

| 구분 | 내용 |
|------|------|
| **누가(Who)** | 대시보드에 진입한 로그인 사용자 |
| **언제(When)** | 2026년 3월 25일 프론트 수정 후에도 `localhost:8080` 백엔드에 연결해 대시보드에 들어갈 때 |
| **어디서(Where)** | 브라우저 콘솔 `interview.js:66`, 대시보드 `fetchDashboardData`, 백엔드 8080 실행 프로세스 |
| **무엇을(What)** | `GET http://localhost:8080/api/interviews/sessions 500 (Internal Server Error)` 가 두 번 보임 |
| **왜(Why)** | 소스는 이미 수정되었지만, 8080 포트에서 떠 있던 Java 프로세스가 2026년 3월 24일 17:59:58 시작된 **이전 실행본**이어서 최신 수정이 반영되지 않았기 때문 |
| **어떻게(How)** | 8080 프로세스 시작 시각을 확인하고, 최신 소스를 18081 포트로 별도 기동해 같은 API가 200으로 응답하는지 비교 검증했다 |

---

## 2-2. 문제를 좁혀간 과정

### 1단계. 프론트 콘솔에서 증상 확인

브라우저에서는 아래 로그가 반복됐다.

```text
interview.js:66  GET http://localhost:8080/api/interviews/sessions 500 (Internal Server Error)
DashboardPage.jsx:129 fetchDashboardData
```

React 개발 모드 `StrictMode` 때문에 effect 가 두 번 실행되므로,
동일한 500이 두 번 보이는 것은 자연스러운 현상이다.
즉, **오류가 두 종류라는 뜻이 아니라 같은 500이 두 번 찍히는 것**이다.

### 2단계. 8080 포트 프로세스 확인

실행 중인 8080 포트를 조사한 결과, 아래 프로세스가 응답 중이었다.

```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 8080 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess)
```

확인 결과:

- PID: `16984`
- 프로세스: `java.exe`
- 시작 시각: `2026-03-24 오후 5:59:58`

이 시각은 면접 세션 목록 관련 소스 수정을 반영한 시각보다 이전이다.
즉, **브라우저는 최신 소스가 아니라 이전 클래스 파일이 떠 있는 서버와 통신 중**이었다.

### 3단계. 최신 소스를 별도 포트로 기동해 비교

최신 백엔드를 `18081` 포트로 별도 실행해 같은 API를 확인했다.

검증 결과:

- `http://localhost:18081/api/interviews/sessions` 는 `200 OK`
- 즉, **최신 소스 기준 기능은 살아 있고, 8080의 500은 소스 자체보다는 실행 중인 이전 프로세스 문제**로 판단할 수 있었다

---

## 2-3. 기술적 원인

이 이슈는 "코드가 틀렸다"와 "코드가 반영되지 않았다"가 겹친 케이스다.

### 코드 레벨 원인

면접 세션 목록에서 피드백 존재 여부를 판단하는 로직이 이전 소스에서는 불완전했다.
특히 대시보드에서 최근 완료 세션의 피드백 조회와 연결되는 구조상,
목록 응답에서 `feedbackReady` 같은 명시적 상태가 없으면 프론트가 과도하게 추측하게 된다.

### 운영 레벨 원인

코드를 고친 뒤에도 **기존 8080 프로세스를 재기동하지 않으면 브라우저는 여전히 이전 실행본과 통신**한다.
이번 잔여 500은 이 운영 레벨 원인이 결정적이었다.

---

## 2-4. 수정 전 코드

### 수정 전 백엔드 DTO

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

### 수정 전 세션 목록 서비스

```java
public List<SessionSummaryResponseDto> getSessions(String email) {
    UserEntity user = getUser(email);
    return interviewRepository.findByUserIdOrderByStartedAtDesc(user.getId())
            .stream()
            .map(SessionSummaryResponseDto::from)
            .toList();
}
```

위 구조는 "피드백 조회 가능 여부"를 목록 단계에서 알려주지 못한다.
프론트는 완료 세션만 보고 뒤 API를 호출하게 되고, 서버와 화면 사이 계약이 약해진다.

---

## 2-5. 수정 후 코드

### 수정 후 백엔드 DTO

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

### 수정 후 세션 목록 서비스

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

### 수정 후 검증 포인트

코드를 고친 것만으로 끝나지 않고, **반드시 백엔드 프로세스를 현재 소스로 재기동해야 한다.**

즉, 이 오류의 최종 수정은 아래 두 단계가 함께 있어야 완료된다.

1. 소스 수정
2. 기존 8080 서버 재기동

---

## 2-6. 결과

- 최신 소스를 별도 포트로 기동했을 때 `/api/interviews/sessions` 는 200 확인
- 따라서 이 이슈는 "여전히 코드가 틀렸다"기보다, **브라우저가 오래 떠 있던 이전 백엔드 프로세스와 통신 중이라서 남아 있던 500**으로 정리할 수 있다
- 포트폴리오에서는 이 사례를 **코드 수정 후에도 실행 환경을 재검증해야 한다**는 교훈으로 강조하면 좋다

---

## 3. 오류 2: `Each child in a list should have a unique "key" prop`

## 3-1. 육하원칙 정리

| 구분 | 내용 |
|------|------|
| **누가(Who)** | 대시보드의 학습 약점 위젯을 보는 사용자 |
| **언제(When)** | 학습 분석 API 응답이 화면에 렌더링될 때 |
| **어디서(Where)** | `DashboardPage.jsx:459`, `WeaknessRow` 목록 렌더링 |
| **무엇을(What)** | `Each child in a list should have a unique "key" prop.` 경고 발생 |
| **왜(Why)** | 백엔드는 `subjectName` 필드로 응답하는데, 프론트는 `category.name` 을 읽고 있어서 `key={category.name}` 가 `undefined` 가 되었기 때문 |
| **어떻게(How)** | 백엔드 DTO 필드명과 프론트 렌더링 필드명을 대조해 불일치를 찾고, 화면에서 analytics 응답을 정규화하도록 수정했다 |

---

## 3-2. 문제를 좁혀간 과정

### 1단계. 콘솔 경고 위치 확인

브라우저 콘솔은 아래 위치를 가리켰다.

```text
DashboardPage.jsx:459 Each child in a list should have a unique "key" prop.
```

실제 렌더링 코드는 아래였다.

```jsx
{weakCategories.map((category) => (
  <WeaknessRow key={category.name} category={category} />
))}
```

겉으로 보면 `key`를 준 것처럼 보이기 때문에, 처음에는 "중복 과목 이름인가?"로 오해하기 쉽다.

### 2단계. 백엔드 DTO 필드명 확인

학습 분석 DTO 는 `name` 이 아니라 `subjectName` 을 사용하고 있었다.

```java
public record CategoryAnalyticsDto(
        String subjectName,
        long totalCount,
        long correctCount,
        int accuracy,
        boolean isWeak
) {}
```

즉, 프론트가 실제로 받는 객체는 아래 형태에 가깝다.

```json
{
  "subjectName": "Java",
  "totalCount": 12,
  "correctCount": 7,
  "accuracy": 58,
  "isWeak": true
}
```

그런데 화면은 `category.name` 을 읽고 있었다.
결과적으로:

1. 제목 표시가 비거나
2. `key={undefined}` 가 되고
3. React 가 리스트 key 경고를 띄운다

---

## 3-3. 수정 전 코드

### 수정 전 대시보드 렌더링

```jsx
const nextData = {
  analyticsCategories:
    analyticsResult.status === 'fulfilled'
      ? analyticsResult.value.data.data?.categories ?? []
      : [],
};

{weakCategories.map((category) => (
  <WeaknessRow key={category.name} category={category} />
))}

function WeaknessRow({ category }) {
  return (
    <div>
      <p>{category.name}</p>
    </div>
  );
}
```

### 문제점

- API 는 `subjectName`
- 프론트는 `name`
- `key` 와 표시 텍스트가 동시에 깨질 수 있음

---

## 3-4. 수정 후 코드

### 수정 후 대시보드 정규화

```jsx
/**
 * 학습 분석 응답의 과목 이름 필드를 화면에서 일관되게 사용하도록 정규화합니다.
 *
 * [배경]
 * 백엔드 CategoryAnalyticsDto 는 subjectName 필드를 내려주는데,
 * 대시보드는 기존에 name 필드를 읽고 있었습니다.
 * 이 불일치가 생기면 제목이 비고, React key 도 undefined 가 되어 경고가 발생할 수 있습니다.
 */
function normalizeAnalyticsCategories(categories = []) {
  return categories.map((category, index) => ({
    ...category,
    name: category.name ?? category.subjectName ?? `과목 ${index + 1}`,
  }));
}

const nextData = {
  analyticsCategories:
    analyticsResult.status === 'fulfilled'
      ? normalizeAnalyticsCategories(analyticsResult.value.data.data?.categories ?? [])
      : [],
};

{weakCategories.map((category) => (
  <WeaknessRow key={category.name} category={category} />
))}
```

### 수정 후 약점 페이지도 함께 정규화

```jsx
function normalizeAnalyticsCategories(categories = []) {
  return categories.map((category, index) => ({
    ...category,
    name: category.name ?? category.subjectName ?? `과목 ${index + 1}`,
  }));
}

setAnalytics(normalizeAnalyticsCategories(analyticsResult.data.data?.categories ?? []));
```

---

## 3-5. 결과

- `category.name` 이 항상 채워지도록 정규화
- 제목 표시 누락 방지
- `key` 경고 제거 기반 확보
- 같은 analytics 응답을 쓰는 `LearningWeaknessPage` 도 함께 맞춰서 동일 버그 재발을 줄임

---

## 4. 포트폴리오에서 이렇게 설명하면 좋다

### 4-1. 500 오류

"브라우저 콘솔의 500을 처음에는 코드 버그로 봤지만, 실제로는 최신 소스가 반영되지 않은 오래된 8080 백엔드 프로세스가 응답 중이었다. 동일 소스를 별도 포트로 기동해 API 200을 확인함으로써 코드 문제와 실행 환경 문제를 분리 진단했다."

### 4-2. key 경고

"React `key` 경고는 단순히 key 누락이 아니라, 프론트와 백엔드 사이 DTO 필드명 불일치(`subjectName` vs `name`) 때문에 발생했다. 화면에서 analytics 응답을 정규화해 렌더링 계약을 맞추고, 같은 응답을 소비하는 다른 페이지까지 함께 보정했다."

---

## 5. 최종 정리

이번 잔여 오류 2건은 성격이 완전히 달랐다.

1. `/api/interviews/sessions 500`
   개발 코드 문제처럼 보였지만, 실제 핵심은 **이전 프로세스가 살아 있는 실행 환경 문제**였다.

2. `key` 경고
   UI 사소한 경고처럼 보였지만, 실제 핵심은 **API 계약 불일치 문제**였다.

즉, 둘 다 콘솔에서 보이는 증상은 비슷하게 "프론트 오류"처럼 보이지만,
하나는 운영/실행 환경, 다른 하나는 프론트-백엔드 데이터 계약이라는 점에서
서로 다른 층위의 문제였다는 점이 이 트러블슈팅의 핵심이다.
