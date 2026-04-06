# 트러블슈팅: 빌드 실패 — Record 생성자 인자 불일치 + 상태 머신 테스트 미반영 + ESM export 변경

## 현상
`./gradlew build` 실행 시 두 단계에서 실패:
1. **컴파일 에러** 2건 — `JobPostingScrapedDto` 생성자 인자 수 불일치
2. **테스트 실패** 1건 — `OrderActionFlowTest`에서 주문 취소 상태 기댓값 불일치

```
> Task :compileJava FAILED
error: constructor JobPostingScrapedDto in record cannot be applied to given types;
  required: String,String,String,String,String
  found:    String,String,String
  reason: actual and formal argument lists differ in length

> Task :test FAILED
AssertionError: JSON path "$.data.status" expected:<CANCELLED> but was:<CANCEL_REQUESTED>
```

---

## 에러 1: Record 생성자 인자 수 불일치

### 원인 분석

Java `record`는 **정규 생성자(canonical constructor)**가 자동 생성됩니다.
필드를 추가하면 생성자의 매개변수도 자동으로 늘어나지만, **해당 record를 `new`로 생성하는 모든 호출부는 수동으로 수정해야** 합니다.

```
JobPostingScrapedDto 필드 변경:
  수정 전: (company, position, description)               → 3개
  수정 후: (company, position, description, due_date, source_url) → 5개
```

이 DTO를 생성하는 곳이 3곳인데, `JobPostingService`만 수정하고 나머지 2곳을 놓쳤습니다:

| 호출부 | 역할 | 수정 여부 |
|--------|------|-----------|
| `JobPostingService.createFromUrl()` | URL 스크래핑 결과로 엔티티 생성 | O (수정됨) |
| `PythonAiService.scrapeJobPosting()` | Python 서버 응답을 DTO로 변환 | X (누락) |
| `MockAiService.scrapeJobPosting()` | 테스트용 Mock 반환 | X (누락) |

### 핵심 교훈: Record 필드 추가 시 영향 범위 추적

Java `record`는 일반 클래스의 `setter`와 달리 **생성자가 유일한 초기화 경로**입니다.
따라서 필드를 추가할 때 "이 record를 `new`로 생성하는 곳이 어디인가?" 를 빠짐없이 찾아야 합니다.

```bash
# IDE 없이도 빠르게 찾는 방법
grep -rn "new JobPostingScrapedDto" --include="*.java" src/
```

### 수정 전 코드

**`PythonAiService.java` (line 165~169)**
```java
// Python 응답 매핑 DTO — 3개 필드만 선언
private record ScrapeJobPostingResponse(
        String company,
        String position,
        String description
) {}
```

**`PythonAiService.java` (line 374)**
```java
// 3개 인자로 생성 → 컴파일 에러
return new JobPostingScrapedDto(
    response.company(), response.position(), response.description()
);
```

**`MockAiService.java` (line 243~266)**
```java
// 3개 인자로 생성 → 컴파일 에러
return new JobPostingScrapedDto(
        "테크스타트업 Inc.",
        "백엔드 개발자 (Java/Spring Boot)",
        """
        [주요 업무]
        ...
        """
);
```

### 수정 후 코드

**`PythonAiService.java` — 응답 DTO에 새 필드 추가**
```java
// Python 서버의 JSON 응답에 due_date, source_url이 추가되었으므로 매핑 DTO도 일치시킴
private record ScrapeJobPostingResponse(
        String company,
        String position,
        String description,
        String due_date,
        String source_url
) {}
```

**`PythonAiService.java` — 5개 인자 전달**
```java
return new JobPostingScrapedDto(
        response.company(), response.position(), response.description(),
        response.due_date(), response.source_url()
);
```

**`MockAiService.java` — 5개 인자 전달 (Mock 데이터)**
```java
return new JobPostingScrapedDto(
        "테크스타트업 Inc.",
        "백엔드 개발자 (Java/Spring Boot)",
        """
        [주요 업무]
        ...
        """,
        "2026-04-30",    // Mock 마감일
        url              // 입력받은 URL을 그대로 반환
);
```

---

## 에러 2: 주문 상태 머신 변경 후 테스트 미반영

### 원인 분석

주문 취소 흐름이 **즉시 취소 → 관리자 승인 방식**으로 변경되었습니다:

```
변경 전: 사용자 취소 → CANCELLED (즉시 완료)
변경 후: 사용자 취소 → CANCEL_REQUESTED (대기) → 관리자 승인 → CANCELLED
```

`OrderService.cancelOrder()` 코드가 이미 변경되어 있었지만:
```java
// OrderService.java — 이미 CANCEL_REQUESTED로 변경된 상태
order.requestCancel(request.reason());  // CANCELLED가 아닌 CANCEL_REQUESTED로 전환
```

테스트는 옛 동작(`CANCELLED`)을 기대하고 있었습니다:
```java
// 테스트 — 아직 옛 기댓값을 사용
.andExpect(jsonPath("$.data.status").value("CANCELLED"));  // 실패!
```

### 핵심 교훈: 상태 머신 변경 시 테스트도 함께 변경

비즈니스 로직의 **상태 전이 규칙**을 바꿨으면 반드시:
1. 해당 상태를 검증하는 **모든 테스트**를 찾아 기댓값을 변경
2. 새로운 중간 상태(`CANCEL_REQUESTED`)에 대한 **추가 테스트** 작성을 고려
3. 테스트의 `@DisplayName`도 변경된 동작에 맞게 갱신

```bash
# 영향받는 테스트를 빠르게 찾는 방법
grep -rn "CANCELLED" --include="*Test.java" src/test/
```

### 수정 전 코드

**`OrderActionFlowTest.java` (line 83~101)**
```java
@Test
@DisplayName("주문 생성 후 취소하면 CANCELLED 상태가 되어야 한다")
void 주문_생성_후_취소() throws Exception {
    String token = 로그인하여_토큰_획득();
    long orderId = 주문_생성하고_ID_획득(token);

    Map<String, Object> cancelRequest = Map.of("reason", "단순 변심");

    mockMvc.perform(patch("/api/orders/{id}/cancel", orderId)
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(cancelRequest)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.status").value("CANCELLED"));  // ← 실패
}
```

### 수정 후 코드

**`OrderActionFlowTest.java`**
```java
@Test
@DisplayName("주문 생성 후 취소하면 CANCEL_REQUESTED 상태가 되어야 한다")
void 주문_생성_후_취소() throws Exception {
    String token = 로그인하여_토큰_획득();
    long orderId = 주문_생성하고_ID_획득(token);

    // 주문 취소 요청 → 관리자 승인 대기 상태(CANCEL_REQUESTED)로 전환
    Map<String, Object> cancelRequest = Map.of("reason", "단순 변심");

    mockMvc.perform(patch("/api/orders/{id}/cancel", orderId)
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(cancelRequest)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.status").value("CANCEL_REQUESTED"));  // ← 수정
}
```

---

## 수정 결과

```
BUILD SUCCESSFUL in 41s
54 tests completed, 0 failed
```

## 면접에서 이 트러블슈팅을 설명하는 방법

### 질문: "빌드 실패를 해결한 경험이 있나요?"

> "채용공고 스크래핑 기능에 마감일 필드를 추가하면서 두 가지 빌드 에러를 만났습니다.
>
> **첫 번째는 Java Record 특성 이해 부족이었습니다.**
> Record에 필드를 추가하면 정규 생성자의 시그니처가 자동으로 바뀌는데,
> 해당 Record를 생성하는 모든 호출부를 함께 수정하지 않아 컴파일 에러가 발생했습니다.
> `grep -rn "new DTO이름"` 으로 모든 호출부를 찾아 일괄 수정했고,
> 이후에는 Record 필드 변경 시 `grep`으로 영향 범위를 먼저 확인하는 습관을 들였습니다.
>
> **두 번째는 상태 머신 변경과 테스트 동기화 누락이었습니다.**
> 주문 취소 흐름을 즉시 취소에서 관리자 승인 방식으로 변경했는데,
> 테스트의 기댓값이 옛 상태(`CANCELLED`)를 그대로 검증하고 있었습니다.
> 비즈니스 로직 변경 시 관련 테스트의 `expected` 값도 반드시 함께 갱신해야 한다는 점을 배웠고,
> 상태 전이 규칙이 바뀔 때는 테스트에서 해당 상태를 검증하는 곳을 `grep`으로 전수 확인합니다."

---

## 에러 3: react-grid-layout v3 ESM export 변경

### 원인 분석

드래그 가능 대시보드를 구현하기 위해 `react-grid-layout`을 설치했는데, v3부터 **ESM export 구조가 변경**되었습니다:

```
Vite 빌드 에러:
"WidthProvider" is not exported by "node_modules/react-grid-layout/dist/react-grid-layout.min.js"
```

v2까지는 `WidthProvider`를 HOC(Higher-Order Component)로 export하여 `Responsive` 컴포넌트를 감싸는 패턴이었지만, v3에서는 `ResponsiveGridLayout`이 **자체적으로 width를 관리**하도록 변경되었습니다.

### 핵심 교훈: 라이브러리 메이저 버전 업그레이드 시 Breaking Changes 확인

npm 패키지를 최신 버전으로 설치할 때, 특히 **메이저 버전이 올라간 경우** CHANGELOG나 마이그레이션 가이드를 반드시 확인해야 합니다.
Stack Overflow나 블로그의 코드 예시가 **구 버전 기준**인 경우가 많으므로 공식 문서를 우선으로 확인합니다.

### 수정 전 코드

**`DashboardPage.jsx`**
```jsx
// v2 스타일 — WidthProvider HOC로 감싸는 패턴
import { Responsive, WidthProvider } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);

// 사용
<ResponsiveGridLayout cols={{ lg: 4, md: 2, sm: 1 }} ...>
  {widgets}
</ResponsiveGridLayout>
```

### 수정 후 코드

**`DashboardPage.jsx`**
```jsx
// v3 스타일 — ResponsiveGridLayout을 직접 import
import { ResponsiveGridLayout as RGLResponsive } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// WidthProvider 없이 직접 사용
<RGLResponsive
  className="layout"
  layouts={layouts}
  breakpoints={{ lg: 1200, md: 768, sm: 480 }}
  cols={{ lg: 4, md: 2, sm: 1 }}
  rowHeight={120}
  width={1200}
  draggableHandle=".widget-drag-handle"
  onLayoutChange={handleLayoutChange}
>
  {widgets}
</RGLResponsive>
```

---

## 수정 결과

```
[백엔드]
BUILD SUCCESSFUL in 41s
54 tests completed, 0 failed

[프론트엔드]
✓ 1137 modules transformed.
dist/index.html                  0.46 kB │ gzip:  0.30 kB
dist/assets/index-*.css         31.52 kB │ gzip:  6.21 kB
dist/assets/index-*.js         487.32 kB │ gzip: 156.78 kB
✓ built in 4.21s
```

## 면접에서 이 트러블슈팅을 설명하는 방법

### 질문: "빌드 실패를 해결한 경험이 있나요?"

> "채용공고 스크래핑 기능에 마감일 필드를 추가하면서 두 가지 빌드 에러를 만났습니다.
>
> **첫 번째는 Java Record 특성 이해 부족이었습니다.**
> Record에 필드를 추가하면 정규 생성자의 시그니처가 자동으로 바뀌는데,
> 해당 Record를 생성하는 모든 호출부를 함께 수정하지 않아 컴파일 에러가 발생했습니다.
> `grep -rn "new DTO이름"` 으로 모든 호출부를 찾아 일괄 수정했고,
> 이후에는 Record 필드 변경 시 `grep`으로 영향 범위를 먼저 확인하는 습관을 들였습니다.
>
> **두 번째는 상태 머신 변경과 테스트 동기화 누락이었습니다.**
> 주문 취소 흐름을 즉시 취소에서 관리자 승인 방식으로 변경했는데,
> 테스트의 기댓값이 옛 상태(`CANCELLED`)를 그대로 검증하고 있었습니다.
> 비즈니스 로직 변경 시 관련 테스트의 `expected` 값도 반드시 함께 갱신해야 한다는 점을 배웠고,
> 상태 전이 규칙이 바뀔 때는 테스트에서 해당 상태를 검증하는 곳을 `grep`으로 전수 확인합니다.
>
> **세 번째는 프론트엔드 라이브러리 메이저 버전 Breaking Change였습니다.**
> react-grid-layout v3에서 `WidthProvider` HOC가 제거되면서 import 에러가 발생했습니다.
> 블로그 코드 예시가 v2 기준이었는데, npm 패키지의 실제 export를 확인하여
> `ResponsiveGridLayout`을 직접 사용하는 v3 방식으로 전환했습니다.
> 이후로는 라이브러리 설치 시 메이저 버전 변경 여부와 CHANGELOG를 먼저 확인합니다."

### 기술 면접 키워드
- **Java Record**: 불변 데이터 캐리어, 정규 생성자 자동 생성, 필드 추가 시 호출부 전수 변경 필요
- **상태 머신 패턴**: 주문 상태 전이 규칙 (PENDING → CANCEL_REQUESTED → CANCELLED)
- **통합 테스트**: MockMvc 기반 API 테스트, JsonPath assertion, 상태 전이 검증
- **영향 범위 분석**: Record/DTO 변경 시 `grep`으로 호출부 전수 파악
- **ESM Breaking Change**: 라이브러리 메이저 버전 업그레이드 시 export 구조 변경 대응
- **Vite 번들러**: ESM 기반 빌드에서 named export 불일치 디버깅
