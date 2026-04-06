# AI 면접 플랫폼 — Claude 채팅용 프로젝트 컨텍스트

> 이 파일을 Claude 채팅에 붙여넣으면 프로젝트 전체 구조를 이해하고 질문에 답할 수 있습니다.
> "아래 프로젝트 컨텍스트를 읽고 질문에 답해줘:" 형식으로 사용하세요.

---

## 프로젝트 개요

**이름**: AI 모의 면접 플랫폼
**목적**: 취업 준비생을 위한 AI 모의 면접 + 학습 통합 SaaS 서비스
**팀**: 4인 협업, GitHub 브랜치 전략(main / develop / feature/*)

**핵심 기능 4가지:**
1. AI 음성 면접 — 이력서·자소서·채용공고 업로드 → GPT-4o 맞춤 질문 → Whisper STT로 답변 인식 → 종합 피드백
2. AI 학습 시스템 — 영어·한국사·IT 과목별 문제 자동 생성·채점
3. 도서 판매 — 장바구니 / 주문 / PortOne 결제 연동
4. 관리자 — 회원·재고·주문 관리, 대시보드 통계

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19, Vite, react-router-dom 7, Axios, Zustand, Recharts, Tailwind CSS v4 |
| 백엔드 | Spring Boot 3.4, Java 21, Gradle, Spring Security, JPA/Hibernate, Lombok |
| 데이터베이스 | MariaDB 12.x (utf8mb4_unicode_ci), localhost:3308/ai_interview |
| AI 서버 | Python 3.13, FastAPI, LangChain, OpenAI GPT-4o, Whisper STT/TTS |
| 벡터 DB | ChromaDB (면접 질문 자산 RAG 재사용) |
| 인증 | JWT (accessToken 30분, refreshToken 7일) |
| 배포 | AWS EC2 + S3 + CloudFront, GitHub Actions CI/CD |

---

## 서버 포트

| 서버 | 포트 |
|------|------|
| React (개발) | 5173 |
| Spring Boot | 8080 |
| Python FastAPI | 8000 (BE 내부에서만 호출, 외부 비공개) |
| MariaDB | 3308 (로컬) / 3306 (Docker) |

---

## 폴더 구조

```
ai-interview-platform/
├── frontend/           ← React Vite (src/api, pages, components, hooks, store, router)
├── backend/ai-interview/ ← Spring Boot (com.aimentor)
├── ai-server/          ← Python FastAPI
│   ├── routers/        ← asset, document, interview, learning, scraping, stt, tts
│   ├── services/       ← asset_vector_service, document_service, embedding_service,
│   │                      interview_service, learning_service, scraping_service,
│   │                      vector_service, whisper_service
│   ├── schemas/        ← Pydantic 스키마 (document, interview, learning, scraping, stt)
│   └── prompts/        ← GPT 시스템/사용자 프롬프트 txt 파일
├── docs/               ← API 명세서, ERD, 가이드, 트러블슈팅 문서
└── AGENTS.md           ← 프로젝트 컨텍스트 (코딩 규칙 포함)
```

---

## 백엔드 패키지 구조 (com.aimentor)

```
com.aimentor
├── common
│   ├── ApiResponse            ← { success, data } / { success, error } 공통 응답
│   ├── GlobalExceptionHandler ← BusinessException→4xx, AiServiceException→503, Exception→500
│   ├── BaseTimeEntity         ← createdAt, updatedAt JPA Auditing
│   ├── BusinessException      ← 비즈니스 로직 예외
│   └── ErrorCode              ← 에러 코드 열거형
├── domain
│   ├── user                   ← 회원가입, 로그인, JWT, Kakao OAuth
│   ├── profile
│   │   ├── resume             ← 이력서 CRUD
│   │   ├── coverletter        ← 자기소개서 CRUD
│   │   └── jobposting         ← 채용공고 CRUD
│   ├── interview
│   │   ├── InterviewSessionEntity    ← 면접 세션 (ONGOING/COMPLETED)
│   │   ├── InterviewQaEntity         ← 질문+답변
│   │   ├── InterviewFeedbackEntity   ← 종합 피드백 (점수 5가지)
│   │   ├── InterviewService          ← startSession, submitAnswer, endSession, getFeedback
│   │   └── InterviewController       ← /api/interviews/**
│   ├── learning
│   │   ├── LearningSubjectEntity     ← 과목
│   │   ├── LearningProblemEntity     ← 문제
│   │   ├── LearningAttemptEntity     ← 풀이 기록 + AI 피드백
│   │   ├── LearningService
│   │   └── LearningController        ← /api/learning/**
│   ├── book                   ← 도서, 장바구니, 주문
│   ├── subscription           ← 구독 플랜
│   └── support                ← 고객센터 문의
├── external
│   ├── ai
│   │   ├── AiService          ← 인터페이스
│   │   ├── PythonAiService    ← 실제 구현체 (Python 서버 HTTP 호출)
│   │   └── MockAiService      ← 테스트용 Mock
│   └── speech
│       └── SpeechService      ← STT 인터페이스
└── security
    ├── JwtAuthenticationFilter ← JWT 토큰 검증 필터
    └── SecurityConfig          ← Spring Security 설정
```

---

## 공통 API 응답 형식

```json
// 성공
{ "success": true, "data": { ... } }

// 실패
{ "success": false, "error": { "code": "EXPIRED_TOKEN", "message": "토큰이 만료되었습니다." } }
```

**에러 코드:**
- `INVALID_TOKEN` — 유효하지 않은 토큰
- `EXPIRED_TOKEN` — 액세스 토큰 만료
- `NOT_FOUND` — 리소스 없음
- `FORBIDDEN` — 권한 없음 (ADMIN 전용)
- `VALIDATION_ERROR` — 요청값 유효성 오류
- `OUT_OF_STOCK` — 재고 부족
- `AI_SERVER_ERROR` — Python AI 서버 호출 실패

---

## 전체 API 목록

### 인증 (/api/auth)
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | /api/auth/register | 없음 | 회원가입 |
| POST | /api/auth/login | 없음 | 로그인 (accessToken + refreshToken) |
| POST | /api/auth/refresh | 없음 | 토큰 재발급 |
| POST | /api/auth/logout | 🔒 | 로그아웃 |
| GET  | /api/auth/me | 🔒 | 내 정보 조회 |

### 프로필 (/api/resumes, /api/cover-letters, /api/job-postings)
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET/POST | /api/resumes | 🔒 | 이력서 목록/생성 |
| GET/PUT/DELETE | /api/resumes/{id} | 🔒 | 이력서 조회/수정/삭제 |
| (동일 패턴) | /api/cover-letters | 🔒 | 자기소개서 CRUD |
| (동일 패턴) | /api/job-postings | 🔒 | 채용공고 CRUD |

### 면접 (/api/interviews)
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | /api/interviews/sessions | 🔒 | 세션 시작 + 첫 질문 반환 |
| GET  | /api/interviews/sessions | 🔒 | 내 세션 목록 |
| GET  | /api/interviews/sessions/{id} | 🔒 | 세션 상세 |
| POST | /api/interviews/sessions/{id}/answer | 🔒 | 답변 제출 + 다음 질문 |
| POST | /api/interviews/sessions/{id}/end | 🔒 | 면접 종료 + 피드백 생성 |
| GET  | /api/interviews/sessions/{id}/feedback | 🔒 | 피드백 조회 |

### 학습 (/api/learning)
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET  | /api/learning/subjects | 🔒 | 과목 목록 |
| POST | /api/learning/subjects/{id}/problems/generate | 🔒 | AI 문제 생성 |
| POST | /api/learning/attempts | 🔒 | 답안 제출 + AI 채점 |
| GET  | /api/learning/stats | 🔒 | 학습 통계 |

### 도서 / 장바구니 / 주문
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET  | /api/books | 없음 | 도서 목록 (공개) |
| POST | /api/books | 🔒 ADMIN | 도서 등록 |
| GET/POST/PUT/DELETE | /api/cart | 🔒 | 장바구니 |
| POST | /api/orders | 🔒 | 주문 생성 |
| GET  | /api/orders | 🔒 | 내 주문 목록 |

### 관리자 (/api/admin) — ADMIN 전용
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET  | /api/admin/users | 회원 목록 |
| PUT  | /api/admin/users/{id}/role | 권한 변경 |
| GET  | /api/admin/books/stock | 재고 현황 |
| PATCH | /api/admin/books/{id}/stock | 재고 수정 |
| GET  | /api/admin/orders | 전체 주문 |
| GET  | /api/admin/dashboard | 대시보드 통계 |

### Python AI 서버 내부 API (Base: http://localhost:8000)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /stt | 음성 파일 → 텍스트 (Whisper) |
| POST | /interview/question | 면접 질문 생성 (GPT-4o) |
| POST | /interview/feedback | 면접 피드백 생성 (GPT-4o) |
| POST | /learning/generate | 학습 문제 생성 (GPT-4o) |
| POST | /learning/grade | 주관식 채점 (GPT-4o) |
| GET  | /health | 서버 상태 확인 |

---

## DB 테이블 목록 (MariaDB: ai_interview)

| 테이블 | 주요 컬럼 | 설명 |
|--------|----------|------|
| users | id, email, password, role(USER/ADMIN) | 회원 |
| resumes | id, user_id, title, content | 이력서 |
| cover_letters | id, user_id, title, content | 자기소개서 |
| job_postings | id, user_id, title, content | 채용공고 |
| interview_sessions | id, user_id, resume_id, cover_letter_id, job_posting_id, question_type, position_title, status(ONGOING/COMPLETED), planned_question_count, answered_question_count, is_partial_completed, started_at, ended_at | 면접 세션 |
| interview_qas | id, session_id, sequence, question, answer, answered_at | 질문·답변 |
| interview_feedback | id, session_id, logic_score, communication_score, technical_score, attitude_score, overall_score, feedback_text | 면접 피드백 |
| learning_subjects | id, name, description | 학습 과목 |
| learning_problems | id, subject_id, type(MULTIPLE/SHORT/OX), question, choices, answer, explanation | 학습 문제 |
| learning_attempts | id, user_id, problem_id, user_answer, is_correct, ai_feedback | 풀이 기록 |
| books | id, title, author, publisher, price, stock, cover_url | 도서 |
| cart_items | id, user_id, book_id, quantity | 장바구니 |
| orders | id, user_id, total_price, status, payment_method | 주문 |
| order_items | id, order_id, book_id, quantity, unit_price | 주문 상세 |
| subscriptions | id, user_id, plan, status, payment_method, started_at, expires_at | 구독 |
| customer_center_inquiries | id, user_id, title, content, status(WAITING/ANSWERED) | 고객센터 문의 |
| customer_center_faqs | id, question, answer, category | FAQ |

---

## 면접 흐름 상세

```
1.  FE: POST /api/interviews/sessions (resumeId, coverLetterId, jobPostingId, questionType)
2.  BE: InterviewSessionEntity 저장 (position_title = '' 기본값)
3.  BE → Python: POST /interview/question (이력서+자소서+채용공고 본문, questionType)
4.  Python → GPT-4o: 맞춤 첫 질문 생성
5.  BE → FE: sessionId + firstQuestion 반환
6.  FE: SpeechSynthesis로 질문 음성 출력
7.  FE: MediaRecorder로 답변 음성 녹음 (.webm)
8.  FE: POST /api/interviews/sessions/{id}/answer (audio 파일)
9.  BE → Python: POST /stt (오디오 → 텍스트)
10. BE → Python: POST /interview/question (이전 Q&A 히스토리 포함 → 다음 질문)
11. 7~10 반복 (최대 5문항)
12. FE: POST /api/interviews/sessions/{id}/end
13. BE → Python: POST /interview/feedback (전체 히스토리 → 종합 피드백)
14. FE: 피드백 결과 표시
```

---

## Python AI 서버 주요 구현

### interview_service.py
- `generate_interview_question(resume, cover_letter, job_description, history, question_type, session_id)`:
  - ChromaDB에서 유사 질문 검색 (재사용 후보)
  - GPT-4o로 신규 질문 생성
  - 신규 질문을 ChromaDB에 저장
  - 재사용 : 신규 = 1 : 2 비율로 혼합 반환

### learning_service.py
- `generate_problems(subject, difficulty, count, problem_type, user_accuracy)`:
  - ChromaDB에서 유사 문제 검색 (1/3 재사용)
  - GPT-4o로 나머지 신규 생성 (2/3)
  - 혼합 출제
- `grade_answer(question, correct_answer, user_answer, explanation)`:
  - GPT-4o로 채점 → `{ isCorrect: bool, aiFeedback: str }` 반환

### vector_service.py / asset_vector_service.py
- `CHROMA_HOST` 환경변수 있으면 HTTP 클라이언트 모드, 없으면 In-memory(EphemeralClient)
- 컬렉션: `interview_question_assets`, `learning_problem_assets`

---

## 프론트엔드 주요 구조

```
src/
├── api/
│   ├── axios.js          ← Axios 인스턴스 (baseURL: http://localhost:8080, JWT 자동 첨부)
│   └── *.js              ← 도메인별 API 함수 모음
├── store/
│   └── authStore.js      ← Zustand 로그인 상태 (accessToken, user 정보)
├── router/index.jsx      ← react-router-dom 라우트 설정
├── pages/
│   ├── auth/             ← 로그인, 회원가입
│   ├── interview/        ← 면접 시작, 진행, 결과
│   ├── learning/         ← 과목 선택, 문제 풀기, 통계
│   ├── bookstore/        ← 도서 목록, 장바구니, 주문
│   ├── profile/          ← 이력서, 자소서, 채용공고 관리
│   ├── admin/            ← 관리자 페이지
│   └── subscription/     ← 구독 플랜
└── components/
    ├── common/           ← Button, Input, Modal 등 공통 UI
    ├── interview/        ← 면접 관련 컴포넌트
    ├── learning/         ← 학습 관련 컴포넌트
    └── layout/           ← Navbar, Footer, 레이아웃
```

---

## 아키텍처 주요 원칙

1. **계층 분리**: Controller → Service → Repository → Entity
2. **공통 응답**: 모든 API는 `ApiResponse<T>` 형식 통일
3. **전역 예외 처리**: `GlobalExceptionHandler`로 일관된 에러 응답
4. **AI 서버 격리**: Python AI 서버는 외부 노출 없이 Spring Boot만 호출
5. **JWT Stateless**: 서버 세션 없이 수평 확장 가능
6. **한글 인코딩**: DB utf8mb4 + JDBC connectionCollation + SET NAMES utf8mb4
7. **환경 변수**: API 키, DB 비밀번호는 절대 하드코딩 금지, `.env` 또는 환경변수로 관리

---

## 코딩 규칙 (이 프로젝트의 규칙)

- 각 클래스와 메서드에 한국어 주석으로 역할과 동작 방식을 설명한다
- 구현은 깔끔하고 명확하게, 기술 면접에서 설명하기 쉬운 구조로 작성한다
- 작업 후에는 1) 변경된 파일 2) 빌드/테스트 결과 3) 남은 위험 요소 4) 다음 추천 작업 순으로 정리한다
- 기존 주석은 삭제하지 않고 보강한다
- null, 빈 값, 네트워크 실패, 권한 오류, 인코딩 오류 같은 경계 상황을 항상 고려한다
- 4인 협업이므로 기존 코드를 최대한 유지하고 꼭 필요한 부분만 최소 수정한다

---

## 알려진 이슈 / 트러블슈팅 히스토리

| 이슈 | 원인 | 해결 |
|------|------|------|
| POST /api/interviews/sessions → 500 | `interview_sessions.position_title NOT NULL` 컬럼이 Entity에 누락 → Hibernate INSERT 실패 | `InterviewSessionEntity`에 `@Builder.Default private String positionTitle = ""` 추가 |
| Python interview_service 재사용 로직 무시 | `generate_interview_question` 함수가 파일에 두 번 정의 → Python이 두 번째로 덮어씀 | 첫 번째(단순) 함수 제거, 두 번째(RAG 포함) 함수만 유지 |
| DB 한글 저장 시 `?` 깨짐 | JDBC `characterEncoding=UTF-8`만으로는 MariaDB 세션 charset이 latin1 유지 | JDBC URL에 `connectionCollation=utf8mb4_unicode_ci` 추가 |
| learning_service.py JSON 파싱 에러 | 중복 함수 정의로 인해 올바른 구현이 덮어씌워짐 | 중복 제거 |

---

## 환경 변수 목록

### Spring Boot (.env 또는 환경변수)
| 변수 | 기본값 | 설명 |
|------|--------|------|
| DB_URL | jdbc:mariadb://localhost:3308/ai_interview?... | DB 연결 URL |
| DB_USERNAME | root | DB 사용자 |
| DB_PASSWORD | 1234 | DB 비밀번호 |
| JWT_SECRET | (Base64 인코딩된 시크릿) | JWT 서명 키 |
| AI_SERVER_URL | http://localhost:8000 | Python AI 서버 주소 |
| AI_SERVICE_MOCK | false | true면 MockAiService 사용 |
| PORTONE_SECRET_KEY | (비어있음) | PortOne 결제 시크릿 |

### Python FastAPI (.env)
| 변수 | 설명 |
|------|------|
| OPENAI_API_KEY | OpenAI API 키 |
| MODEL_NAME | 기본값 gpt-4o |
| CHROMA_HOST | ChromaDB 서버 주소 (없으면 In-memory) |

---

## 테스트 파일 목록

| 파일 | 테스트 내용 |
|------|------------|
| AuthFlowTest | 회원가입 → 로그인 → 토큰 재발급 |
| InterviewFlowTest | 세션 시작 → 답변 → 종료 → 피드백 |
| InterviewOwnershipTest | 타 사용자 세션 접근 차단 (403) |
| LearningGradeTest | AI 채점 응답 구조 |
| OrderFlowTest | 장바구니 → 주문 → 결제 |
| OrderActionFlowTest | 주문 상태 변경 흐름 |
| SecurityAccessTest | 미인증 접근 차단 (401) |
| SubscriptionFlowTest | 구독 생성·조회 |
| CustomerCenterFlowTest | 문의 생성·답변 |
| CustomerCenterFaqAdminFlowTest | FAQ 관리자 CRUD |
| PythonAiServiceTest | Python AI 서버 연동 |
| PythonSpeechServiceTest | STT 서비스 연동 |
| TtsControllerTest | TTS 컨트롤러 |
