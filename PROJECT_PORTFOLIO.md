# AI 모의 면접 플랫폼 — 포트폴리오 정리

> 신입 개발자 면접용 포트폴리오 문서입니다.
> 기술 면접에서 이 프로젝트를 설명할 때 이 문서를 기준으로 답변을 준비하세요.

---

## 1. 프로젝트 한 줄 소개

> **"취업 준비생을 위한 AI 모의 면접 + 학습 통합 플랫폼"**
> 이력서·자기소개서·채용공고를 업로드하면 GPT-4o가 맞춤 면접 질문을 음성으로 진행하고,
> 학습(영어·한국사·IT) 문제를 자동 생성·채점까지 해주는 SaaS 서비스입니다.

---

## 2. 팀 구성 & 역할

| 구성 | 내용 |
|------|------|
| 팀 규모 | 4인 협업 프로젝트 |
| 협업 방식 | GitHub (main / develop / feature/* 브랜치 전략) |
| 담당 영역 | (자신의 담당 파트를 여기에 작성하세요) |

---

## 3. 기술 스택

### 왜 이 기술을 선택했는가 (면접 단골 질문)

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| 프론트엔드 | React 19 + Vite | 컴포넌트 재사용성, Vite의 빠른 빌드 속도 |
| 상태관리 | Zustand | Redux 대비 보일러플레이트 없이 전역 상태(로그인 등) 관리 |
| 백엔드 | Spring Boot 3.4 + Java 21 | 계층형 아키텍처, JPA 자동 쿼리, 스프링 시큐리티 인증 체계 |
| 인증 | JWT (Access 30분 + Refresh 7일) | Stateless 인증 — 서버 세션 없이 수평 확장 가능 |
| AI | OpenAI GPT-4o + Whisper | 고품질 텍스트 생성, 정확도 높은 한국어 STT |
| AI 프레임워크 | FastAPI + LangChain | Python 생태계의 AI 라이브러리 활용, async 처리 |
| 벡터 DB | ChromaDB | 면접 질문 자산 재사용(RAG) — 동일 질문 반복 생성 비용 절감 |
| 데이터베이스 | MariaDB + utf8mb4 | 한글 완전 지원, InnoDB 트랜잭션 |
| 배포 | AWS EC2 + S3 + CloudFront + GitHub Actions | 정적 파일 CDN, CI/CD 자동화 |

---

## 4. 시스템 아키텍처

```
[ 브라우저 (React) ]
        │  HTTPS
        ▼
[ Spring Boot :8080 ]  ──→  [ MariaDB :3308 ]
        │  HTTP (내부망)
        ▼
[ Python FastAPI :8000 ]
        │
        ├── OpenAI GPT-4o  (질문 생성 / 피드백 / 채점)
        ├── OpenAI Whisper  (음성 → 텍스트 STT)
        └── ChromaDB  (면접 질문 벡터 자산 재사용)
```

**핵심 설계 원칙:**
- Python AI 서버(8000)는 브라우저에서 직접 호출하지 않습니다.
  Spring Boot(8080)가 내부에서 호출하고 결과를 프론트에 전달합니다.
  → **AI 서버를 외부에 노출하지 않아 보안을 강화**했습니다.

---

## 5. 핵심 기능 설명

### 5-1. AI 음성 면접 흐름 (가장 중요한 기능)

```
1.  사용자가 이력서 / 자소서 / 채용공고를 선택 → POST /api/interviews/sessions
2.  Spring Boot → Python으로 3가지 문서 내용 전달 → GPT-4o가 맞춤 첫 질문 생성
3.  브라우저 Web Speech API (SpeechSynthesis)로 질문을 음성 출력 (무료 TTS)
4.  사용자가 MediaRecorder로 답변 음성 녹음 (.webm)
5.  Spring Boot → Python으로 오디오 전달 → Whisper가 텍스트로 변환 (STT)
6.  변환된 텍스트 + 이전 Q&A 히스토리 → GPT-4o가 다음 질문 생성
7.  5 ~ 6 반복 (최대 5문항)
8.  면접 종료 → 전체 히스토리 기반 종합 피드백 생성 (5가지 점수 + 텍스트)
```

### 5-2. ChromaDB 벡터 RAG (출제 자산 재사용)

- 새로 생성된 면접 질문을 ChromaDB에 벡터로 저장합니다.
- 다음 출제 시 유사 질문을 검색하여 **재사용 1 : 신규 생성 2** 비율로 혼합합니다.
- 효과: OpenAI API 호출 횟수 감소 → **비용 절감**

### 5-3. AI 학습 시스템

- 과목별(영어 / 한국사 / IT) 시스템 프롬프트를 분리하여 전문성 유지
- 객관식 / 단답형 / MIX 출제 지원
- 사용자 정답률을 프롬프트에 반영하여 **적응형 난이도** 조정

### 5-4. 도서 판매 + 주문 / 결제

- 장바구니 → 주문 → PortOne 결제 연동 흐름
- 관리자 페이지: 회원 관리, 재고 관리, 주문 현황, 대시보드 통계

---

## 6. 백엔드 아키텍처 설명

### 패키지 구조 (도메인 주도 설계)

```
com.aimentor
├── common          ← ApiResponse, GlobalExceptionHandler, BaseTimeEntity
├── domain
│   ├── user        ← 회원가입, 로그인, JWT 발급
│   ├── profile     ← 이력서, 자기소개서, 채용공고
│   ├── interview   ← 면접 세션, Q&A, 피드백
│   ├── learning    ← 과목, 문제, 풀이 기록
│   └── book        ← 도서, 장바구니, 주문
└── external
    ├── ai          ← Python AI 서버 통신 (인터페이스 + 구현체)
    └── speech      ← STT 서비스
```

### 공통 응답 형식 (모든 API 동일)

```json
// 성공
{ "success": true,  "data": { ... } }

// 실패
{ "success": false, "error": { "code": "EXPIRED_TOKEN", "message": "토큰이 만료되었습니다." } }
```

### 전역 예외 처리 (GlobalExceptionHandler)

모든 예외를 한 곳에서 처리합니다.
- `BusinessException` → 4xx (비즈니스 로직 오류)
- `AiServiceException` → 503 (Python AI 서버 장애)
- 그 외 `Exception` → 500

---

## 7. 기술적 도전과 해결 방법 (면접 핵심 질문)

### 도전 1 — 한글 인코딩 문제
- **문제**: MariaDB에 한글 저장 시 `?`로 깨지는 현상
- **원인**: JDBC URL에 `characterEncoding=UTF-8`만 있으면 Java↔JDBC 레이어만 UTF-8이고, MariaDB 세션 charset은 서버 기본값(latin1)이 유지됨
- **해결**: JDBC URL에 `connectionCollation=utf8mb4_unicode_ci` 추가 + `connection-init-sql: "SET NAMES utf8mb4"` 설정

### 도전 2 — Python 중복 함수 버그
- **문제**: Python에서 같은 이름의 함수가 두 번 정의되면 마지막 정의만 살아남음
- **원인**: `interview_service.py`에 `generate_interview_question`이 두 번 정의되어 RAG 재사용 로직이 통째로 무시됨
- **해결**: 첫 번째(사용되지 않는) 함수 제거, 두 번째(RAG 포함 실제 사용) 함수만 유지

### 도전 3 — DB 스키마 불일치로 인한 500 에러
- **문제**: `POST /api/interviews/sessions` 호출 시 Spring Boot 500 에러
- **원인**: `interview_sessions` 테이블의 `position_title NOT NULL` 컬럼이 `InterviewSessionEntity`에 누락 → Hibernate INSERT 시 컬럼 생략 → MariaDB 에러 1364
- **해결**: `InterviewSessionEntity`에 `@Builder.Default private String positionTitle = ""` 필드 추가 → INSERT에 빈 문자열 포함되어 NOT NULL 제약 충족

### 도전 4 — AI 서버 비용 최적화
- **문제**: 면접 질문 매번 GPT-4o로 생성 시 API 비용 증가
- **해결**: ChromaDB로 생성된 질문을 벡터 저장 → 유사도 검색으로 재사용 (1/3은 재사용, 2/3은 신규 생성)

---

## 8. 테스트 전략

Spring Boot 통합 테스트를 실제 DB와 연결하여 작성했습니다.

| 테스트 파일 | 검증 내용 |
|------------|----------|
| `AuthFlowTest` | 회원가입 → 로그인 → 토큰 갱신 전체 흐름 |
| `InterviewFlowTest` | 세션 시작 → 답변 제출 → 종료 → 피드백 조회 |
| `InterviewOwnershipTest` | 다른 사용자의 세션에 접근 시 403 반환 |
| `LearningGradeTest` | AI 채점 응답 구조 검증 |
| `OrderFlowTest` | 장바구니 → 주문 → 결제 흐름 |
| `SecurityAccessTest` | 인증 없이 보호된 API 접근 시 401 반환 |
| `SubscriptionFlowTest` | 구독 생성 → 상태 조회 흐름 |

---

## 9. 주요 API 요약

### 인증
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/register | 회원가입 |
| POST | /api/auth/login | 로그인 (토큰 반환) |
| POST | /api/auth/refresh | 액세스 토큰 재발급 |
| POST | /api/auth/logout | 로그아웃 🔒 |

### 면접
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/interviews/sessions | 면접 세션 시작 + 첫 질문 반환 🔒 |
| POST | /api/interviews/sessions/{id}/answer | 답변 제출 + 다음 질문 반환 🔒 |
| POST | /api/interviews/sessions/{id}/end | 면접 종료 + 피드백 생성 🔒 |
| GET  | /api/interviews/sessions/{id}/feedback | 피드백 조회 🔒 |

### 학습
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET  | /api/learning/subjects | 과목 목록 🔒 |
| POST | /api/learning/subjects/{id}/problems/generate | AI 문제 생성 🔒 |
| POST | /api/learning/attempts | 답안 제출 + AI 채점 🔒 |

---

## 10. 면접 예상 질문 & 답변 가이드

**Q. JWT와 세션 기반 인증의 차이점은?**
> JWT는 토큰 자체에 사용자 정보를 담아 서버가 상태를 저장하지 않습니다(Stateless).
> 반면 세션은 서버가 세션 저장소를 유지해야 합니다. 이 프로젝트는 JWT를 선택해
> 서버 수평 확장에 유리하게 설계했습니다.

**Q. Spring Security에서 인증 흐름을 설명해보세요.**
> 요청이 들어오면 `JwtAuthenticationFilter`가 Authorization 헤더에서 토큰을 꺼내
> 서명을 검증합니다. 유효하면 `SecurityContextHolder`에 인증 정보를 저장하고
> 이후 컨트롤러에서 `@AuthenticationPrincipal`로 현재 사용자를 꺼냅니다.

**Q. JPA를 쓸 때 N+1 문제를 어떻게 해결했나요?**
> 연관 엔티티를 `FetchType.LAZY`로 설정하고, 필요한 곳에서는 JPQL의 JOIN FETCH나
> `@EntityGraph`를 사용해 한 번의 쿼리로 데이터를 조회했습니다.

**Q. Python AI 서버를 왜 별도로 분리했나요?**
> Python의 AI/ML 생태계(LangChain, OpenAI SDK, Whisper)가 Java보다 훨씬 성숙합니다.
> 또한 AI 서버만 독립적으로 스케일 아웃할 수 있고, 장애가 발생해도
> 메인 Spring Boot 서버는 계속 동작합니다(격리).

**Q. ChromaDB를 왜 사용했나요?**
> 매번 GPT-4o로 면접 질문을 새로 생성하면 비용이 많이 들고 속도도 느립니다.
> 기존에 생성된 좋은 질문들을 벡터로 저장해두고, 새 요청이 오면
> 유사도 검색으로 재사용하는 RAG 방식을 적용해 비용을 절감했습니다.

**Q. 트랜잭션을 어떻게 관리했나요?**
> Spring의 `@Transactional`을 서비스 레이어에서 사용했습니다.
> 기본적으로 `readOnly = true`로 설정하고, 쓰기 작업이 있는 메서드에만
> `@Transactional`을 추가해 성능을 최적화했습니다.

---

## 11. 배포 구조

```
GitHub main 브랜치 push
        │ GitHub Actions
        ├── 프론트엔드 빌드 → S3 업로드 → CloudFront 캐시 무효화
        └── 백엔드 JAR 빌드 → EC2 SSH → 서비스 재시작
```

---

## 12. ChromaDB RAG — 정확한 면접 멘트

### 현재 구현 (코드 기반 사실)

> "AI에 문서를 통째로 전달하는 대신, 이력서·자기소개서·채용공고를 ChromaDB에 벡터로 저장해
> 질문 생성 전에 관련 문맥을 먼저 검색하는 RAG 구조를 적용했습니다.
>
> 문서는 500자 단위로 chunking하고 50자를 overlap으로 유지해 문맥 단절을 방지했습니다.
> 각 청크에는 doc_id(resume / cover_letter / job_description)와 chunk_index를 메타데이터로
> 함께 저장해 출처를 추적할 수 있게 했습니다.
>
> 검색은 cosine 유사도 기준으로 상위 3개 청크만 모델에 전달해 불필요한 컨텍스트를 줄였습니다.
> 임베딩은 OpenAI text-embedding-3-small을 사용했고, 한 번의 API 호출로 전체 청크를
> 배치로 처리해 비용을 줄였습니다.
>
> 또한 GPT-4o가 생성한 면접 질문은 별도 컬렉션(interview_question_assets)에 저장해두고,
> 다음 면접 세션에서 재사용 후보로 검색합니다. 3문항 중 1개는 재사용, 2개는 신규 생성하는
> 혼합 출제 방식으로 API 호출 비용을 절감했습니다."

### 면접관이 파고들 수 있는 질문 & 답변

**Q. metadata filter는 어떻게 적용했나요?**
> "현재는 ChromaDB 벡터 검색 후 Python 코드에서 subject_name, difficulty, question_type
> 기준으로 후처리 필터링하고 있습니다. ChromaDB의 `where` 파라미터로 검색 전 pre-filter를
> 적용하면 탐색 범위를 더 줄일 수 있는데, 이 부분은 개선 포인트로 인식하고 있습니다."

**Q. HNSW가 뭔지 설명해보세요.**
> "HNSW(Hierarchical Navigable Small World)는 ChromaDB가 벡터 검색에 사용하는 인덱스
> 알고리즘입니다. 계층적 그래프 구조로 가까운 벡터를 빠르게 탐색합니다.
> 현재 프로젝트에서는 hnsw:space=cosine만 설정하고 나머지는 기본값을 쓰고 있습니다.
> construction_ef(인덱스 구축 정확도)와 search_ef(검색 시 탐색 범위)를 조절하면
> 정확도와 응답 속도를 트레이드오프할 수 있다는 것을 학습했습니다."

**Q. EphemeralClient를 쓰면 서버 재시작 시 데이터가 사라지지 않나요?**
> "맞습니다. 로컬 개발 환경에서는 CHROMA_HOST 환경변수가 없으면 in-memory EphemeralClient로
> 동작해 재시작 시 초기화됩니다. 운영 환경에서는 Docker로 ChromaDB 서버를 띄우고
> HttpClient 모드로 연결해 데이터를 영속합니다."

**Q. chunking 방식을 설명해보세요. semantic chunking은 적용하지 않았나요?**
> "현재는 500자 고정 크기로 chunking하고 50자 overlap을 두어 문맥 단절을 최소화했습니다.
> 이 방식은 구현이 단순하고 청크 크기가 예측 가능하다는 장점이 있습니다.
>
> 단점은 문장 중간에서 잘릴 수 있다는 것입니다. 개선 방향으로는 채용공고처럼 섹션이
> 명확한 문서는 '주요업무 / 자격요건 / 우대사항' 단위로 의미적으로 분할하는
> semantic chunking을 적용하면 관련 정보가 한 청크 안에 온전히 담겨 검색 정밀도가
> 더 높아질 것이라고 생각합니다.
>
> 이력서·자기소개서도 문단 단위로 나누면 'Spring Boot 경험 청크', 'CS 학습 청크'처럼
> 검색어와 더 정밀하게 매칭될 수 있습니다. 이 부분은 현재 개선 포인트로 인식하고 있습니다."

**Q. RAG Top-K 값을 설정할 때 어떤 요소를 고려했나요? 그 결과를 어떻게 평가했나요?**
> "Top-K 값 설정에서 두 가지 관점으로 판단했습니다.
>
> **첫째, 세션 문서 RAG의 K=3 설정:**
> GPT-4o 프롬프트에 넣는 context가 너무 많아지면 오히려 핵심 정보가 희석될 수 있습니다.
> 청크 하나가 약 500자이므로 K=3이면 약 1,500자의 context가 추가됩니다.
> 이 정도가 '충분한 문맥 + 컨텍스트 오염 방지'의 균형점이라 판단했습니다.
>
> **둘째, 자산 재사용 검색의 버퍼 전략:**
> 면접 질문 자산 검색 시 실제 필요량(limit=3)보다 3배 많은 9개를 먼저 검색한 뒤,
> Python에서 question_type·job_family 기준으로 후처리 필터링해 최종 3개를 선별합니다.
> 이는 ChromaDB 검색만으로는 메타데이터 조건을 걸기 어려운 부분을 보완한 방식입니다.
>
> **평가 방법에 대한 솔직한 답변:**
> 다만 이 수치를 Recall@K나 MRR 같은 지표로 체계적으로 평가하지는 못했습니다.
> 실제 면접 시나리오로 수동 테스트해 '연관성 있는 청크가 상위에 오는지' 확인하는 방식으로
> 검증했습니다. 향후 개선 시에는 평가용 쿼리셋을 구성해 Recall@K를 측정하는 것이
> 더 신뢰할 수 있는 방법이라고 생각합니다."

---

## 13. 개선 가능한 부분 (현재 → 발전 방향)

### RAG / 벡터 검색 개선

| 현재 | 개선 방향 | 효과 |
|------|----------|------|
| Python 후처리 필터링 | ChromaDB `where` pre-filter 사용 | 검색 범위 축소 → 속도 향상 |
| metadata: doc_id + chunk_index만 저장 | `doc_type`, `section`(직무/경력/기술) 등 세분화 | 섹션별 정밀 검색 가능 |
| 자산 저장 시 단건 임베딩 | 배치로 묶어 한 번에 embed_texts() 호출 | OpenAI API 호출 횟수 절감 |
| 500자 고정 chunking | 문단/문장 단위 semantic chunking | 의미 단위 검색 정밀도 향상 |
| HNSW 기본값 사용 | search_ef, M 파라미터 튜닝 | 정확도 ↔ 속도 트레이드오프 조절 |

### 인증 / 보안 개선

| 현재 | 개선 방향 | 효과 |
|------|----------|------|
| 리프레시 토큰 만료만 확인 | Redis로 블랙리스트 관리 | 강제 로그아웃, 탈취 토큰 즉시 차단 |
| Spring Security 기본 설정 | Rate Limiting 추가 | 브루트포스 공격 방어 |

### 성능 / 아키텍처 개선

| 현재 | 개선 방향 | 효과 |
|------|----------|------|
| HTTP 폴링 방식 답변 제출 | WebSocket 실시간 스트리밍 | GPT 응답을 타이핑 효과로 표시 |
| 면접 질문 동기 생성 | 비동기 큐(Celery + Redis) | 응답 지연 없이 다음 질문 미리 생성 |
| Hibernate ddl-auto: update | Flyway/Liquibase 마이그레이션 | DB 스키마 버전 관리 |
| AI 서버 단일 인스턴스 | 독립 스케일 아웃 | GPT 부하가 몰릴 때 AI 서버만 증설 |

### 관찰가능성(Observability) 개선

| 현재 | 개선 방향 |
|------|----------|
| 로그 파일 수동 확인 | ELK Stack(Elasticsearch + Kibana) 또는 Grafana + Loki |
| 없음 | Prometheus + Grafana로 API 응답 시간, GPT 호출 비용 모니터링 |
| 없음 | Sentry로 프론트/백엔드 에러 실시간 알림 |

---

## 14. 앞으로 개선하고 싶은 점 (한 문장 요약)

- **Redis 도입**: 리프레시 토큰 블랙리스트 + 세션 캐싱
- **WebSocket**: 현재 HTTP 방식 → GPT 응답 실시간 스트리밍
- **면접 영상 저장**: S3 녹화본 업로드 → 복기 기능
- **Swagger/OpenAPI**: API 문서 자동화
- **ChromaDB pre-filter**: `where` 파라미터로 검색 전 필터링으로 전환
- **부하 테스트**: k6 또는 Locust로 동시 접속 한계 측정

---

## 15. 트러블슈팅 경험 (면접 단골: "어려웠던 점이 있나요?")

### 트러블슈팅 1: Java Record 생성자 인자 불일치 (컴파일 에러)

**현상**
```
error: constructor JobPostingScrapedDto in record cannot be applied to given types;
  required: String,String,String,String,String,String
  found:    String,String,String
```

**원인**
`JobPostingScrapedDto` Record에 `location`, `due_date`, `source_url` 필드를 추가하면서
정규 생성자(canonical constructor)의 매개변수가 자동으로 늘어났지만,
`PythonAiService`와 `MockAiService`의 `new JobPostingScrapedDto(...)` 호출부를 수정하지 않았습니다.

> **핵심 원리**: Java `record`는 일반 클래스와 달리 setter가 없고 **생성자가 유일한 초기화 경로**입니다.
> 필드를 추가하면 "이 record를 `new`로 생성하는 곳이 어디인가?" 를 빠짐없이 찾아야 합니다.

**해결 과정**
```bash
# 호출부 전수 파악
grep -rn "new JobPostingScrapedDto" --include="*.java" src/
```
→ `PythonAiService`(Python 응답 매핑) 와 `MockAiService`(테스트용 Mock) 2곳 발견
→ 두 곳 모두 6개 인자로 수정 후 빌드 성공

**배운 점**
Record/DTO 필드 추가 시 IDE의 'Find Usages' 또는 `grep`으로 모든 생성 호출부를 먼저 찾고 일괄 수정합니다.

---

### 트러블슈팅 2: 상태 머신 변경 후 테스트 기댓값 미동기화

**현상**
```
AssertionError: JSON path "$.data.status"
  expected:<CANCELLED> but was:<CANCEL_REQUESTED>
```

**원인**
주문 취소 흐름을 **즉시 취소 → 관리자 승인 방식**으로 변경했습니다:
- 변경 전: 사용자 취소 → `CANCELLED` (즉시 완료)
- 변경 후: 사용자 취소 → `CANCEL_REQUESTED` (대기) → 관리자 승인 → `CANCELLED`

`OrderService.cancelOrder()` 로직은 이미 변경되어 있었지만,
`OrderActionFlowTest`의 `andExpect(jsonPath("$.data.status").value("CANCELLED"))` 가
옛 동작을 그대로 검증하고 있었습니다.

**해결 과정**
```bash
# 영향받는 테스트 전수 확인
grep -rn "CANCELLED" --include="*Test.java" src/test/
```
→ 기댓값을 `CANCEL_REQUESTED`로 수정, `@DisplayName`도 새 동작에 맞게 변경

**배운 점**
비즈니스 로직의 상태 전이 규칙을 바꿀 때는 관련 테스트를 반드시 함께 수정합니다.
`grep`으로 해당 상태값을 검증하는 테스트 코드를 전수 확인하는 것이 안전합니다.

---

### 트러블슈팅 3: react-grid-layout v3 ESM export 구조 변경

**현상**
```
Vite 빌드 에러:
"WidthProvider" is not exported by "node_modules/react-grid-layout/..."
```

**원인**
v2까지는 `WidthProvider` HOC로 `Responsive`를 감싸는 패턴이었지만,
v3에서 `WidthProvider`가 제거되고 `ResponsiveGridLayout`이 자체적으로 width를 관리하도록 변경되었습니다.
블로그/Stack Overflow 예시코드가 v2 기준이라 그대로 복붙했다가 에러가 발생했습니다.

**해결 과정**
```jsx
// v2 방식 (에러)
import { Responsive, WidthProvider } from 'react-grid-layout';
const ResponsiveGridLayout = WidthProvider(Responsive);

// v3 방식 (수정 후)
import { ResponsiveGridLayout } from 'react-grid-layout';
```
→ 공식 GitHub의 v3 마이그레이션 가이드를 읽고 직접 import 방식으로 전환

**배운 점**
npm 패키지 설치 시 메이저 버전이 올라간 경우 CHANGELOG와 공식 마이그레이션 가이드를 반드시 먼저 확인합니다.
블로그 코드 예시는 구버전 기준일 수 있으므로, 항상 공식 문서를 최우선으로 참조합니다.

---

### 면접에서 트러블슈팅을 설명하는 한 문단 멘트

> "채용공고 스크래핑 기능에 필드를 추가하면서 세 가지 빌드 에러를 만났습니다.
>
> 첫 번째는 Java Record 특성 이해 부족이었습니다. Record에 필드를 추가하면 정규 생성자 시그니처가
> 자동으로 바뀌는데, `PythonAiService`와 `MockAiService`의 호출부를 함께 수정하지 않아
> 컴파일 에러가 발생했습니다. `grep`으로 모든 호출부를 찾아 일괄 수정했고,
> 이후에는 Record 필드 변경 시 영향 범위를 먼저 확인하는 습관을 들였습니다.
>
> 두 번째는 상태 머신 변경과 테스트 동기화 누락이었습니다. 주문 취소를 즉시 취소에서
> 관리자 승인 방식으로 변경했는데, 테스트의 기댓값이 옛 상태를 그대로 검증하고 있었습니다.
> 비즈니스 로직 변경 시 관련 테스트의 expected 값도 반드시 함께 갱신해야 한다는 것을 배웠습니다.
>
> 세 번째는 react-grid-layout v3의 Breaking Change였습니다. 블로그 예시가 v2 기준이어서
> 그대로 적용했다가 `WidthProvider` export 에러가 발생했고, 공식 마이그레이션 가이드로
> 해결했습니다. 이후로는 메이저 버전 업그레이드 시 CHANGELOG를 먼저 확인합니다."
