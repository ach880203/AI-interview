# 대시보드 위젯 8종 구현 계획

> 작성일: 2026-03-25
> 대상 파일: `frontend/src/pages/DashboardPage.jsx` (메인) + API 파일
> 차트 라이브러리: Recharts v3.8.0 (이미 설치됨)

---

## 목차

1. [현재 상태 파악](#현재-상태-파악)
2. [위젯 8종 상세 설계](#위젯-8종-상세-설계)
3. [구현 순서 및 의존관계](#구현-순서-및-의존관계)
4. [DashboardPage.jsx 수정 범위](#dashboardpagejsx-수정-범위)
5. [백엔드 수정 필요 여부](#백엔드-수정-필요-여부)

---

## 현재 상태 파악

### 기존 위젯 6개

| id | 제목 | removable | 데이터 소스 |
|----|------|-----------|-------------|
| `stats` | 통계 요약 | false | profile + interview + learning API |
| `dday` | D-Day | true | jobPostings (dueDate) |
| `feedback` | 최근 면접 결과 | true | getFeedback() |
| `sessions` | 최근 면접 기록 | true | getSessions() |
| `weakness` | 학습 약점 요약 | true | getAnalytics() |
| `recent-learning` | 최근 학습 기록 | true | getStats().recentAttempts |

### 기존 데이터 fetch (useEffect)

```
현재 Promise.allSettled로 병렬 호출하는 API:
1. profileApi.getResumes()
2. profileApi.getCoverLetters()
3. profileApi.getJobPostings()
4. interviewApi.getSessions()
5. learningApi.getStats()
6. learningApi.getAnalytics()
+ 후속: interviewApi.getFeedback(latestSessionId)
```

### 그리드 설정

```
breakpoints: { lg: 1200, md: 996, sm: 0 }
cols:        { lg: 12,   md: 10,  sm: 6 }
rowHeight:   60px
margin:      [16, 16]
```

---

## 위젯 8종 상세 설계

---

### 위젯 1. 면접 점수 추이 차트

| 항목 | 내용 |
|------|------|
| **id** | `score-trend` |
| **제목** | 면접 점수 추이 |
| **removable** | true |
| **차트** | Recharts `LineChart` |
| **크기 (lg)** | w: 7, h: 5, minW: 5, minH: 4 |

**필요 데이터:**
- 완료된 면접 세션 목록 → 각 세션의 `getFeedback()`에서 `overallScore` + 날짜

**데이터 흐름:**
```
기존 getSessions() 결과에서 COMPLETED 세션 필터링
→ 각 세션에 대해 getFeedback() 호출 (병렬)
→ [{ date: '03/20', score: 72 }, { date: '03/22', score: 81 }, ...]
→ LineChart에 표시
```

**추가 API 호출:**
- 완료된 세션이 N개면 getFeedback()을 N번 호출해야 함
- 성능을 위해 최근 10개 세션으로 제한
- 이미 최신 1개는 fetch하고 있으므로, 나머지 세션들의 feedback을 추가 fetch

**차트 구성:**
```jsx
<LineChart data={scoreTrendData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="date" />
  <YAxis domain={[0, 100]} />
  <Tooltip />
  <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} />
</LineChart>
```

**빈 상태:** "완료된 면접이 2개 이상이면 점수 추이를 확인할 수 있습니다."

---

### 위젯 2. 학습 정확도 추이 차트

| 항목 | 내용 |
|------|------|
| **id** | `accuracy-trend` |
| **제목** | 학습 정확도 추이 |
| **removable** | true |
| **차트** | Recharts `LineChart` (과목별 멀티 시리즈) |
| **크기 (lg)** | w: 5, h: 5, minW: 4, minH: 4 |

**필요 데이터:**
- `getAnalytics()` → categories 배열에서 과목별 accuracy
- 현재 API는 누적 통계만 제공 (시간별 추이 없음)

**현실적 접근 — 2가지 옵션:**

**옵션 A (백엔드 수정 없이):** 과목별 정확도 **막대 차트**로 변경
```
getAnalytics().categories → 과목별 accuracy를 BarChart로 표시
X축: 과목명, Y축: 정확도(%)
→ 시간 추이는 아니지만, 과목 간 비교가 한눈에 보임
```

**옵션 B (백엔드 수정 필요):** 시간별 정확도 추이 API 추가
```
GET /api/learning/analytics/trend?days=30
→ [{ date: '03/20', subjects: { 'Java': 80, 'Spring': 65 } }, ...]
→ 과목별 LineChart 멀티 시리즈
```

**권장:** 옵션 A (백엔드 수정 없이 바로 구현 가능)
- 위젯 제목을 "과목별 학습 정확도"로 조정
- 기존 `getAnalytics()` 데이터를 그대로 사용

**차트 구성 (옵션 A):**
```jsx
<BarChart data={analyticsCategories}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="name" />
  <YAxis domain={[0, 100]} />
  <Tooltip />
  <Bar dataKey="accuracy" fill="#6366f1" radius={[6, 6, 0, 0]} />
</BarChart>
```

**빈 상태:** "학습 기록이 쌓이면 과목별 정확도를 비교할 수 있습니다."

---

### 위젯 3. AI 맞춤 학습 추천 카드

| 항목 | 내용 |
|------|------|
| **id** | `recommendation` |
| **제목** | AI 학습 추천 |
| **removable** | true |
| **형태** | 카드 (차트 없음) |
| **크기 (lg)** | w: 5, h: 4, minW: 3, minH: 3 |

**필요 데이터:**
- `learningApi.getRecommendation()` → `{ subjectId, subjectName, difficulty, currentAccuracy, reason }`

**추가 API 호출:**
- `getRecommendation()` 1회 추가 (기존 useEffect에 병합)

**UI 구성:**
```
┌─────────────────────────────────────────┐
│  🎯 AI 학습 추천                         │
│                                         │
│  추천 과목:  Spring Security             │
│  현재 정확도: 42%     난이도: MEDIUM      │
│                                         │
│  💡 "정확도가 60% 미만이며 최근 시도가     │
│     적어 집중 학습이 필요합니다."          │
│                                         │
│  [ 지금 학습 시작하기 → ]                 │
└─────────────────────────────────────────┘
```

**CTA 버튼:** `/learning` 페이지로 이동 (해당 과목 선택 상태)

**빈 상태:** "학습 기록이 쌓이면 AI가 다음에 공부할 과목을 추천합니다."

---

### 위젯 4. 과목 마스터리 분포

| 항목 | 내용 |
|------|------|
| **id** | `mastery` |
| **제목** | 과목 마스터리 |
| **removable** | true |
| **차트** | Recharts `PieChart` |
| **크기 (lg)** | w: 5, h: 5, minW: 4, minH: 4 |

**필요 데이터:**
- `getAnalytics()` → categories 배열 (이미 fetch 중)

**데이터 가공:**
```javascript
// 과목별 시도 횟수를 파이 차트 데이터로 변환
const masteryData = analyticsCategories.map(cat => ({
  name: cat.name,
  value: cat.totalCount,
  accuracy: cat.accuracy,
}));
```

**차트 구성:**
```jsx
<PieChart>
  <Pie
    data={masteryData}
    dataKey="value"
    nameKey="name"
    cx="50%" cy="50%"
    innerRadius={50} outerRadius={80}  // 도넛 차트
    label={({ name, accuracy }) => `${name} ${accuracy}%`}
  >
    {masteryData.map((entry, idx) => (
      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
    ))}
  </Pie>
  <Tooltip />
  <Legend />
</PieChart>
```

**색상 팔레트:**
```javascript
const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
```

**빈 상태:** "학습 기록이 쌓이면 과목별 분포를 확인할 수 있습니다."

---

### 위젯 5. 면접 세부 역량 레이더 차트

| 항목 | 내용 |
|------|------|
| **id** | `radar` |
| **제목** | 면접 역량 분석 |
| **removable** | true |
| **차트** | Recharts `RadarChart` |
| **크기 (lg)** | w: 5, h: 5, minW: 4, minH: 4 |

**필요 데이터:**
- 모든 완료된 면접의 feedback → logicScore, relevanceScore, specificityScore 평균
- 최근 면접의 개별 점수 (비교용)

**데이터 가공:**
```javascript
// 위젯 1의 scoreTrendData에서 함께 수집 가능
const radarData = [
  { metric: '논리성',  latest: latestFeedback.logicScore,      avg: avgLogic },
  { metric: '관련성',  latest: latestFeedback.relevanceScore,  avg: avgRelevance },
  { metric: '구체성',  latest: latestFeedback.specificityScore, avg: avgSpecificity },
];
```

**차트 구성:**
```jsx
<RadarChart data={radarData}>
  <PolarGrid />
  <PolarAngleAxis dataKey="metric" />
  <PolarRadiusAxis domain={[0, 10]} />
  <Radar name="최근 면접" dataKey="latest" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
  <Radar name="전체 평균" dataKey="avg" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
  <Legend />
  <Tooltip />
</RadarChart>
```

**빈 상태:** "완료된 면접이 있으면 역량 분석이 표시됩니다."

---

### 위젯 6. 주간 학습 활동 히트맵

| 항목 | 내용 |
|------|------|
| **id** | `activity` |
| **제목** | 학습 활동 |
| **removable** | true |
| **형태** | CSS 그리드 히트맵 (외부 라이브러리 없이 직접 구현) |
| **크기 (lg)** | w: 7, h: 4, minW: 5, minH: 3 |

**필요 데이터:**
- `getStats()` → recentAttempts의 createdAt 타임스탬프
- 추가로: 전체 학습 시도 목록이 필요 (최근 30일)

**현실적 접근:**
- 현재 `getStats()`의 `recentAttempts`는 최근 몇 개만 반환
- 히트맵에 최근 4주(28일) 데이터가 필요

**옵션 A (백엔드 수정 없이):** recentAttempts의 createdAt을 요일별로 그룹핑
- 데이터가 적어도 "최근 활동한 날"을 표시하는 간이 히트맵 가능

**옵션 B (백엔드 수정):** 날짜별 학습 횟수 API 추가
```
GET /api/learning/activity?days=28
→ [{ date: '2026-03-25', count: 5 }, { date: '2026-03-24', count: 3 }, ...]
```

**권장:** 옵션 A로 우선 구현 → 이후 옵션 B로 개선

**UI 구성 (GitHub 잔디 스타일):**
```
        월  화  수  목  금  토  일
  3주전  ⬜  🟩  ⬜  🟩  🟩  ⬜  ⬜
  2주전  🟩  ⬜  🟩  ⬜  🟩  ⬜  ⬜
  1주전  🟩  🟩  🟩  ⬜  🟩  🟩  ⬜
  이번주  🟩  🟩  ⬜  ⬜  ⬜  ⬜  ⬜

  ⬜ = 0회   🟩 밝은 = 1~2회   🟩 진한 = 3회+
```

**빈 상태:** "학습 기록이 쌓이면 활동 패턴을 확인할 수 있습니다."

---

### 위젯 7. 구독 상태 + 남은 기간

| 항목 | 내용 |
|------|------|
| **id** | `subscription` |
| **제목** | 구독 상태 |
| **removable** | true |
| **형태** | 카드 + 프로그레스 바 |
| **크기 (lg)** | w: 5, h: 3, minW: 3, minH: 2 |

**필요 데이터:**
- `subscriptionApi.getMySubscription()` → `{ planName, status, startedAt, expiresAt, durationDays }`

**추가 API 호출:**
- `getMySubscription()` 1회 추가 (기존 useEffect에 병합)

**UI 구성:**
```
┌──────────────────────────────────────────┐
│  🎫 구독 상태                             │
│                                          │
│  월간 플랜 (ACTIVE)                       │
│  ████████████████░░░░  남은 18일 / 30일   │
│                                          │
│  시작: 2026-03-10   만료: 2026-04-09      │
│                                          │
│  [ 구독 관리 → ]                          │
└──────────────────────────────────────────┘
```

**상태별 분기:**
- `ACTIVE` → 남은 일수 프로그레스 바 + 만료일
- `EXPIRED` → "구독이 만료되었습니다" + 갱신 버튼
- 구독 없음 → "구독하고 모든 기능을 이용하세요" + 구독 페이지 링크

**빈 상태:** "구독하면 면접, 학습, 서점 기능을 이용할 수 있습니다." + CTA

---

### 위젯 8. 오답 노트 미리보기

| 항목 | 내용 |
|------|------|
| **id** | `wrong-notes` |
| **제목** | 오답 노트 |
| **removable** | true |
| **형태** | 카드 리스트 |
| **크기 (lg)** | w: 7, h: 5, minW: 4, minH: 3 |

**필요 데이터:**
- `learningApi.getWrongAttempts()` → 최근 틀린 문제 목록

**추가 API 호출:**
- `getWrongAttempts()` 1회 추가 (기존 useEffect에 병합)

**UI 구성:**
```
┌─────────────────────────────────────────────┐
│  📝 오답 노트                     전체 보기 →│
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ [Java] Java에서 final 키워드의 세 가지   ││
│  │ 사용처를 설명하시오.                     ││
│  │ 내 답변: 변수에만 사용...                ││
│  │ 💡 변수, 메서드, 클래스에 각각 사용...    ││
│  └─────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────┐│
│  │ [Spring] @Transactional의 전파 레벨을... ││
│  │ ...                                     ││
│  └─────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────┐│
│  │ [Network] TCP 3-way handshake를...      ││
│  │ ...                                     ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

**표시 제한:** 최근 3개 (위젯 공간 제약)
**링크:** "전체 보기" → `/learning/wrong-answers` 페이지

**빈 상태:** "틀린 문제가 없습니다. 학습을 시작해보세요!"

---

## 구현 순서 및 의존관계

### 의존관계 분석

```
추가 API 호출 없음 (기존 데이터 재활용):
  ├── 위젯 2. 과목별 학습 정확도 ← getAnalytics() (이미 fetch 중)
  └── 위젯 4. 과목 마스터리 분포 ← getAnalytics() (이미 fetch 중)

추가 API 호출 1개:
  ├── 위젯 3. AI 학습 추천      ← getRecommendation() 추가
  ├── 위젯 7. 구독 상태         ← getMySubscription() 추가
  └── 위젯 8. 오답 노트         ← getWrongAttempts() 추가

추가 API 호출 N개 (복수 feedback fetch):
  ├── 위젯 1. 면접 점수 추이    ← getFeedback() × N (최대 10개)
  └── 위젯 5. 면접 역량 레이더  ← 위젯 1과 동일 데이터 공유

독립 (추가 데이터 필요 없거나 기존 것 재활용):
  └── 위젯 6. 학습 활동 히트맵  ← getStats().recentAttempts (이미 fetch 중)
```

### 구현 순서

```
Phase 1 — 기반 작업 (모든 위젯에 영향)
  ├── DASHBOARD_WIDGETS 레지스트리에 8개 위젯 등록
  ├── DEFAULT_LAYOUTS에 14개 위젯 레이아웃 배치
  ├── useEffect에 추가 API 호출 병합
  └── dashboardData state에 새 필드 추가

Phase 2 — 기존 데이터 활용 위젯 (추가 API 없음)
  ├── 위젯 2. 과목별 학습 정확도 (BarChart)
  ├── 위젯 4. 과목 마스터리 분포 (PieChart)
  └── 위젯 6. 학습 활동 히트맵 (CSS Grid)

Phase 3 — 단일 API 추가 위젯
  ├── 위젯 3. AI 학습 추천 카드
  ├── 위젯 7. 구독 상태 카드
  └── 위젯 8. 오답 노트 미리보기

Phase 4 — 복수 API 호출 위젯
  ├── 위젯 1. 면접 점수 추이 (LineChart) + 다수 getFeedback 호출
  └── 위젯 5. 면접 역량 레이더 (RadarChart) — 위젯 1 데이터 공유
```

---

## DashboardPage.jsx 수정 범위

### 1. import 추가

```javascript
// 기존
import * as interviewApi from '../api/interview';
import * as learningApi from '../api/learning';
import * as profileApi from '../api/profile';

// 추가
import * as subscriptionApi from '../api/subscription';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
```

### 2. DASHBOARD_WIDGETS 레지스트리 확장

```javascript
const DASHBOARD_WIDGETS = [
  // 기존 6개
  { id: 'stats',           title: '통계 요약',        removable: false },
  { id: 'dday',            title: 'D-Day',             removable: true },
  { id: 'feedback',        title: '최근 면접 결과',    removable: true },
  { id: 'sessions',        title: '최근 면접 기록',    removable: true },
  { id: 'weakness',        title: '학습 약점 요약',    removable: true },
  { id: 'recent-learning', title: '최근 학습 기록',    removable: true },
  // 신규 8개
  { id: 'score-trend',     title: '면접 점수 추이',    removable: true },
  { id: 'accuracy-trend',  title: '과목별 학습 정확도', removable: true },
  { id: 'recommendation',  title: 'AI 학습 추천',      removable: true },
  { id: 'mastery',         title: '과목 마스터리',      removable: true },
  { id: 'radar',           title: '면접 역량 분석',     removable: true },
  { id: 'activity',        title: '학습 활동',          removable: true },
  { id: 'subscription',    title: '구독 상태',          removable: true },
  { id: 'wrong-notes',     title: '오답 노트',          removable: true },
];
```

### 3. DEFAULT_LAYOUTS 확장 (lg 기준)

```javascript
// 기존 6개
{ i: 'stats',           x: 0, y: 0,  w: 12, h: 3, minW: 6, minH: 2 },
{ i: 'dday',            x: 0, y: 3,  w: 7,  h: 4, minW: 4, minH: 3 },
{ i: 'subscription',    x: 7, y: 3,  w: 5,  h: 4, minW: 3, minH: 2 },  // 신규
{ i: 'feedback',        x: 0, y: 7,  w: 7,  h: 4, minW: 6, minH: 3 },
{ i: 'recommendation',  x: 7, y: 7,  w: 5,  h: 4, minW: 3, minH: 3 },  // 신규
{ i: 'score-trend',     x: 0, y: 11, w: 7,  h: 5, minW: 5, minH: 4 },  // 신규
{ i: 'radar',           x: 7, y: 11, w: 5,  h: 5, minW: 4, minH: 4 },  // 신규
{ i: 'accuracy-trend',  x: 0, y: 16, w: 7,  h: 5, minW: 4, minH: 4 },  // 신규
{ i: 'mastery',         x: 7, y: 16, w: 5,  h: 5, minW: 4, minH: 4 },  // 신규
{ i: 'sessions',        x: 0, y: 21, w: 7,  h: 6, minW: 4, minH: 4 },
{ i: 'wrong-notes',     x: 7, y: 21, w: 5,  h: 5, minW: 4, minH: 3 },  // 신규
{ i: 'weakness',        x: 0, y: 27, w: 7,  h: 6, minW: 3, minH: 3 },
{ i: 'activity',        x: 7, y: 27, w: 5,  h: 4, minW: 5, minH: 3 },  // 신규
{ i: 'recent-learning', x: 0, y: 33, w: 12, h: 5, minW: 3, minH: 3 },
```

### 4. dashboardData state 확장

```javascript
const [dashboardData, setDashboardData] = useState({
  // 기존
  resumes: [], coverLetters: [], jobPostings: [],
  sessions: [],
  learningStats: { totalAttempts: 0, correctAttempts: 0, accuracyRate: 0, subjectStats: [], recentAttempts: [] },
  analyticsCategories: [],

  // 신규
  recommendation: null,       // 위젯 3
  subscription: null,         // 위젯 7
  wrongAttempts: [],           // 위젯 8
  allFeedbacks: [],            // 위젯 1, 5 공유
});
```

### 5. useEffect 데이터 fetch 확장

```javascript
// 기존 6개 + 추가 3개 = 9개 병렬 호출
const results = await Promise.allSettled([
  profileApi.getResumes(),            // [0]
  profileApi.getCoverLetters(),       // [1]
  profileApi.getJobPostings(),        // [2]
  interviewApi.getSessions(),         // [3]
  learningApi.getStats(),             // [4]
  learningApi.getAnalytics(),         // [5]
  learningApi.getRecommendation(),    // [6] ← 신규
  subscriptionApi.getMySubscription(),// [7] ← 신규
  learningApi.getWrongAttempts(),     // [8] ← 신규
]);

// 후속: 완료된 세션 최대 10개에 대해 feedback 일괄 fetch
const completedSessions = sessions.filter(s => s.status === 'COMPLETED' && s.feedbackReady).slice(0, 10);
const feedbackResults = await Promise.allSettled(
  completedSessions.map(s => interviewApi.getFeedback(s.id))
);
// → allFeedbacks 배열로 저장 (위젯 1, 5에서 사용)
```

### 6. 새 위젯 컴포넌트 (DashboardPage.jsx 하단에 추가)

| 컴포넌트명 | 위젯 | 비고 |
|-----------|------|------|
| `ScoreTrendWidget` | 1번 | LineChart, ResponsiveContainer 사용 |
| `AccuracyBarWidget` | 2번 | BarChart, ResponsiveContainer 사용 |
| `RecommendationWidget` | 3번 | 카드형, Link 포함 |
| `MasteryPieWidget` | 4번 | PieChart (도넛), Legend 사용 |
| `RadarWidget` | 5번 | RadarChart, PolarGrid 사용 |
| `ActivityHeatmapWidget` | 6번 | CSS Grid 직접 구현 |
| `SubscriptionWidget` | 7번 | 프로그레스 바, 상태 분기 |
| `WrongNotesWidget` | 8번 | 카드 리스트, WidgetCard 패턴 |

---

## 백엔드 수정 필요 여부

| 위젯 | 백엔드 수정 | 이유 |
|------|------------|------|
| 1. 면접 점수 추이 | **불필요** | getFeedback() 반복 호출로 해결 |
| 2. 과목별 학습 정확도 | **불필요** | getAnalytics() 데이터 재활용 |
| 3. AI 학습 추천 | **불필요** | getRecommendation() API 이미 존재 |
| 4. 과목 마스터리 | **불필요** | getAnalytics() 데이터 재활용 |
| 5. 면접 역량 레이더 | **불필요** | 위젯 1과 데이터 공유 |
| 6. 학습 활동 히트맵 | **불필요** | recentAttempts 타임스탬프 활용 |
| 7. 구독 상태 | **불필요** | getMySubscription() API 이미 존재 |
| 8. 오답 노트 | **불필요** | getWrongAttempts() API 이미 존재 |

**결론: 백엔드 수정 없이 프론트엔드만으로 8개 위젯 모두 구현 가능.**

---

## 예상 변경량 요약

| 항목 | 변경량 |
|------|--------|
| DASHBOARD_WIDGETS 레지스트리 | +8개 항목 |
| DEFAULT_LAYOUTS (lg/md/sm) | +8개 × 3 브레이크포인트 = +24개 레이아웃 항목 |
| dashboardData state | +4개 필드 |
| useEffect fetch | +3개 API + 후속 feedback 일괄 fetch |
| 신규 위젯 컴포넌트 | 8개 (각 30~80줄) |
| JSX 렌더링 블록 | +8개 위젯 블록 |
| Recharts import | +15개 컴포넌트 |
| **총 추가 코드** | 약 **600~800줄** |

---

## localStorage 마이그레이션 주의

기존 사용자의 localStorage에 저장된 레이아웃에는 새 위젯이 없습니다.
`loadSavedLayouts()` 함수에서 **새 위젯이 레이아웃에 없으면 기본 위치로 추가**하는 마이그레이션 로직이 필요합니다.

```javascript
function loadSavedLayouts() {
  const saved = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY));
  if (!saved) return DEFAULT_LAYOUTS;

  // 마이그레이션: 새 위젯이 저장된 레이아웃에 없으면 기본 위치로 추가
  const allWidgetIds = DASHBOARD_WIDGETS.map(w => w.id);
  for (const bp of ['lg', 'md', 'sm']) {
    const existingIds = (saved[bp] || []).map(item => item.i);
    const missing = allWidgetIds.filter(id => !existingIds.includes(id));
    for (const id of missing) {
      const defaultItem = DEFAULT_LAYOUTS[bp]?.find(item => item.i === id);
      if (defaultItem) saved[bp].push({ ...defaultItem });
    }
  }
  return saved;
}
```
