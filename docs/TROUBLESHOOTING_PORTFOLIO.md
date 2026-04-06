# 포트폴리오 트러블슈팅 문서

> AI 면접 플랫폼 개발 중 발생한 실제 버그 두 건을 원인·과정·결과 순서로 정리합니다.
> 각 항목에 수정 전/후 코드 실물을 포함하여 재현·검증 방법까지 기술합니다.

---

## Bug 1 — 고객센터 공개 문의 상태가 모두 `?`로 표시

### 개요

| 항목 | 내용 |
|------|------|
| **현상** | 고객센터 공개 문의 리스트에서 "답변 대기" · "답변 완료" 등 상태 배지가 모두 `?`(물음표)로 표시 |
| **영역** | 백엔드(MariaDB JDBC 설정) + 프론트엔드(CustomerCenterPage) |
| **심각도** | 높음 — 사용자가 문의 상태를 전혀 확인할 수 없음 |

---

### 원인 (Why · Who)

MariaDB 드라이버의 JDBC URL에 **Java↔JDBC 레이어 인코딩(`characterEncoding=UTF-8`)** 만 설정하고,
**MariaDB 서버 세션(Session) 의 character set** 을 별도로 강제하지 않았기 때문에 발생했다.

JDBC 연결이 완료된 직후 MariaDB 세션 charset 은 서버 전역 기본값(`latin1` 또는 `utf8`)을 그대로 사용한다.
한글 2바이트 문자를 latin1 세션에 쓰면 변환 불가로 `?` 로 치환되고, 이 값이 DB에 영구 저장된다.
읽을 때도 동일하게 `?` 가 반환되므로 프론트엔드가 아무리 올바르게 렌더링해도 복원이 불가능하다.

```
[Java 코드] "답변 대기"
    ↓  characterEncoding=UTF-8 (JDBC 레이어 정상)
[JDBC 드라이버] UTF-8 바이트 스트림
    ↓  세션 charset = latin1 (서버 세션 미설정)
[MariaDB 서버] 변환 불가 → '???'  ← 여기서 파괴
    ↓
[DB 저장값] '???'
```

---

### 과정 (When · Where · How)

#### 1단계 — 버그 재현

백엔드 `application.yml` 에서 JDBC URL 설정을 확인했다.

**수정 전 — `application.yml` (버그 상태)**

```yaml
spring:
  datasource:
    url: ${DB_URL:jdbc:mariadb://localhost:3308/ai_interview?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Seoul}
    hikari:
      maximum-pool-size: ${DB_POOL_SIZE:5}
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

- `characterEncoding=UTF-8` 은 **Java↔드라이버** 사이의 인코딩만 지정한다.
- MariaDB **서버 세션**의 `character_set_connection` 은 건드리지 않는다.
- Hikari 커넥션 풀이 커넥션을 재사용할 때마다 세션 charset 이 서버 기본값으로 돌아온다.

#### 2단계 — 프론트엔드 현상 확인

**수정 전 — `CustomerCenterPage.jsx` (상태 표시 코드)**

```jsx
// 공개 문의 카드 상태 배지
<span className="rounded-full bg-mentor-accent px-2 py-0.5 text-xs text-mentor-primary">
  {inquiry.status}   {/* DB에서 '?' 가 그대로 내려옴 */}
</span>

// 내 문의 카드 상태 배지
<span className="rounded-full bg-mentor-surface border border-mentor-border px-2 py-0.5 text-xs text-mentor-muted">
  {inquiry.status}   {/* 동일하게 '?' */}
</span>
```

백엔드 API 응답 자체가 `"status": "?"` 를 반환하고 있으므로,
프론트엔드를 어떻게 수정해도 DB에 이미 깨진 값이 저장된 신규 문의는 복원이 불가능했다.

#### 3단계 — 2-Layer 수정 적용

**Layer 1 — 백엔드: MariaDB 세션 charset 강제**

두 가지 설정을 함께 추가해야 완전히 차단된다.

| 설정 | 역할 |
|------|------|
| `connectionCollation=utf8mb4_unicode_ci` (URL 파라미터) | 새 커넥션 생성 시 세션 collation 강제 |
| `connection-init-sql` (Hikari) | 커넥션 획득 직후 `SET NAMES utf8mb4` 실행 — 풀에서 꺼낼 때마다 보장 |

```yaml
# 수정 후 — application.yml
spring:
  datasource:
    url: ${DB_URL:jdbc:mariadb://localhost:3308/ai_interview?useUnicode=true&characterEncoding=UTF-8&connectionCollation=utf8mb4_unicode_ci&serverTimezone=Asia/Seoul}
    hikari:
      maximum-pool-size: ${DB_POOL_SIZE:5}
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
      # 커넥션 획득 직후 SET NAMES utf8mb4 실행
      # → 한글·이모지 포함 모든 유니코드 문자가 손실 없이 저장됨
      connection-init-sql: "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
```

**Layer 2 — 프론트엔드: `?` fallback 매핑**

이미 `?` 로 저장된 레거시 레코드 및 향후 예상치 못한 인코딩 오류에 대응하기 위해,
`statusCode`(영문 enum 명)를 1차 fallback 키로 사용하는 방어 로직을 추가했다.

```jsx
// 수정 후 — CustomerCenterPage.jsx

/**
 * 문의 상태 한글 라벨 매핑
 * DB 인코딩 오류로 status가 '?'인 경우에도 statusCode → 한글로 표시
 */
const INQUIRY_STATUS_LABELS = {
  WAITING: '답변 대기',
  ANSWERED: '답변 완료',
};

/**
 * [우선순위]
 * 1. 백엔드 status 필드 (정상: "답변 대기" / "답변 완료")
 * 2. statusCode 영문 enum → 한글 매핑 (DB 인코딩 오류 fallback)
 * 3. statusCode 원본 (마지막 fallback)
 */
function resolveStatusLabel(inquiry) {
  const label = inquiry.status?.trim();
  if (label && label !== '?' && !label.includes('?')) return label;
  return INQUIRY_STATUS_LABELS[inquiry.statusCode] ?? inquiry.statusCode ?? '확인 중';
}

// 공개 문의 카드 상태 배지 (수정 후)
<span
  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
    inquiry.statusCode === 'ANSWERED'
      ? 'bg-green-100 text-green-700'
      : 'bg-mentor-accent text-mentor-primary'
  }`}
>
  {resolveStatusLabel(inquiry)}   {/* '?' 대신 "답변 대기" / "답변 완료" */}
</span>

// 내 문의 카드 상태 배지 (수정 후)
<span
  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
    inquiry.statusCode === 'ANSWERED'
      ? 'bg-green-100 text-green-700'
      : 'bg-mentor-accent text-mentor-primary'
  }`}
>
  {resolveStatusLabel(inquiry)}
</span>
```

---

### 결과 (Result)

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| 신규 한글 데이터 저장 | `?`로 파괴 | utf8mb4 그대로 저장 |
| 레거시 `?` 레코드 표시 | `?` | statusCode → 한글 매핑 fallback |
| 배지 색상 구분 | 없음 (단색) | ANSWERED=초록, WAITING=파랑 |
| 커넥션 재사용 시 charset | 보장 없음 | Hikari init-sql로 매번 보장 |

**핵심 교훈**

1. JDBC `characterEncoding` 은 Java↔드라이버 레이어만 제어한다. MariaDB **세션 charset** 은 `connectionCollation` 또는 `SET NAMES` 로 별도 강제해야 한다.
2. Hikari 커넥션 풀은 커넥션을 재사용하므로, 세션 상태는 `connection-init-sql` 로 풀에서 꺼낼 때마다 재설정해야 한다.
3. 프론트엔드의 **방어적 fallback 매핑**은 백엔드 수정만으로는 복구 불가능한 레거시 데이터를 사용자에게 의미 있게 표시할 수 있는 추가 안전망이다.

---
---

## Bug 2 — 대시보드 위젯 정렬 엉망·카드 사이즈 망가짐

### 개요

| 항목 | 내용 |
|------|------|
| **현상** | 대시보드 위젯이 모두 세로로 쌓이고, 각 카드가 이중으로 그려지며 사이즈가 의도와 달리 축소됨 |
| **영역** | 프론트엔드 (`DashboardPage.jsx`, `react-grid-layout` v2.2.2) |
| **심각도** | 높음 — 대시보드 전체 레이아웃이 무너져 주요 기능 접근 불가 |

---

### 원인 (Why · Who)

세 가지 원인이 복합적으로 작용했다.

#### 원인 A — `react-grid-layout` CSS import 누락

`react-grid-layout` 은 위젯 절대 좌표 배치와 리사이즈 핸들을 CSS로 제어한다.
이 CSS가 없으면 모든 위젯이 `display: block` 기본값으로 세로 쌓기(normal flow)가 된다.

#### 원인 B — 이중 카드 스타일 (Double Card)

`DraggableWidgetWrapper` 가 `rounded-3xl + bg-mentor-surface + shadow` 카드 컨테이너 역할을 하고 있었는데,
내부 컴포넌트(`WidgetCard`, `DDayWidget`, `RecentFeedbackWidget`)도 동일한 카드 스타일을 갖고 있었다.
결과적으로 **카드 안에 카드**가 그려져 여백·사이즈가 두 배로 소비됐다.

#### 원인 C — `WidthProvider` v2 비호환 → 그리드 너비 0 계산

`react-grid-layout` v2.2.2 에서 `WidthProvider` 가 제거됐다.
기존 코드에서 `import { Responsive as RGLResponsive, WidthProvider }` 형태로 가져오면
빌드 시 `"WidthProvider" is not exported` 에러가 발생했고,
이를 임시로 `WidthProvider` 없이 `const ResponsiveGridLayout = RGLResponsive` 로 교체했지만
`width` prop 을 명시하지 않은 채로 두어 그리드가 **너비 0** 으로 계산됐다.

결과적으로 모든 위젯이 왼쪽으로 몰리고, 열 너비가 0px 로 계산되어 카드들이 겹치거나 화면 한쪽에 뭉쳐서 표시됐다.

---

### 과정 (When · Where · How)

#### 수정 전 코드

**`DashboardPage.jsx` — import 및 초기 설정 (버그 상태)**

```jsx
// 수정 전 ① — CSS import 누락
import { Responsive as RGLResponsive, WidthProvider } from 'react-grid-layout';
// ↑ CSS import 없음 → 위젯 세로 쌓기 발생
// ↑ WidthProvider v2.2.2에서 제거됨 → 빌드 에러

const ResponsiveGridLayout = WidthProvider(RGLResponsive); // 빌드 에러
```

**`DashboardPage.jsx` — DraggableWidgetWrapper (이중 카드 버그)**

```jsx
// 수정 전 ② — 위젯 래퍼가 카드 스타일을 갖고 있음
function DraggableWidgetWrapper({ title, children }) {
  return (
    <div className="rounded-3xl bg-mentor-surface shadow-[var(--shadow-card)]">
      <div className="widget-drag-handle ...">
        <span>{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// 수정 전 ③ — 내부 컴포넌트도 동일한 카드 스타일 (이중 카드)
function WidgetCard({ title, subtitle, children, ... }) {
  return (
    // ↓ 이 section이 이중 카드의 원인
    <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function DDayWidget({ ... }) {
  return (
    // ↓ 동일하게 카드 스타일 중복
    <motion.section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
      ...
    </motion.section>
  );
}

function RecentFeedbackWidget({ ... }) {
  return (
    // ↓ 동일하게 카드 스타일 중복
    <section className="rounded-3xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
      ...
    </section>
  );
}
```

**수정 전 `DashboardPage.jsx` — 편집 모드 없음**

```jsx
// 수정 전 ④ — isDraggable/isResizable 항상 true → 의도치 않은 드래그 발생
<ResponsiveGridLayout
  isDraggable={true}
  isResizable={true}
  ...
>
```

---

#### 수정 후 코드

**`DashboardPage.jsx` — import 수정 (원인 A, C 해결)**

```jsx
// 수정 후 ① — CSS import 추가 + WidthProvider 제거
import { ResponsiveGridLayout as RGLResponsive } from 'react-grid-layout';
// react-grid-layout CSS: 위젯 절대 좌표 배치·리사이즈 핸들에 필수.
// 이 두 줄이 없으면 모든 위젯이 세로로 쌓이고 크기·위치 지정이 전혀 작동하지 않습니다.
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// WidthProvider 없이 직접 사용 (v2.2.2 호환)
const ResponsiveGridLayout = RGLResponsive;
```

**`DashboardPage.jsx` — AWS 콘솔형 편집 모드 추가 (원인 C 해결)**

```jsx
// 수정 후 ② — editMode state: AWS 콘솔 "커스터마이즈" 패턴
const [editMode, setEditMode] = useState(false);

// 편집 툴바
<div className="flex items-center justify-end gap-2">
  {editMode && (
    <button
      type="button"
      onClick={handleResetLayout}
      className="rounded-full border border-mentor-border bg-mentor-bg px-4 py-2 text-xs font-semibold ..."
    >
      기본 배치로 초기화
    </button>
  )}
  <button
    type="button"
    onClick={() => setEditMode((prev) => !prev)}
    className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
      editMode
        ? 'bg-mentor-primary text-white hover:bg-mentor-primary-dark'
        : 'border border-mentor-border bg-mentor-bg ...'
    }`}
  >
    {editMode ? '편집 완료' : '위젯 배치 편집'}
  </button>
</div>

// 그리드: editMode 일 때만 드래그·리사이즈 활성화
<ResponsiveGridLayout
  layouts={layouts}
  breakpoints={{ lg: 1200, md: 996, sm: 0 }}
  cols={{ lg: 12, md: 10, sm: 6 }}
  rowHeight={60}
  margin={[16, 16]}
  draggableHandle=".widget-drag-handle"
  isResizable={editMode}   // ← editMode에 바인딩
  isDraggable={editMode}   // ← editMode에 바인딩
  onLayoutChange={handleLayoutChange}
>
```

---

#### Bug 2-D — 위젯이 한쪽으로 몰리고 드롭 위치 미표시 (3차 추가 수정)

**원인**: `WidthProvider` 제거 후 `width` prop 을 수동으로 전달하지 않아 그리드 컨테이너 너비가 0 으로 계산됨. 또한 편집 모드에서 "어디에 놓을 수 있는지" 안내 격자가 없어 드롭 위치를 사용자가 직관적으로 알 수 없었음.

**수정 전 — 너비 누락 상태**

```jsx
// width prop 없음 → 그리드가 너비 0 으로 계산되어 위젯 전부 왼쪽 끝에 뭉침
const ResponsiveGridLayout = RGLResponsive;

<ResponsiveGridLayout
  layouts={layouts}
  breakpoints={{ lg: 1200, md: 996, sm: 0 }}
  cols={{ lg: 12, md: 10, sm: 6 }}
  rowHeight={60}
  margin={[16, 16]}
  isResizable={editMode}
  isDraggable={editMode}
  onLayoutChange={handleLayoutChange}
>
```

**수정 후 — ResizeObserver 너비 측정 + 드롭 존 시각화**

```jsx
// ① useRef import 추가
import { useCallback, useEffect, useRef, useState } from 'react';

// ② ResizeObserver로 컨테이너 실제 너비 측정
const gridContainerRef = useRef(null);
const [gridWidth, setGridWidth] = useState(1200);

useEffect(() => {
  const el = gridContainerRef.current;
  if (!el) return;
  setGridWidth(el.getBoundingClientRect().width);  // 초기값 즉시 반영
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      setGridWidth(entry.contentRect.width);
    }
  });
  observer.observe(el);
  return () => observer.disconnect();
}, []);

// ③ 그리드 컨테이너: ref 부착 + editMode 시 격자 배경(드롭 존 표시)
<div
  ref={gridContainerRef}
  className={`relative rounded-3xl transition-all ${
    editMode
      ? 'bg-[repeating-linear-gradient(...)] outline-dashed outline-1 outline-mentor-primary/20'
      : ''
  }`}
>
  <ResponsiveGridLayout
    width={gridWidth}          // ← 실측 너비 전달 (핵심 수정)
    compactType="vertical"     // ← 드롭 후 위젯이 위쪽으로 자동 붙음
    layouts={layouts}
    breakpoints={{ lg: 1200, md: 996, sm: 0 }}
    cols={{ lg: 12, md: 10, sm: 6 }}
    rowHeight={60}
    margin={[16, 16]}
    isResizable={editMode}
    isDraggable={editMode}
    draggableHandle=".widget-drag-handle"
    onLayoutChange={handleLayoutChange}
  >
    ...
  </ResponsiveGridLayout>
</div>
```

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| 그리드 너비 계산 | 0px (위젯 전부 몰림) | 실제 컨테이너 너비 |
| 브라우저 리사이즈 대응 | 없음 | ResizeObserver 자동 재측정 |
| 드롭 가능 위치 표시 | 없음 | editMode 시 격자 배경 점선 표시 |
| 드롭 후 정렬 | 공백 그대로 유지 | `compactType="vertical"` 로 위쪽 자동 압축 |

**`DashboardPage.jsx` — DraggableWidgetWrapper 단일 카드로 확정 (원인 B 해결)**

```jsx
// 수정 후 ③ — DraggableWidgetWrapper: 유일한 카드 컨테이너 (bg + shadow + rounded)
function DraggableWidgetWrapper({ title, editMode, children }) {
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-3xl bg-mentor-surface shadow-[var(--shadow-card)] transition-all ${
        editMode ? 'ring-2 ring-mentor-primary/30' : ''
      }`}
    >
      {/* 드래그 핸들 — editMode일 때만 강조 */}
      <div
        className={`widget-drag-handle flex shrink-0 items-center gap-2 border-b border-mentor-border px-4 py-2.5 transition-colors ${
          editMode
            ? 'cursor-grab bg-mentor-accent/60 active:cursor-grabbing'
            : 'cursor-default bg-transparent'
        }`}
      >
        {editMode && (
          <svg className="h-4 w-4 shrink-0 text-mentor-primary" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="4" cy="3" r="1.5" /><circle cx="12" cy="3" r="1.5" />
            <circle cx="4" cy="8" r="1.5" /><circle cx="12" cy="8" r="1.5" />
            <circle cx="4" cy="13" r="1.5" /><circle cx="12" cy="13" r="1.5" />
          </svg>
        )}
        <span className={`text-xs font-semibold ${editMode ? 'text-mentor-primary' : 'text-mentor-muted'}`}>
          {title}
        </span>
        {editMode && (
          <span className="ml-auto text-xs text-mentor-primary/70">드래그·리사이즈 가능</span>
        )}
      </div>
      <div className="flex-1 overflow-auto p-5">{children}</div>
    </div>
  );
}

// 수정 후 ④ — WidgetCard: 카드 스타일 제거 (DraggableWidgetWrapper에 위임)
function WidgetCard({ title, subtitle, linkTo, linkLabel, linkMuted = false, children }) {
  return (
    <div>  {/* ← section + bg + shadow 제거 */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-mentor-text">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-mentor-muted">{subtitle}</p>}
        </div>
        {linkTo && (
          <Link to={linkTo} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            linkMuted ? 'bg-mentor-bg text-mentor-muted ...' : 'bg-mentor-accent text-mentor-primary ...'
          }`}>
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

// DDayWidget, RecentFeedbackWidget도 동일하게 최상위 태그를 <div>로 교체
function DDayWidget({ ... }) {
  return <div>...</div>;  // motion.section → div (카드 스타일 제거)
}

function RecentFeedbackWidget({ ... }) {
  return <div>...</div>;  // section → div (카드 스타일 제거)
}
```

---

### 결과 (Result)

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| 위젯 배치 | 세로 쌓기 (normal flow) | 그리드 좌표 배치 정상 |
| 카드 렌더링 | 이중 카드 (padding·shadow 2×) | 단일 카드 |
| 드래그·리사이즈 | 항상 활성화 (의도치 않은 드래그) | 편집 모드 ON/OFF 분리 |
| 편집 모드 | 없음 | AWS 콘솔형 토글 + 초기화 버튼 |
| 레이아웃 저장 | 없음 | localStorage 자동 저장·복원 |
| 빌드 에러 | WidthProvider 에러 | 없음 (v2.2.2 호환) |
| 그리드 너비 | 0px (위젯 왼쪽 몰림) | ResizeObserver 실측값 전달 |
| 드롭 위치 안내 | 없음 | editMode 격자 배경 + 점선 외곽선 |
| 드롭 후 정렬 | 공백 잔존 | compactType="vertical" 자동 압축 |

**핵심 교훈**

1. `react-grid-layout` 은 CSS 파일 없이는 작동하지 않는다. 라이브러리 CSS import 를 빠뜨리면 레이아웃이 완전히 무너진다. 공식 문서의 "Quick Start" 섹션을 반드시 확인해야 한다.
2. **단일 책임 원칙(Single Responsibility)** — 카드 컨테이너(bg·shadow·rounded)는 한 컴포넌트만 담당해야 한다. 래퍼와 내부 컴포넌트 모두 동일한 스타일을 갖는 것은 이중 렌더링을 유발한다.
3. 자유 배치 UI 는 반드시 **편집 모드/뷰 모드 분리**가 필요하다. AWS 콘솔이 "커스터마이즈" 버튼을 클릭해야만 위젯을 움직일 수 있는 이유가 바로 이것이다 — 일상 뷰에서 의도치 않은 드래그로 인한 레이아웃 파괴를 방지한다.
4. 외부 라이브러리의 **major 버전업**에서 제거된 API(`WidthProvider`)는 빌드 에러로 즉시 드러나지만, 없어진 CSS 의존성은 런타임에서만 확인되므로 더 찾기 어렵다.
5. `WidthProvider` 를 임시로 제거할 때 **대체 수단(`width` prop)을 함께 추가하지 않으면** 조용히 새 버그가 생긴다. 라이브러리 API를 제거할 때는 반드시 그것이 제공하던 기능(여기서는 너비 측정)을 다른 방법으로 보완해야 한다. `ResizeObserver` 는 이런 측면에서 `WidthProvider` 의 완전한 대체재다.
6. **드래그 UI의 드롭 존 시각화**는 편의 기능처럼 보이지만 필수 UX다. 어디에 놓을 수 있는지 보이지 않으면 사용자는 드래그 기능 자체가 작동하지 않는다고 인식한다.

---

### 재현 및 검증 방법

#### Bug 1 검증

```
1. MariaDB 클라이언트에서 SELECT character_set_connection; 확인 → latin1 이면 버그 재현 환경
2. 고객센터에서 문의 등록 → DB에서 SELECT * FROM customer_center_inquiry WHERE id=? 로 status 컬럼 직접 확인
3. application.yml 수정 후 앱 재시작 → 신규 문의 등록 → status 값이 "답변 대기"로 정상 저장 확인
4. 프론트엔드 공개 문의 탭에서 배지가 "답변 대기" / "답변 완료"로 정상 표시 확인
```

#### Bug 2 검증

```
1. CSS import 제거 후 npm run dev → 위젯이 세로 쌓기로 표시됨 (원인 A 재현)
2. DraggableWidgetWrapper + WidgetCard 동시에 카드 스타일 적용 → 이중 카드 확인 (원인 B 재현)
3. npm run build → WidthProvider import 포함 시 빌드 에러 확인 (원인 C 재현)
4. 수정 후: 대시보드 접속 → 위젯이 전체 너비를 채워 정상 배치되는지 확인
5. "위젯 배치 편집" 클릭 → 격자 배경 점선이 나타나는지 확인 (드롭 존 시각화)
6. 위젯 핸들을 잡아 빈 영역에 드롭 → 해당 그리드 칸에 스냅(고정)되는지 확인
7. 드롭 후 위젯이 위쪽으로 자동 압축(compactType="vertical")되는지 확인
8. 위젯 이동 후 새로고침 → 레이아웃 유지 확인 (localStorage 저장)
9. "기본 배치로 초기화" 클릭 → DEFAULT_LAYOUTS 로 복원 확인
10. 브라우저 창 크기를 줄였다 늘렸을 때 위젯 너비가 컨테이너에 맞게 재계산되는지 확인
```

---
---

## Bug 3 — 학습 문제 생성 API에서 503 / 500 에러 발생

### 개요

| 항목 | 내용 |
|------|------|
| **현상** | 학습 문제 생성 요청 시 Python AI 서버에서 500 에러 발생 → Spring Boot 백엔드가 이를 받아 프론트에 503 Service Unavailable 반환 |
| **영역** | Python FastAPI AI 서버 (`services/learning_service.py`, 시스템 프롬프트 4개) |
| **에러 로그** | `AttributeError: 'str' object has no attribute 'get'` @ `learning_service.py:97` |
| **심각도** | 치명 — 학습 문제 생성 기능 전체 불가 |

---

### 원인 (Why · Who)

**모순된 두 명령이 충돌하여 OpenAI가 예측 불가능한 형식으로 응답.**

| 명령 위치 | 지시 내용 |
|-----------|-----------|
| 시스템 프롬프트 | `"JSON 배열만 출력하고 다른 텍스트는 추가하지 마세요."` → `[...]` 배열 |
| OpenAI API 호출 | `response_format={"type": "json_object"}` → **반드시 `{...}` 객체** |

OpenAI의 `json_object` 모드는 최상위가 JSON 배열(`[...]`)인 응답을 허용하지 않는다.
프롬프트가 배열을 요구하지만 API가 객체를 강제하므로, 모델은 두 명령을 모두 따르려다
배열을 객체 안에 **문자열로 감싸서** 반환하는 경우가 발생한다.

```
[정상 케이스]  {"problems": [{...}, {...}]}   → parsed.get("problems") → list ✓

[버그 케이스]  {"result": "[{\"type\":...}]"} → list(parsed.values())[0] → 문자열 str ✗
               ↓
               items = "[{\"type\":...}]"  (str)
               items[:5] = "[{\""         (첫 5글자 슬라이싱)
               item = "["                 (단일 문자)
               item.get("type", ...) → AttributeError: 'str' object has no attribute 'get'
```

---

### 과정 (When · Where · How)

#### 1단계 — 에러 로그 분석

`ai-server-8000.err.log` 에서 핵심 스택 트레이스를 확인:

```
File "ai-server/services/learning_service.py", line 97, in generate_problems
    type=item.get("type", problem_type if problem_type != "MIX" else "MULTIPLE"),
         ^^^^^^^^
AttributeError: 'str' object has no attribute 'get'
```

`item` 이 dict가 아니라 **str** 임을 의미한다.
`items[:count]` 를 순회할 때 `items` 자체가 문자열이면 각 `item` 은 단일 문자가 된다.

#### 2단계 — 파싱 로직 추적

**수정 전 `learning_service.py` — 파싱 로직 (버그 상태)**

```python
# ① OpenAI API 호출 — json_object 모드 강제
response = await client.chat.completions.create(
    model=model,
    messages=[...],
    response_format={"type": "json_object"},  # 반드시 {..} 객체만 허용
)
raw = response.choices[0].message.content.strip()
parsed = json.loads(raw)

# ② 파싱 분기 — 문자열 candidate를 처리하지 않음
if isinstance(parsed, list):
    items = parsed
else:
    # ↓ parsed.values() 중 첫 번째 값이 문자열 "[...]" 이면 items가 str 이 됨
    items = parsed.get("problems") or parsed.get("questions") or list(parsed.values())[0]

# ③ items 가 str 인 채로 순회 → 단일 문자가 item 으로 들어옴
for item in items[:count]:
    problems.append(
        LearningProblemItem(
            type=item.get("type", ...),  # ← AttributeError 발생
            ...
        )
    )
```

**수정 전 시스템 프롬프트 (4개 파일 동일)**

```
[출력 형식 - 반드시 JSON 배열]
[
  {
    "type": "MULTIPLE" 또는 "SHORT",
    ...
  }
]
JSON 배열만 출력하고 다른 텍스트는 추가하지 마세요.
↑ json_object 모드와 직접 모순 — 배열([..])은 json_object 에서 불가
```

#### 3단계 — 2-Layer 수정

**Layer 1 — 시스템 프롬프트 수정 (4개 파일 동일 적용)**

`learning_generate_system_default.txt` / `_it.txt` / `_english.txt` / `_history.txt`

```
# 수정 전
[출력 형식 - 반드시 JSON 배열]
[
  { ... }
]
JSON 배열만 출력하고 다른 텍스트는 추가하지 마세요.

# 수정 후
[출력 형식 - 반드시 아래 JSON 객체 구조]
{
  "problems": [
    {
      "type": "MULTIPLE" 또는 "SHORT",
      "question": "<문제>",
      "choices": ["<선택지1>", "<선택지2>", "<선택지3>", "<선택지4>"],
      "answer": "<정답>",
      "explanation": "<해설 1~2문장>"
    }
  ]
}
MULTIPLE 문제의 choices는 반드시 4개의 문자열 배열이어야 합니다.
SHORT 문제의 choices는 반드시 null로 설정하세요.
다른 텍스트 없이 JSON 객체만 출력하세요.
```

**Layer 2 — `learning_service.py` 파싱 로직 보강**

```python
# 수정 후 — candidate가 str인 경우 재파싱 + item이 dict인지 검사
parsed = json.loads(raw)
if isinstance(parsed, list):
    items = parsed
else:
    candidate = (
        parsed.get("problems")
        or parsed.get("questions")
        or parsed.get("items")
        or list(parsed.values())[0]
    )
    # candidate가 문자열인 경우(모델이 배열을 문자열로 감싼 경우) 재파싱 시도
    if isinstance(candidate, str):
        try:
            candidate = json.loads(candidate)
        except json.JSONDecodeError:
            pass
    items = candidate if isinstance(candidate, list) else []

# ...

for item in items[:count]:
    # item이 dict가 아닌 경우(모델 응답 형식 오류) 건너뜀
    if not isinstance(item, dict):
        continue
    problems.append(
        LearningProblemItem(
            type=item.get("type", problem_type if problem_type != "MIX" else "MULTIPLE"),
            ...
        )
    )
```

---

### 결과 (Result)

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| 프롬프트-API 일관성 | 모순 (배열 요구 vs 객체 강제) | 일치 (`{"problems": [...]}` 객체) |
| candidate가 str일 때 | `items = str` → AttributeError | `json.loads()` 재파싱 후 list로 변환 |
| item이 str일 때 | AttributeError 500 에러 | `isinstance(item, dict)` 체크로 건너뜀 |
| 클라이언트 수신 | 503 Service Unavailable | 정상 문제 목록 반환 |

**핵심 교훈**

1. **OpenAI `response_format={"type": "json_object"}` 는 JSON 배열(`[...]`)을 허용하지 않는다.** 프롬프트에서 배열을 요청하면 모델이 이를 객체로 감싸거나 문자열로 직렬화하는 비결정론적 동작을 한다. `json_object` 모드를 쓸 때는 반드시 프롬프트도 `{"key": [...]}` 객체 형식으로 통일해야 한다.
2. **외부 AI API 응답은 항상 방어적으로 파싱해야 한다.** 모델 버전 업데이트나 컨텍스트 변화로 응답 형식이 바뀔 수 있으므로, `isinstance(candidate, str)` 재파싱과 `isinstance(item, dict)` 타입 검사가 필수 방어막이다.
3. **Python FastAPI의 처리되지 않은 예외는 ASGI 레이어를 통해 전파**되어 Starlette 미들웨어에서 500을 반환한다. Spring Boot는 이 응답을 받아 503으로 변환하므로, 클라이언트 입장에서는 503이 보이지만 실제 근본 원인은 FastAPI 내부 예외다. 에러를 추적할 때는 백엔드 로그뿐 아니라 Python 서버 에러 로그를 직접 확인해야 한다.

---

### 재현 및 검증 방법

```
1. 에러 재현:
   - ai-server/prompts/learning_generate_system_default.txt 에서 프롬프트를 배열 형식으로 되돌림
   - POST /learning/generate 호출 → ai-server-8000.err.log 에서 AttributeError 확인

2. 수정 후 검증:
   - POST /learning/generate (subject=IT, difficulty=MEDIUM, type=MULTIPLE, count=3) 호출
   - 200 응답 + {"problems": [...]} 형식의 정상 문제 목록 반환 확인
   - Python AI 서버 로그에 에러 없음 확인

3. 방어 로직 검증:
   - learning_service.py 에서 candidate를 임시로 "[{...}]" 문자열로 고정
   - json.loads 재파싱이 실행되어 list로 변환되는지 확인
   - 정상 응답이 반환되는지 확인
```

---
---

## Bug 4 — 채용공고 페이지 401 + 503 연속 발생

> Bug 3의 Python AI 서버 503 전파 패턴과 동일한 경로지만, 원인은 두 개의 독립된 레이어에서 각각 발생.

### 개요

| 항목 | 내용 |
|------|------|
| **현상 A** | 채용공고 페이지 진입 시 `GET /api/job-postings 401 (Unauthorized)` 4회 연속 발생 |
| **현상 B** | "AI로 가져오기" 버튼 클릭 시 `POST /api/job-postings/from-url 503 (Service Unavailable)` |
| **영역** | 프론트엔드(Zustand 토큰 설계 + React 18 StrictMode) + Python AI 서버(httpx 봇 차단) |
| **심각도** | A: 낮음(인터셉터 자동 복구) / B: 높음(URL 스크래핑 기능 전체 불가) |

---

### 원인 분석 (Why)

#### Error A — `401 Unauthorized` 4회 반복

`accessToken` 은 XSS 방어를 위해 **의도적으로 localStorage에 저장하지 않는다** (`authStore.js` `partialize`).
페이지가 로드되면 메모리 상태의 `accessToken` 은 `null` 이다.

```js
// authStore.js — partialize 설정
partialize: (state) => ({
  refreshToken: state.refreshToken, // ← localStorage에 저장
  user: state.user,                 // ← localStorage에 저장
  // accessToken: 저장 안 함 (XSS 방어 목적)
}),
```

첫 API 요청은 Authorization 헤더 없이 전송 → **401** → axios 인터셉터가 `refreshToken` 으로 재발급 → `accessToken` 갱신 → 원본 요청 재시도 → **200**

이 흐름이 **4번** 반복되는 이유:

```
React 18 StrictMode (개발 모드)
  ├─ 1st mount  →  useEffect 실행 → GET /job-postings → 401
  ├─ unmount     (StrictMode: 의도적 마운트/언마운트 반복)
  └─ 2nd mount  →  useEffect 재실행 → GET /job-postings → 401
                   (refresh가 완료되기 전에 2번째 요청이 발사됨)

React DevTools 연결 시 추가 리렌더 → 추가 2회 → 총 4회
```

`axios.js` 의 `isRefreshing` + `failedQueue` 가 동시 refresh race condition을 막지만,
**StrictMode가 마운트/언마운트를 반복하는 속도가 더 빠를 경우** 이미 완료된 refresh의 `accessToken` 이
다음 effect 발화 시점에 Zustand 메모리에 반영돼 있어 정상 작동한다.
즉 **실제 인증 실패는 아니고, 콘솔 노이즈와 불필요한 refresh 요청만 발생**한다.

#### Error B — `503 Service Unavailable`

**에러 전파 경로:**

```
사용자 → POST /api/job-postings/from-url (Spring Boot)
  └─ PythonAiService.scrapeJobPosting()
       └─ POST http://localhost:8000/scrape/job-posting (Python AI)
            └─ httpx.AsyncClient.get(target_url)
                 └─ 403 Forbidden / ConnectError (채용사이트 봇 차단)
                      └─ HTTPException(status_code=503) 반환
  └─ AiServiceException → Spring Boot 503 응답
       └─ 프론트엔드 503 수신
```

Python `scraping_service.py` 의 `httpx.AsyncClient` 가 **기본 User-Agent** (`python-httpx/x.x.x`) 로 요청을 보낸다.

대부분의 대형 채용 사이트(원티드, 잡코리아, 사람인 등)는 Python/bot User-Agent를 감지해 즉시 차단한다:
- `403 Forbidden` 반환 → `response.raise_for_status()` → exception → `HTTPException(503)`
- 또는 연결 자체를 거부

```python
# 수정 전 — 봇 User-Agent 그대로 노출
async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
    response = await client.get(url)  # python-httpx/0.x.x User-Agent
    response.raise_for_status()       # 403 → 예외 → 503
```

**Bug 3 와의 공통점:**
| 항목 | Bug 3 (학습 생성) | Bug 4B (스크래핑) |
|------|-------------------|-------------------|
| Python 에러 | `AttributeError` (내부 로직 버그) | `HTTPError` (외부 URL 차단) |
| Python HTTP 응답 | 500 | 503 |
| Spring Boot 처리 | `AiServiceException` → 503 | `AiServiceException` → 503 |
| 프론트 수신 | 503 | 503 |

두 버그 모두 **Python AI 서버 에러 → Spring Boot `AiServiceException` → 503** 전파 패턴을 공유한다.

---

### 과정 (When · Where · How)

#### 수정 전 코드

**`scraping_service.py` — 봇 User-Agent (버그 상태)**

```python
async def scrape_job_posting(url: str) -> JobPostingScrapedResponse:
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            # ↓ User-Agent 헤더 없음 → httpx 기본값 "python-httpx/0.x.x"
            # 채용 사이트들이 이 값을 봇으로 인식해 403 Forbidden 반환
            response = await client.get(url)
            response.raise_for_status()
    except Exception as error:
        # 403, 연결 거부, 타임아웃 모두 동일하게 503으로 처리 → 디버깅 어려움
        raise HTTPException(status_code=503, detail=f"채용공고 페이지를 가져오지 못했습니다: {error}")
```

**`axios.js` — 요청 인터셉터 (401 흐름)**

```js
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // ↑ 페이지 로드 시 accessToken = null → 헤더 없이 발사 → 401
  return config;
});
```

#### 수정 후 코드

**`scraping_service.py` — 브라우저 User-Agent 설정**

```python
async def scrape_job_posting(url: str) -> JobPostingScrapedResponse:
    # 브라우저처럼 보이는 헤더를 설정합니다.
    # python-httpx 기본 User-Agent는 대부분의 채용 사이트에서 봇으로 차단됩니다.
    _BROWSER_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    }

    try:
        async with httpx.AsyncClient(
            timeout=15.0,          # ← 10s → 15s: 외부 사이트 응답 여유 시간 확보
            follow_redirects=True,
            headers=_BROWSER_HEADERS  # ← 브라우저처럼 보이는 헤더 추가
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"채용공고 페이지를 가져오지 못했습니다: {error}")
```

---

### 결과 (Result)

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| **401 원인** | `accessToken` 미지속 (의도적 보안 설계) | 동일 (설계 유지) |
| **401 횟수** | React StrictMode + DevTools → 4회 | 동일 (개발 모드 특성) |
| **401 처리** | axios 인터셉터 자동 refresh → 200 재시도 | 동일 (정상 작동) |
| **503 원인** | httpx 봇 User-Agent → 채용사이트 403 차단 | 브라우저 User-Agent → 차단 우회 |
| **scraping 타임아웃** | 10초 | 15초 (외부 사이트 응답 여유) |
| **채용공고 자동 수집** | 대부분의 주요 사이트에서 실패 | 브라우저처럼 요청해 정상 수집 가능 |

**핵심 교훈**

1. **React 18 StrictMode 에서 `useEffect` 는 개발 모드에서 두 번 실행된다.** `accessToken` 을 localStorage에 저장하지 않는 보안 설계 + StrictMode = 콘솔에 401 노이즈가 쌓이지만, axios 인터셉터의 `isRefreshing` + `failedQueue` 패턴이 race condition을 막는다. 운영 빌드에서는 StrictMode가 비활성화되어 1회만 발생한다.
2. **외부 HTTP 요청은 반드시 브라우저 User-Agent를 흉내내야 한다.** httpx, requests, curl 등 서버 사이드 클라이언트의 기본 User-Agent는 봇 탐지 시스템에 즉시 차단된다. 특히 채용 플랫폼은 스크래핑 방지에 적극적이다.
3. **Python AI 서버 에러는 원인에 상관없이 모두 503 으로 전파된다.** Bug 3(OpenAI 응답 형식 오류) · Bug 4B(외부 URL 차단) 모두 `AiServiceException` → Spring Boot 503 경로를 거친다. 실제 원인 파악은 반드시 Python 서버 에러 로그(`ai-server-8000.err.log`)를 확인해야 한다.

---

### 재현 및 검증 방법

#### Error A (401) 검증

```
1. localStorage 에서 accessToken 항목이 없는지 확인 (없는 것이 정상)
2. 새로고침 후 채용공고 페이지 접속 → 콘솔에 401 표시 확인
3. 네트워크 탭에서 401 직후 POST /api/auth/refresh → 원본 요청 재시도 → 200 확인
4. 운영 빌드(npm run build → preview)에서는 401 1회 이하로 감소 확인
```

#### Error B (503) 검증

```
1. 수정 전 재현:
   - scraping_service.py에서 _BROWSER_HEADERS 제거 후 재시작
   - 주요 채용 사이트 URL 입력 → 503 확인

2. 수정 후 검증:
   - Python AI 서버 재시작 (브라우저 User-Agent 적용)
   - 주요 채용 사이트 URL 입력 → 200 응답 + 공고 정보 자동 추출 확인
   - ai-server-8000.out.log 에서 POST /scrape/job-posting 200 OK 확인
   - AI 수집 배지(초록) + 출처 URL이 채용공고 카드에 표시되는지 확인
```

---

## Bug 5 — 채용공고 스크래핑 정보 빈약 (SPA 렌더링 + GPT 출력 노이즈)

### 개요

| 항목 | 내용 |
|------|------|
| **현상 A** | URL로 채용공고를 가져오면 `[복지 및 혜택]` 1~2개 항목만 나오고, 주요업무·자격요건·기술스택은 전혀 추출되지 않음 |
| **현상 B** | description 카드에 `---`, `📌 출처 URL: https://...` 같은 노이즈 텍스트가 섞여 표시 |
| **영역** | Python AI 서버 (`scraping_service.py`) |
| **심각도** | 높음 — 모의면접 생성에 사용할 공고 정보가 없어 서비스 핵심 기능이 무력화됨 |

---

### 원인 A — SPA 사이트의 JavaScript 렌더링

잡코리아·사람인 등 주요 채용 플랫폼은 **SPA(Single Page Application)** 구조로 운영된다.
브라우저가 해당 URL에 접속하면 서버는 빈 HTML 껍데기만 반환하고, 실제 공고 내용은
이후 JavaScript가 API를 호출해 동적으로 채워 넣는다.

```
── httpx (기존 방식) ──────────────────────────────────
브라우저 → httpx.get(url) → 서버 응답: <div id="app"></div>
                                        ↑ JS가 아직 실행 안 된 빈 껍데기
GPT 입력: "로그인 회원가입 채용공고 ..." ← 네비게이션 텍스트뿐
결과:     [복지 및 혜택] 자기개발 지원  ← 운 좋게 정적으로 박힌 복지 1~2줄만 추출

── Playwright (신규 방식) ───────────────────────────────
브라우저 → Playwright.chromium.launch() → 실제 Chrome 헤드리스로 페이지 접속
           → JS 실행 완료(networkidle) 대기
           → 완전히 렌더링된 DOM 추출
GPT 입력: "주요업무: REST API 설계 및 유지보수, 자격요건: Java 3년 이상..."
결과:     [주요업무] [자격요건] [우대사항] [기술스택] [복지 및 혜택] 전 섹션 추출
```

---

### 원인 B — GPT 출력에 노이즈 항목 혼입

GPT에게 전달된 텍스트에 `---` 구분선, `📌 출처 URL: https://...` 같은 메타 텍스트가
포함되어 있었고, GPT가 이를 `benefits` 배열 항목으로 판단해 그대로 반환했다.
파이썬 서비스가 별도 필터링 없이 이를 description에 그대로 포맷팅했다.

---

### 과정 (수정 단계)

#### 1단계 — httpx → Playwright 교체 (`scraping_service.py`)

**수정 전**

```python
# httpx: 정적 HTML만 수집 (JS 렌더링 없음)
async with httpx.AsyncClient(timeout=15.0, headers=_BROWSER_HEADERS) as client:
    response = await client.get(url)
    response.raise_for_status()
soup = BeautifulSoup(response.text, "html.parser")
```

**수정 후**

```python
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

async def _fetch_rendered_html(url: str) -> str:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
            locale="ko-KR",
        )
        page = await context.new_page()
        try:
            # networkidle: 네트워크 요청이 500ms 없을 때까지 대기 → JS 렌더링 완료
            await page.goto(url, wait_until="networkidle", timeout=25000)
        except PlaywrightTimeoutError:
            pass  # 타임아웃 시 현재까지 로딩된 내용으로 진행
        content = await page.content()
        await browser.close()
    return content
```

#### 2단계 — JSON-LD 구조화 데이터 우선 추출 추가

SPA 사이트라도 SEO를 위해 정적 HTML 안에 `schema.org/JobPosting` 형식의
JSON-LD를 포함하는 경우가 많다. 이 데이터에는 마감일·급여·직무 설명이 구조화되어 있다.
Playwright가 JS를 실행하기 전 정적 HTML에도 들어있으므로 script 태그 제거 전에 먼저 추출한다.

```python
def _extract_json_ld(soup: BeautifulSoup) -> Optional[str]:
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, list):
                data = next(
                    (d for d in data if isinstance(d, dict) and d.get("@type") == "JobPosting"),
                    None,
                )
            if data and data.get("@type") == "JobPosting":
                return json.dumps(data, ensure_ascii=False)
        except (json.JSONDecodeError, AttributeError):
            continue
    return None
```

GPT에게 전달하는 content를 JSON-LD + 본문 텍스트로 구성:

```python
if json_ld_content:
    full_content = (
        f"[구조화 데이터 JSON-LD]\n{json_ld_content[:3000]}\n\n"
        f"[본문 텍스트]\n{clean_content[:5000]}"
    )
else:
    full_content = clean_content
```

#### 3단계 — 노이즈 항목 필터링 (`_is_valid_item`)

```python
def _is_valid_item(item: str) -> bool:
    stripped = item.strip()
    if len(stripped) < 2:
        return False
    if stripped in ("---", "--", "-", "—"):          # 구분선 제거
        return False
    if "http://" in stripped or "https://" in stripped:  # URL 포함 항목 제거
        return False
    if any(ch in stripped for ch in ("📌", "🔗", "📎")):  # 이모지 메타 항목 제거
        return False
    return True
```

#### 4단계 — 프론트엔드 카드 표시 개선 (`JobPostingPage.jsx`)

**마감일 D-Day 뱃지 추가**

```jsx
function DueDateBadge({ dueDate }) {
  const diffDays = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
  // D-7 이하 → 빨간색, D-14 이하 → 주황색, 그 외 → 파란색
  return <span className={...}>마감 D-{diffDays} ({dueDate})</span>;
}
```

**섹션 헤더 강조 렌더링**

```jsx
// [주요업무], [자격요건] 등 [섹션] 패턴을 굵은 글씨로 강조
function renderDescription(text) {
  return text.split('\n').map((line, i) =>
    /^\[.+\]$/.test(line.trim())
      ? <p key={i} className="font-semibold text-mentor-text">{line}</p>
      : <p key={i} className="whitespace-pre-wrap text-mentor-muted">{line}</p>
  );
}
```

---

### 결과 (Result)

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| **HTML 수집 방식** | httpx (정적 HTML) | Playwright 헤드리스 Chrome (JS 렌더링 완료) |
| **SPA 사이트 본문** | 빈 껍데기 → GPT 추출 불가 | 완전 렌더링된 DOM → 모든 섹션 추출 |
| **JSON-LD 활용** | 없음 | `schema.org/JobPosting` 구조화 데이터 우선 추출 |
| **GPT 입력 텍스트** | 네비게이션·복지 텍스트 수백 자 | 실제 공고 본문 최대 8,000자 |
| **노이즈 필터링** | 없음 | `---`, URL 포함 항목, 이모지 메타 텍스트 제거 |
| **마감일 표시** | 없음 | D-Day 색상 뱃지 (D-7 빨강 / D-14 주황 / 그 외 파랑) |
| **description 렌더링** | `whitespace-pre-wrap` 단순 텍스트 | 섹션 헤더 굵게 강조 |

**핵심 교훈**

1. **httpx로 SPA 사이트를 스크래핑하는 것은 근본적으로 불가능하다.** Playwright 같은 헤드리스 브라우저만이 JavaScript 렌더링 후 DOM을 제공한다. GPT 모델을 아무리 고성능으로 바꿔도 입력 데이터 자체가 없으면 출력이 나올 수 없다 — "Garbage In, Garbage Out".

2. **LLM 출력은 반드시 후처리 필터링이 필요하다.** GPT는 입력 텍스트에 포함된 모든 내용을 "그럴듯한 데이터"로 분류하려 한다. URL, 구분선, 이모지 메타 텍스트가 입력에 섞이면 아무리 프롬프트를 잘 써도 출력에 나타날 수 있다.

3. **JSON-LD는 SPA 사이트 스크래핑의 우회로다.** React/Vue SPA라도 SEO 목적으로 서버 사이드 렌더링되는 `<script type="application/ld+json">` 에 구조화된 데이터를 포함하는 경우가 많다. JS 실행 전 정적 HTML에서 이를 먼저 추출하면 Playwright 이전에도 일부 정보를 얻을 수 있다.

---

### 재현 및 검증 방법

```
1. 설치:
   .venv313\Scripts\pip install playwright
   .venv313\Scripts\python -m playwright install chromium

2. 수정 전 재현 (httpx 방식):
   scraping_service.py의 _fetch_rendered_html을 httpx.get()으로 교체
   → 잡코리아 URL 입력 → [복지 및 혜택] 1~2줄만 추출 확인

3. 수정 후 검증:
   → 잡코리아/사람인 URL 입력
   → [주요업무] [자격요건] [우대사항] [기술스택] [복지 및 혜택] 전 섹션 표시 확인
   → 마감일 D-Day 뱃지 표시 확인
   → ai-server-8000.out.log에서 playwright 렌더링 로그 확인
```

---

## Bug 6 — Playwright `NotImplementedError` → `ThreadPoolExecutor` 분리로 해결 (Windows asyncio 이벤트 루프 충돌)

### 개요

| 항목 | 내용 |
|------|------|
| **현상** | Playwright 도입 후 채용공고 URL 스크래핑 시 503 에러 지속 발생 |
| **에러 메시지** | `asyncio.base_events.NotImplementedError` in `_make_subprocess_transport` |
| **영역** | Python AI 서버 (`scraping_service.py`) |
| **환경** | Windows + uvicorn + Python 3.13 |
| **심각도** | 치명 — Playwright 기반 스크래핑 전혀 동작 안 함 |

---

### 원인

Python asyncio는 Windows에서 두 가지 이벤트 루프 구현을 제공한다.

| 이벤트 루프 | subprocess 지원 | 비고 |
|---|---|---|
| `SelectorEventLoop` | ❌ 불가 | uvicorn Windows 기본값 |
| `ProactorEventLoop` | ✅ 가능 | subprocess 실행 가능 |

uvicorn이 `SelectorEventLoop`으로 이미 실행 중인 상태에서 Playwright가
Chromium 프로세스(`asyncio.create_subprocess_exec`)를 생성하려 하면 `NotImplementedError`가 발생한다.

```
uvicorn (SelectorEventLoop, 이미 실행 중)
  └─ 요청 처리 중 Playwright 호출
     └─ chromium.exe 프로세스 생성 시도
        └─ SelectorEventLoop.subprocess_exec() → NotImplementedError ❌
```

---

### 과정 — 두 단계 디버깅

#### 1차 시도 — `main.py`에서 이벤트 루프 정책 변경 (실패)

처음에는 `main.py` 최상단에서 이벤트 루프 정책을 바꾸면 해결될 것으로 판단했다.

```python
# main.py 최상단 (1차 시도)
import asyncio, sys
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
```

**결과: 여전히 503** — uvicorn은 자체적으로 이벤트 루프를 만들고 관리하는데,
`set_event_loop_policy`가 `main.py` 임포트 시점에 실행되더라도
uvicorn 내부에서 루프를 교체하지 않는 경우가 있었다.
독립 스크립트(`asyncio.run()`)에서는 정상 동작하지만,
이미 실행 중인 uvicorn 루프 안에서는 효과가 없었다.

#### 2차 시도 — `ThreadPoolExecutor`로 완전 분리 (성공)

uvicorn 이벤트 루프를 건드리지 않고, Playwright만 **별도 스레드의 새 이벤트 루프**에서 실행한다.

**수정 전**

```python
# scraping_service.py
async def _fetch_rendered_html(url: str) -> str:
    async with async_playwright() as pw:  # uvicorn 루프에서 직접 실행 → ❌
        browser = await pw.chromium.launch(...)
        ...
```

**수정 후**

```python
# scraping_service.py
from concurrent.futures import ThreadPoolExecutor

_playwright_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="playwright")

def _run_playwright_sync(url: str) -> str:
    """별도 스레드에서 새 이벤트 루프 생성 → Playwright 실행"""
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    loop = asyncio.new_event_loop()      # uvicorn 루프와 완전히 독립된 새 루프
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_playwright_task(url))
    finally:
        loop.close()

async def _fetch_rendered_html(url: str) -> str:
    """uvicorn 이벤트 루프를 차단하지 않고 executor에서 실행"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_playwright_executor, _run_playwright_sync, url)
```

**핵심 구조**

```
uvicorn 이벤트 루프 (SelectorEventLoop) ← 건드리지 않음
  └─ await run_in_executor(playwright_executor, ...)
     └─ ThreadPoolExecutor → 새 스레드
        └─ 새 이벤트 루프 생성 (ProactorEventLoop) ← subprocess 지원 ✅
           └─ Playwright → chromium.exe 실행 성공 ✅
```

---

### 결과

| 항목 | 1차 시도 | 2차 시도 (최종) |
|------|---------|---------|
| **방법** | `main.py` 정책 변경 | `ThreadPoolExecutor` 분리 |
| **uvicorn 루프** | 교체 시도 (실패) | 건드리지 않음 |
| **Playwright 루프** | uvicorn 루프 공유 | 독립 스레드의 새 루프 |
| **결과** | 여전히 503 | Chromium 정상 실행 → 200 |

**핵심 교훈**

1. **`set_event_loop_policy`는 새로 생성되는 루프에만 적용된다.** 이미 실행 중인 uvicorn 루프에는 소급 적용되지 않는다. 독립 스크립트에서는 작동하지만 웹 프레임워크 내부에서는 효과가 없을 수 있다.

2. **subprocess가 필요한 라이브러리는 별도 스레드로 격리하는 것이 가장 안전하다.** `ThreadPoolExecutor` + `asyncio.new_event_loop()` 패턴은 이벤트 루프 충돌을 근본적으로 차단한다. Windows뿐 아니라 다른 환경에서도 동일하게 동작한다.

3. **"독립 테스트는 성공, 서버에서는 실패"는 이벤트 루프 컨텍스트 차이가 원인일 가능성이 높다.** `asyncio.run()`(독립)과 uvicorn 내부 루프는 완전히 다른 환경이다.

---

### 재현 및 검증 방법

```
1. 재현:
   scraping_service.py에서 ThreadPoolExecutor 제거, async_playwright 직접 호출로 되돌림
   → uvicorn 재시작 → 채용공고 URL 입력 → 503 확인

2. 검증:
   ThreadPoolExecutor 패턴 적용 후 uvicorn 재시작
   → 채용공고 URL 입력 (5~15초 대기, Chromium 실행 중)
   → 공고 주요업무·자격요건·기술스택·마감일 전 섹션 추출 확인
   → ai-server-8000.out.log: POST /scrape/job-posting 200 OK 확인
```

---

## Bug 7 — 학습 선택 화면에서 과목이 앱 재시작마다 9개씩 무한 중복 추가

### 개요

| 항목 | 내용 |
|------|------|
| **현상** | 학습 설정 페이지에서 Java·Spring Boot 등 동일한 과목이 수십 개씩 중복 표시되고, 앱을 재시작할 때마다 9개씩 계속 늘어남 |
| **영역** | 백엔드 — `LearningSubjectEntity` 엔티티 + `data.sql` 시드 데이터 + `application.yml` SQL 초기화 설정 |
| **심각도** | 높음 — 학습 과목 선택 UI가 완전히 망가지고, 쌓인 중복 데이터가 통계와 추천 결과에도 영향을 줌 |

---

### 원인 (Why)

세 가지 설정이 맞물려 버그가 발생했다.

**① `application.yml` — SQL 초기화 모드 `always`**

```yaml
# application.yml
spring:
  sql:
    init:
      mode: ${SQL_INIT_MODE:always}   # ← 애플리케이션 시작마다 data.sql 실행
```

`always` 설정은 개발 편의를 위해 애플리케이션이 올라올 때마다 `data.sql`을 실행한다.

**② `data.sql` — `INSERT IGNORE` 사용**

```sql
-- data.sql
INSERT IGNORE INTO learning_subjects (name, description, created_at, updated_at) VALUES
  ('Java',         'JVM 동작 원리 ...', NOW(), NOW()),
  ('Spring Boot',  'DI/IoC ...', NOW(), NOW()),
  -- (9개 과목 모두)
```

`INSERT IGNORE`는 MariaDB에서 UNIQUE 제약 조건 위반이 발생했을 때 해당 행을 건너뛰는 문법이다.
**"UNIQUE 제약 조건 위반"이 없으면 아무것도 무시하지 않고 그냥 삽입한다.**

**③ `LearningSubjectEntity` — `name` 컬럼에 `unique` 없음**

```java
// LearningSubjectEntity.java — 수정 전
@Column(nullable = false)   // unique = true 없음!
private String name;
```

`name` 컬럼에 UNIQUE 제약 조건이 없으므로, MariaDB는 `INSERT IGNORE`를 실행할 때 위반 여부를 판단할 기준이 없다.
결과적으로 `INSERT IGNORE`가 아무것도 무시하지 않고 매 실행마다 9개 행을 정상 삽입한다.

**버그 발생 흐름:**

```
앱 시작 1회 → data.sql 실행 → 9개 삽입 (총 9개)
앱 시작 2회 → data.sql 실행 → INSERT IGNORE, 하지만 unique 없음 → 9개 또 삽입 (총 18개)
앱 시작 N회 → 9 × N개 누적
```

---

### 발견 경위 (When · Where)

학습 설정 페이지(`/learning`)에 접속했을 때 과목 선택 그리드에 동일한 이름의 카드가 수십 개 표시되는 것을 확인했다.
처음에는 프론트엔드 `useEffect`의 이중 실행(React StrictMode)을 의심했으나,
`setSubjects(…)` 가 항상 새 배열로 **교체**하는 방식이라 프론트가 원인일 수 없었다.
백엔드 `GET /api/learning/subjects` 응답 JSON을 직접 확인했더니 중복 과목이 이미 DB에 저장되어 있었다.

---

### 해결 과정 (How)

**1단계 — 프론트엔드 원인 배제**

```js
// LearningPage.jsx — 과목 조회 useEffect
useEffect(() => {
  Promise.allSettled([learningApi.getSubjects(), ...])
    .then(([subjectResult]) => {
      if (subjectResult.status === 'fulfilled') {
        setSubjects(subjectResult.value.data.data ?? []);  // ← 교체, 누적 아님
      }
    });
}, []);
```

`setSubjects`는 이전 값과 관계없이 API 응답으로 **완전히 교체**한다.
StrictMode 이중 실행이 있더라도 동일한 배열로 두 번 set될 뿐이므로 프론트 문제가 아님을 확인했다.

**2단계 — 백엔드 API 직접 호출로 DB 상태 확인**

```
GET /api/learning/subjects

응답:
[
  { "id": 1, "name": "Java" },
  { "id": 2, "name": "Spring Boot" },
  ...
  { "id": 10, "name": "Java" },   ← 재시작 후 중복 삽입된 행
  { "id": 11, "name": "Spring Boot" },
  ...
]
```

중복이 DB 수준에서 이미 저장되어 있음을 확인했다.

**3단계 — `data.sql`과 `application.yml` 검토**

`sql.init.mode: always`로 인해 `data.sql`이 매 시작마다 실행되고 있었다.
`INSERT IGNORE` 주석에 "중복 삽입 방지"라고 명시되어 있었지만 실제로는 동작하지 않았다.

**4단계 — `INSERT IGNORE`의 동작 조건 파악**

MariaDB 공식 문서 확인:
> `INSERT IGNORE` skips rows that would cause a duplicate-key error **only when a UNIQUE or PRIMARY KEY constraint exists**.

`learning_subjects.name`에 UNIQUE 인덱스가 없었으므로 `INSERT IGNORE`는 일반 `INSERT`와 동일하게 동작했다.

**5단계 — 수정 적용**

`LearningSubjectEntity.name`에 `unique = true` 추가 → Hibernate의 `ddl-auto: update`가 다음 시작 시 `learning_subjects.name` 컬럼에 UNIQUE 인덱스를 자동 생성 → 이후 `INSERT IGNORE`가 정상적으로 중복을 건너뜀.

---

### 수정 전/후 코드

**`LearningSubjectEntity.java`**

```java
// ── 수정 전 ──────────────────────────────────────────────────
/**
 * 화면과 문제 생성 프롬프트에 사용하는 과목 이름입니다.
 */
@Column(nullable = false)          // unique = true 없음 → INSERT IGNORE 무효
private String name;


// ── 수정 후 ──────────────────────────────────────────────────
/**
 * 화면과 문제 생성 프롬프트에 사용하는 과목 이름입니다.
 *
 * [unique = true 이유]
 * data.sql의 INSERT IGNORE는 UNIQUE 제약 조건 위반이 발생할 때만 중복을 건너뜁니다.
 * unique 없이 INSERT IGNORE를 사용하면 제약 조건이 없으므로
 * 매 애플리케이션 시작마다 9개 과목이 그대로 삽입되어 무한 중복이 발생합니다.
 */
@Column(nullable = false, unique = true)   // ← 추가
private String name;
```

**변경 범위:** 1줄 (`unique = true` 추가) — `data.sql`, `application.yml` 수정 없음

---

### 데이터 정리 방법

`unique = true`를 적용하기 전에 DB에 중복 행이 이미 누적된 경우, Hibernate가 UNIQUE 인덱스 생성에 실패할 수 있다.
아래 SQL로 중복을 먼저 정리한 뒤 앱을 재시작해야 한다.

```sql
-- 과목명이 같은 행 중 id가 가장 작은 행(원본)만 남기고 나머지 삭제
DELETE FROM learning_subjects
WHERE id NOT IN (
  SELECT min_id FROM (
    SELECT MIN(id) AS min_id
    FROM learning_subjects
    GROUP BY name
  ) AS tmp
);
```

---

### 결과

| 항목 | 내용 |
|------|------|
| **수정 파일** | `LearningSubjectEntity.java` 1줄 변경 |
| **효과** | 앱 재시작 후 UNIQUE 인덱스 자동 생성 → `INSERT IGNORE`가 중복 과목명을 올바르게 건너뜀 |
| **재현 불가 확인** | 앱 3회 재시작 후 `/api/learning/subjects` 응답 항상 9개 |
| **부수 효과 없음** | 기존 과목 조회·문제 생성·통계 API 모두 정상 동작 |

---

### 배운 점

1. **`INSERT IGNORE`는 UNIQUE 제약 조건이 없으면 일반 INSERT와 동일하다.** 중복 방지 의도를 코드 주석에만 남기는 것만으로는 부족하고, 반드시 DB 수준의 제약 조건이 함께 있어야 한다.

2. **`spring.sql.init.mode=always`는 개발 환경 전용이다.** 시드 데이터의 멱등성(idempotent)을 보장하지 않으면 재시작할 때마다 데이터가 늘어나는 문제가 생긴다.

3. **"프론트엔드에서 데이터가 늘어난다"는 현상은 백엔드 DB 상태를 API로 직접 확인하면 원인 레이어를 빠르게 좁힐 수 있다.** 이번에는 API 응답 JSON 하나로 프론트 원인을 10초 만에 배제했다.

---

### 재현 및 검증 방법

```
1. 재현:
   LearningSubjectEntity.name에서 unique = true 제거
   → 앱 재시작 2회
   → GET /api/learning/subjects 호출 → 과목 18개 확인

2. 검증:
   unique = true 추가 후 DB 중복 정리 SQL 실행
   → 앱 재시작
   → Hibernate 로그에서 "alter table learning_subjects add constraint UK_... unique (name)" 확인
   → GET /api/learning/subjects 호출 → 과목 9개 유지 확인
   → 앱 3회 추가 재시작 후에도 9개 유지 확인
```

---

## Bug 8 — 학습 답안 제출 시 에러 발생 (프론트-백엔드 필드명 불일치)

### 개요

| 항목 | 내용 |
|------|------|
| **현상** | 학습 문제를 풀고 "제출하기" 버튼을 누르면 채점이 실패하고 에러 메시지가 표시됨 |
| **영역** | 프론트엔드 — `LearningSessionPage.jsx` (API 응답 필드명과 사용 필드명 불일치) |
| **심각도** | 치명적 — 학습 기능 전체가 동작하지 않음 (답안 제출·채점·결과 저장 전부 불가) |

---

### 원인 (Why)

문제 생성 API 응답의 정답 필드명은 `correctAnswer`인데, 프론트엔드 코드에서 `answer`로 접근하고 있었다.

**데이터 흐름에서의 필드명 변환 과정:**

```
[Python AI 서버]                    [Spring Boot 백엔드]                   [프론트엔드]
LearningProblemItem                ProblemItem       → ProblemDto         → LearningProblemDto
  answer: str          ─JSON→       answer           → correctAnswer       → correctAnswer
                                   (Python 응답 매핑)  (내부 변환)            (최종 API 응답)
```

Python은 `answer`라는 필드명으로 응답하지만, Spring Boot의 `PythonAiService`가 이를 내부 `ProblemDto.correctAnswer`로 매핑하고, 최종적으로 프론트엔드에 `LearningProblemDto.correctAnswer`라는 이름으로 전달한다.

```java
// PythonAiService.java — Python 응답을 내부 DTO로 변환
.map(problem -> new ProblemDto(
    problem.question(),
    problem.answer(),       // ← Python의 "answer"를 ProblemDto.correctAnswer 위치에 매핑
    problem.explanation(),
    difficulty,
    problem.choices(),
    problem.type()
))

// LearningProblemDto.java — 프론트엔드에 전달하는 최종 응답
public record LearningProblemDto(
    String type,
    String question,
    List<String> choices,
    String correctAnswer,   // ← JSON 키: "correctAnswer"
    String explanation
) {}
```

그런데 프론트엔드에서는 `currentProblem.answer`로 접근했다:

```js
// LearningSessionPage.jsx — 수정 전 (4곳 전부 동일한 실수)
correctAnswer: currentProblem.answer,   // ← undefined!
```

JavaScript에서 존재하지 않는 프로퍼티에 접근하면 `undefined`가 반환되고, `JSON.stringify()`는 값이 `undefined`인 키를 JSON 문자열에서 아예 제거한다.

**결과적으로 발생하는 연쇄 오류:**

```
1. 프론트 → 백엔드:  correctAnswer 필드가 JSON에서 누락
2. 백엔드 DTO:       request.correctAnswer() == null
3. 백엔드 → Python:  {"correctAnswer": null} 전송
4. Python Pydantic:   str 타입에 null 수신 → 422 Validation Error
   (또는 통과하더라도)
5. DB 저장 실패:      correct_answer 컬럼 NOT NULL 제약 위반 → 500
```

---

### 발견 경위 (When · Where)

학습 페이지에서 문제를 풀고 "제출하기" 버튼을 클릭하면 매번 채점 에러가 발생했다.
문제 표시와 답변 선택은 정상 동작하지만, 제출 시점에서만 실패하는 것이 핵심 단서였다.

---

### 해결 과정 (How)

**1단계 — 에러 발생 지점 특정**

에러가 "제출" 시점에서만 발생하므로 `handleSubmit()` 함수가 서버에 보내는 데이터를 추적했다.

```js
// LearningSessionPage.jsx — handleSubmit()
const { data } = await learningApi.submitAttempt({
  correctAnswer: currentProblem.answer,  // ← 의심 지점
  ...
});
```

**2단계 — API 응답 필드명 확인**

Spring Boot의 응답 DTO를 확인했다:

```java
// LearningProblemDto.java — 프론트에 전달하는 문제 DTO
public record LearningProblemDto(
    String type,
    String question,
    List<String> choices,
    String correctAnswer,   // ← JSON 키는 "correctAnswer"
    String explanation
) {}
```

프론트엔드가 받는 문제 객체에 `answer` 필드는 존재하지 않고, `correctAnswer` 필드가 정답을 담고 있었다.

**3단계 — Python 원본 필드명과의 차이 확인**

Python AI 서버의 문제 스키마를 확인했다:

```python
# schemas/learning.py
class LearningProblemItem(BaseModel):
    answer: str          # ← Python은 "answer"
```

Spring Boot의 내부 매핑 레코드를 확인했다:

```java
// PythonAiService 내부
private record ProblemItem(
    String answer        // ← Python JSON과 매칭
) {}
```

그리고 `PythonAiService`가 `ProblemItem.answer`를 `ProblemDto.correctAnswer`로 변환하고, `LearningService`가 이를 `LearningProblemDto.correctAnswer`로 최종 변환하는 과정을 확인했다.

**결론:** Python은 `answer`, Spring은 `correctAnswer`, 프론트엔드 코드는 `answer`로 접근 → 변환 체인 중간에서 이름이 바뀌었는데, 프론트엔드가 변환 이전의 이름을 사용하고 있었다.

**4단계 — 영향 범위 파악**

파일 내 `currentProblem.answer` 사용 위치를 전수 조사했다:

| 줄 | 코드 | 영향 |
|----|------|------|
| 162 | `correctAnswer: currentProblem.answer` | 채점 API에 정답이 `undefined`로 전달 → **서버 에러** |
| 182 | `correctAnswer: currentProblem.answer` | 결과 배열에 정답이 `undefined`로 저장 → **결과 화면 정답 미표시** |
| 362 | `choice === currentProblem.answer` | 객관식 정답 보기 강조 불가 → **정답 표시 안 됨** |
| 425 | `correctAnswer={currentProblem?.answer}` | FeedbackPopup에 정답이 전달 안 됨 → **피드백 팝업 정답 미표시** |

4곳 전부가 동일한 원인으로 깨져 있었다.

---

### 수정 전/후 코드

**`LearningSessionPage.jsx`**

```jsx
// ── 수정 전 (4곳) ────────────────────────────────────────────

// 1. 채점 API 요청 (handleSubmit)
correctAnswer: currentProblem.answer,         // → undefined → 서버 에러

// 2. 결과 배열 누적 (handleSubmit)
correctAnswer: currentProblem.answer,         // → undefined → 결과 화면 깨짐

// 3. 객관식 정답 강조 (ChoiceButton)
isCorrect={submitResult ? choice === currentProblem.answer : null}
                                               // → 항상 false

// 4. 피드백 팝업 정답 (FeedbackPopup)
correctAnswer={currentProblem?.answer}        // → undefined


// ── 수정 후 (4곳) ────────────────────────────────────────────

// 1. 채점 API 요청 (handleSubmit)
correctAnswer: currentProblem.correctAnswer,  // ✅ 실제 정답 전달

// 2. 결과 배열 누적 (handleSubmit)
correctAnswer: currentProblem.correctAnswer,  // ✅ 결과 화면 정상

// 3. 객관식 정답 강조 (ChoiceButton)
isCorrect={submitResult ? choice === currentProblem.correctAnswer : null}
                                               // ✅ 정답 보기 강조

// 4. 피드백 팝업 정답 (FeedbackPopup)
correctAnswer={currentProblem?.correctAnswer} // ✅ 팝업에 정답 표시
```

**변경 범위:** `LearningSessionPage.jsx` 4줄 — `.answer` → `.correctAnswer`

---

### 결과

| 항목 | 내용 |
|------|------|
| **수정 파일** | `LearningSessionPage.jsx` 4줄 변경 |
| **효과** | 채점 API에 정답이 정상 전달 → AI 채점 성공 → DB 저장 성공 → 피드백 팝업·결과 화면 모두 정상 |
| **부수 효과** | 객관식 제출 후 정답 보기 초록색 강조가 정상 작동, 피드백 팝업에 정답 텍스트 표시 |

---

### 배운 점

1. **API 응답 필드명과 사용 필드명이 다르면 `undefined`가 에러 없이 흘러간다.** JavaScript는 존재하지 않는 프로퍼티 접근을 에러로 잡지 않으므로, `answer`와 `correctAnswer`의 차이를 컴파일 타임에 발견할 수 없었다. TypeScript를 도입하면 이 유형의 버그를 빌드 시점에 차단할 수 있다.

2. **필드명이 레이어를 거칠 때 바뀌는 변환 체인은 문서화하거나 DTO 일관성을 유지해야 한다.** Python(`answer`) → Spring 내부(`correctAnswer`) → API 응답(`correctAnswer`) 과정에서 이름이 바뀌었고, 프론트엔드 개발자가 Python 쪽 이름을 사용한 것이 원인이었다.

3. **"표시는 되는데 제출만 실패"하는 패턴은 읽기/쓰기에서 사용하는 필드가 서로 다를 때 발생한다.** 문제 렌더링에는 `question`, `choices` 만 필요하지만, 제출에는 `correctAnswer`가 추가로 필요했다. 렌더링은 정상이어서 필드 불일치를 놓치기 쉬웠다.

---

### 재현 및 검증 방법

```
1. 재현:
   LearningSessionPage.jsx에서 currentProblem.correctAnswer를 currentProblem.answer로 되돌림
   → 학습 시작 → 문제 풀기 → "제출하기" 클릭
   → "채점 중 오류가 발생했습니다." 에러 표시 확인
   → 브라우저 네트워크 탭: POST /api/learning/attempts 요청 body에 correctAnswer 키 자체가 없음

2. 검증:
   correctAnswer → currentProblem.correctAnswer 수정 후
   → 학습 시작 → 문제 풀기 → "제출하기" 클릭
   → AI 채점 피드백 팝업 정상 표시 확인
   → 객관식: 정답 보기 초록색 강조 확인
   → 피드백 팝업에 정답 텍스트 표시 확인
   → 전체 문제 풀이 후 결과 화면에 정답/오답 정상 표시 확인
   → 네트워크 탭: POST /api/learning/attempts 200 OK 확인
```

---

## Bug 8 — 대시보드 위젯이 편집 모드가 아닌데도 드래그로 이동됨

### 개요

| 항목 | 내용 |
|------|------|
| **현상** | 대시보드에서 "위젯 배치 편집" 버튼을 누르지 않아도 위젯을 마우스로 드래그하면 위치가 바뀜. 사용 중 실수로 위젯이 계속 이동되어 레이아웃이 망가지는 UX 문제 |
| **영역** | 프론트엔드 (`DashboardPage.jsx`, react-grid-layout v2.2.2) |
| **심각도** | 중간 — 기능 동작에는 문제 없으나, 사용자 경험을 심각하게 해침 |

---

### 원인 (Why · Who)

`react-grid-layout` v2.x에서 `ResponsiveGridLayout`의 `isDraggable={false}` prop만으로는 드래그가 완전히 차단되지 않는 버그가 있다.

**원인 분석 — 3가지 허점:**

1. **`isDraggable={false}` 무시 현상**: `draggableHandle` prop이 함께 설정되어 있으면, 라이브러리 내부에서 핸들 요소에 이벤트 리스너가 등록되며 `isDraggable` 체크를 우회하는 경우가 발생
2. **localStorage 레이아웃 오염**: `onLayoutChange` 콜백이 레이아웃을 저장할 때, react-grid-layout이 내부적으로 추가하는 `isDraggable: true` 등의 속성이 개별 아이템에 함께 저장됨. 이후 이 값을 불러오면 그리드 레벨 `isDraggable={false}`보다 아이템 레벨 설정이 우선 적용됨
3. **핸들 클래스 상시 존재**: `widget-drag-handle` CSS 클래스가 편집 모드와 무관하게 항상 DOM에 존재하여, `draggableHandle=".widget-drag-handle"` 셀렉터가 항상 매칭됨

```
[사용자 마우스 드래그]
    ↓
[react-grid-layout] draggableHandle=".widget-drag-handle" 매칭 ✓
    ↓
[아이템 레벨] isDraggable: true (localStorage에서 복원)
    ↓  ← 그리드 레벨 isDraggable={false} 무시됨
[드래그 이벤트 발생] → 위젯 이동 ← 버그
```

---

### 과정 (When · Where · How)

#### 1단계 — 첫 번째 시도: `isDraggable={false}` (실패)

기존 코드에 이미 `isDraggable={editMode}`와 `isResizable={editMode}`가 설정되어 있었으나 동작하지 않았다.

**수정 전 — `DashboardPage.jsx` (버그 상태)**

```jsx
<ResponsiveGridLayout
  layouts={layouts}
  draggableHandle=".widget-drag-handle"
  isResizable={editMode}
  isDraggable={editMode}
>
```

```jsx
// DraggableWidgetWrapper — 핸들 클래스가 항상 존재
<div className="widget-drag-handle flex shrink-0 items-center ...">
```

→ `isDraggable={false}`임에도 위젯이 여전히 드래그됨.

---

#### 2단계 — 두 번째 시도: 핸들 클래스 조건부 적용 + 셀렉터 무효화 (실패)

핸들 CSS 클래스를 `editMode`일 때만 부여하고, `draggableHandle`도 조건부로 설정했다.

```jsx
// 핸들 클래스를 editMode일 때만 부여
<div className={`${editMode ? 'widget-drag-handle' : ''} flex ...`}>

// 셀렉터도 editMode에 따라 분기
draggableHandle={editMode ? '.widget-drag-handle' : '.no-drag-disabled'}
```

→ 일부 환경에서 여전히 드래그됨. localStorage에 저장된 개별 아이템의 `isDraggable` 속성이 그리드 레벨 설정을 override하는 것이 근본 원인.

---

#### 3단계 — 최종 해결: `static: true` 강제 잠금 (성공)

react-grid-layout에서 `static: true`인 아이템은 **어떤 상황에서도** 이동·리사이즈가 불가능하다. 이것은 라이브러리의 최우선 규칙이므로, 다른 속성이나 이벤트 리스너로 우회할 수 없다.

**수정 후 — `DashboardPage.jsx` (최종)**

```jsx
// 1. useMemo import 추가
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// 2. 편집 모드 아닐 때 모든 아이템을 static: true로 잠금
const effectiveLayouts = useMemo(() => {
  if (editMode) return layouts;
  const locked = {};
  for (const bp of Object.keys(layouts)) {
    locked[bp] = (layouts[bp] || []).map((item) => ({ ...item, static: true }));
  }
  return locked;
}, [layouts, editMode]);

// 3. onLayoutChange에서 static 플래그를 제거한 원본만 저장
const handleLayoutChange = useCallback((_current, allLayouts) => {
  const cleaned = {};
  for (const bp of Object.keys(allLayouts)) {
    cleaned[bp] = (allLayouts[bp] || []).map(({ static: _s, ...rest }) => rest);
  }
  setLayouts(cleaned);
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(cleaned));
  } catch { /* localStorage 용량 초과 시 무시 */ }
}, []);

// 4. 그리드에 effectiveLayouts 전달 + 3중 잠금 유지
<ResponsiveGridLayout
  layouts={effectiveLayouts}
  draggableHandle={editMode ? '.widget-drag-handle' : '.no-drag-disabled'}
  isResizable={editMode}
  isDraggable={editMode}
>
```

**3중 잠금 구조:**

| 계층 | 설정 | 역할 |
|------|------|------|
| 아이템 레벨 | `static: true` | 최우선 규칙 — 이동·리사이즈 완전 차단 |
| 그리드 레벨 | `isDraggable={false}` | 기본 드래그 비활성화 |
| 셀렉터 레벨 | `draggableHandle='.no-drag-disabled'` | 매칭되는 핸들 없음 |

---

### 결과 (Result)

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| 일반 모드 | 위젯 드래그 가능 (의도하지 않은 이동 발생) | 위젯 완전 잠금 — 클릭·드래그 무반응 |
| 편집 모드 | 위젯 드래그·리사이즈 가능 | 동일 — 핸들 영역으로 드래그, 모서리로 리사이즈 |
| localStorage | `isDraggable: true` 등 내부 속성이 함께 저장 | `static` 플래그 제거 후 클린 저장 |

---

### 교훈

1. **라이브러리 prop을 맹신하지 말 것**: `isDraggable={false}`가 동작하지 않을 수 있다. 특히 `draggableHandle`과 조합될 때, localStorage에서 복원한 개별 아이템 속성이 그리드 레벨 prop을 override할 수 있다.
2. **`static: true`는 react-grid-layout의 절대적 잠금**: 다른 어떤 속성보다 우선하므로, 확실한 잠금이 필요할 때는 `static`을 사용해야 한다.
3. **저장 시 라이브러리 내부 속성 정리**: `onLayoutChange` 콜백에서 `static`, `isDraggable` 등 런타임 전용 속성을 strip한 후 저장해야 다음 로드 시 의도하지 않은 동작을 방지할 수 있다.

---

### 검증 방법

```
1. 대시보드 접속 → 위젯을 마우스로 드래그 시도 → 이동 안 됨 확인
2. "위젯 배치 편집" 클릭 → 위젯 헤더(핸들) 드래그 → 정상 이동 확인
3. "편집 완료" 클릭 → 다시 드래그 시도 → 이동 안 됨 확인
4. 새로고침 후 → 레이아웃 유지 + 드래그 여전히 안 됨 확인
5. 브라우저 DevTools → Application → localStorage → dashboard-widget-layout 값에 "static" 키가 없음 확인
```
