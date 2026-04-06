# ChromaDB + RAG 실습 완전 가이드

> **대상:** Vector DB, ChromaDB, RAG를 처음 접하는 학생
> **목표:** "이게 뭔지 → 왜 쓰는지 → 어떻게 돌아가는지 → 코드를 어떻게 쓰는지"를 단계별로 완벽하게 이해
> **이 문서의 특징:** 이 프로젝트의 **실제 코드**를 기반으로 설명합니다

---

## 목차

### Part 1. 개념 이해
1. [Vector DB가 뭔가요? — 일반 DB와 뭐가 다른가요?](#1-vector-db가-뭔가요)
2. [임베딩(Embedding)이 뭔가요? — 텍스트를 숫자로 바꾼다고요?](#2-임베딩embedding이-뭔가요)
3. [ChromaDB가 뭔가요? — 왜 이걸 쓰나요?](#3-chromadb가-뭔가요)
4. [RAG가 뭔가요? — AI가 내 문서를 읽는 법](#4-rag가-뭔가요)

### Part 2. 동작 원리
5. [전체 데이터 흐름 — 처음부터 끝까지](#5-전체-데이터-흐름)
6. [청킹(Chunking) — 왜 문서를 잘라야 하나요?](#6-청킹chunking)
7. [유사도 검색 — 어떻게 "비슷한" 걸 찾나요?](#7-유사도-검색)
8. [컬렉션(Collection) — 데이터를 어디에 담나요?](#8-컬렉션collection)

### Part 3. 코드 완전 해설
9. [embedding_service.py — 텍스트를 벡터로 바꾸는 코드](#9-embedding_servicepy-완전-해설)
10. [vector_service.py — ChromaDB를 다루는 코드](#10-vector_servicepy-완전-해설)
11. [document.py — 문서 업로드 API 코드](#11-documentpy-라우터-완전-해설)
12. [interview_service.py — RAG를 면접에 적용하는 코드](#12-interview_servicepy-rag-부분-해설)

### Part 4. 실행과 테스트
13. [개발 환경에서 실행하기](#13-개발-환경에서-실행하기)
14. [Docker로 실행하기](#14-docker로-실행하기)
15. [직접 테스트해보기 — curl 명령어 모음](#15-직접-테스트해보기)
16. [자주 나오는 오류와 해결법](#16-자주-나오는-오류와-해결법)

### Part 5. 실전 구현 — 1단계 & 3단계
17. [1단계 구현: RAG 프론트엔드 연결](#17-1단계-구현-rag-프론트엔드-연결)
18. [3단계 구현: 세션 종료 시 컬렉션 정리](#18-3단계-구현-세션-종료-시-컬렉션-정리)

---

# Part 1. 개념 이해

---

# 1. Vector DB가 뭔가요?

## 1-1. 먼저, 우리가 아는 일반 DB

MariaDB 같은 관계형 DB는 **정확한 값**을 찾는 도구입니다.

```sql
-- 이건 잘 찾음: "Spring Boot"라는 정확한 단어가 있는 행
SELECT * FROM resumes WHERE content LIKE '%Spring Boot%';

-- 이건 못 찾음: 의미는 같지만 단어가 다른 경우
-- "백엔드 프레임워크 3년 경험" → Spring Boot 관련인데 LIKE로는 매칭 불가
```

이걸 비유하면:

```
일반 DB = 도서관 사서에게 "Spring Boot가 제목에 들어간 책 찾아주세요"
        → 정확히 그 단어가 있는 책만 찾아줌

Vector DB = 도서관 사서에게 "백엔드 프레임워크 관련 책 찾아주세요"
          → Spring Boot, Django, Express.js 등 '의미적으로 관련 있는' 책을 모두 찾아줌
```

## 1-2. Vector DB란?

**Vector DB는 "의미"를 기준으로 검색하는 데이터베이스입니다.**

```
일반 DB:    텍스트 → 글자 비교 → 정확히 일치하면 반환
Vector DB:  텍스트 → 숫자(벡터)로 변환 → 숫자끼리 거리 비교 → 가까우면 반환
```

핵심 아이디어:
```
"Spring Boot"    → [0.82, 0.15, 0.91, ...] (1536개의 숫자)
"백엔드 프레임워크" → [0.80, 0.17, 0.89, ...] (1536개의 숫자)
"맛있는 김치찌개"  → [0.12, 0.95, 0.03, ...] (1536개의 숫자)

"Spring Boot"와 "백엔드 프레임워크"의 숫자 배열은 비슷함 → 의미가 비슷하다!
"Spring Boot"와 "맛있는 김치찌개"의 숫자 배열은 완전 다름 → 의미가 다르다!
```

## 1-3. 왜 이 프로젝트에 필요한가?

우리 프로젝트는 **AI 면접 서비스**입니다.

```
상황:
  사용자가 이력서를 업로드함
  이력서에 "분산 캐시 시스템을 구축했습니다"라고 적혀 있음

  AI 면접관이 이 내용을 기반으로 질문을 만들어야 함
  → "캐시 시스템"과 관련된 내용을 이력서에서 찾아야 함

일반 검색:
  LIKE '%캐시%' → "분산 캐시 시스템을 구축했습니다" ← 이건 찾음
  LIKE '%Redis%' → 못 찾음 (단어가 없으니까)

  하지만 "분산 캐시" ≈ "Redis Cluster" ≈ "Memcached"
  의미적으로 다 관련 있는 건데 일반 검색으로는 불가능

Vector DB 검색:
  query = "캐시 시스템 관련 경험"
  → "분산 캐시 시스템을 구축했습니다" (유사도 0.92)
  → "데이터 읽기 성능 최적화 경험" (유사도 0.78)
  → 의미가 비슷한 것을 모두 찾아줌!
```

---

# 2. 임베딩(Embedding)이 뭔가요?

## 2-1. 컴퓨터는 글을 모른다

컴퓨터는 기본적으로 **숫자만** 처리할 수 있습니다.

```
사람:   "Spring Boot는 자바 기반 백엔드 프레임워크야" → 의미 이해 O
컴퓨터: "Spring Boot는 자바 기반 백엔드 프레임워크야" → 그냥 글자 나열, 의미 X
```

그래서 텍스트의 "의미"를 숫자로 변환하는 방법이 필요합니다.
그것이 바로 **임베딩(Embedding)** 입니다.

## 2-2. 임베딩 = 텍스트 → 숫자 배열

```
입력:  "Spring Boot 개발 경험이 있습니다"
                    ↓
          [ OpenAI 임베딩 API ]
                    ↓
출력:  [0.0123, -0.0456, 0.0789, 0.0234, ..., -0.0567]
       ←────────── 1536개의 숫자 (차원) ──────────→
```

이 1536개의 숫자가 바로 **텍스트의 의미를 수치로 표현한 것**입니다.

## 2-3. 왜 비슷한 의미면 비슷한 숫자가 나올까?

OpenAI의 임베딩 모델은 **수십억 개의 텍스트**를 학습했습니다.
학습 과정에서 "비슷한 맥락에서 사용되는 단어/문장은 비슷한 벡터를 갖도록" 훈련되었습니다.

```
"Spring Boot"     → [0.82, 0.15, 0.91, 0.33, ...]
"스프링 부트"      → [0.81, 0.16, 0.90, 0.34, ...]   ← 거의 같음!
"Django"          → [0.75, 0.20, 0.85, 0.30, ...]   ← 꽤 비슷 (같은 웹 프레임워크)
"맛있는 김치찌개"   → [0.12, 0.95, 0.03, 0.67, ...]   ← 완전 다름
```

## 2-4. 이 프로젝트에서 사용하는 임베딩 모델

```python
# ai-server/services/embedding_service.py에서 사용하는 모델
_EMBEDDING_MODEL = "text-embedding-3-small"
```

| 항목 | 값 |
|------|-----|
| 모델명 | `text-embedding-3-small` |
| 제공사 | OpenAI |
| 벡터 차원 | 1536 |
| 비용 | $0.02 / 1M 토큰 (매우 저렴) |
| 특징 | 가격 대비 성능이 좋은 경량 모델 |

## 2-5. 실제 코드에서 임베딩이 어떻게 호출되나

```python
# embed_texts() 함수가 실제로 하는 일

# 입력
texts = ["Spring Boot 개발 3년", "마이크로서비스 설계 경험"]

# OpenAI API 호출
response = await client.embeddings.create(
    model="text-embedding-3-small",
    input=texts,     # ← 텍스트 목록을 한 번에 전달 (배치 처리)
)

# 결과
# response.data[0].embedding = [0.0123, -0.0456, ...] (1536개)  ← "Spring Boot 개발 3년"
# response.data[1].embedding = [0.0234, -0.0567, ...] (1536개)  ← "마이크로서비스 설계 경험"
```

---

# 3. ChromaDB가 뭔가요?

## 3-1. ChromaDB = 가볍고 쉬운 Vector DB

Vector DB는 여러 종류가 있습니다:

| Vector DB | 특징 | 난이도 |
|-----------|------|--------|
| **ChromaDB** | 가볍고 설치 쉬움, Python 친화적 | 쉬움 |
| Pinecone | 클라우드 서비스, 관리 불필요 | 쉬움 (유료) |
| Weaviate | 기능 풍부, 스키마 지원 | 중간 |
| Milvus | 대규모 데이터, 분산 처리 | 어려움 |
| pgvector | PostgreSQL 확장 | 중간 |

**ChromaDB를 선택한 이유:**
1. `pip install chromadb` 한 줄로 설치 끝
2. Python API가 직관적
3. Docker로 영구 저장 가능
4. 개발 중에는 메모리 모드로 DB 없이도 동작
5. 오픈소스, 무료

## 3-2. ChromaDB의 핵심 개념 3가지

ChromaDB를 쓰려면 딱 3가지만 알면 됩니다:

### 개념 1: Client (연결)

```python
import chromadb

# 방법 1: 메모리 모드 (설치 불필요, 프로그램 종료하면 데이터 사라짐)
client = chromadb.EphemeralClient()

# 방법 2: HTTP 모드 (Docker 컨테이너에 연결, 데이터 영구 보존)
client = chromadb.HttpClient(host="localhost", port=8001)
```

### 개념 2: Collection (데이터 그룹)

```
일반 DB에서의 "테이블" = ChromaDB에서의 "컬렉션"

일반 DB:
  database → tables → rows
  mydb     → users  → {id: 1, name: "홍길동"}

ChromaDB:
  client → collections → documents
  client → session_42  → {id: "resume_chunk_0", document: "Spring Boot 3년...", embedding: [0.82, ...]}
```

```python
# 컬렉션 만들기 (또는 있으면 가져오기)
collection = client.get_or_create_collection(
    name="session_42",                       # 이름 (3~63자)
    metadata={"hnsw:space": "cosine"},       # 유사도 측정 방식
)
```

### 개념 3: Document (저장하는 데이터)

```python
# 데이터 저장 (upsert = 있으면 업데이트, 없으면 추가)
collection.upsert(
    ids=["resume_chunk_0", "resume_chunk_1"],     # 고유 ID (필수)
    documents=["Spring Boot 개발 3년", "MSA 설계"],  # 원본 텍스트
    embeddings=[[0.82, 0.15, ...], [0.75, 0.20, ...]],  # 벡터 (1536차원)
    metadatas=[{"doc_id": "resume"}, {"doc_id": "resume"}],  # 부가 정보
)
```

## 3-3. ChromaDB 기본 사용법 요약

```python
import chromadb

# 1. 연결
client = chromadb.EphemeralClient()

# 2. 컬렉션 생성
collection = client.get_or_create_collection("my_docs")

# 3. 데이터 저장
collection.upsert(
    ids=["doc1"],
    documents=["Spring Boot 개발 3년 경험"],
    embeddings=[[0.82, 0.15, 0.91, ...]],  # 1536개
)

# 4. 유사도 검색
results = collection.query(
    query_embeddings=[[0.80, 0.17, 0.89, ...]],  # 검색할 벡터
    n_results=3,  # 상위 3개 반환
)
# results["documents"] = [["Spring Boot 개발 3년 경험", ...]]

# 5. 컬렉션 삭제
client.delete_collection("my_docs")
```

---

# 4. RAG가 뭔가요?

## 4-1. RAG = Retrieval-Augmented Generation

한국어로: **검색 증강 생성**

쉽게 말하면: **AI에게 답변하기 전에 관련 자료를 먼저 찾아서 읽어주는 것**

```
[RAG 없이 질문]
사용자: "제 이력서를 보고 면접 질문 만들어주세요"
AI: "음... 이력서 내용을 모르니까 일반적인 질문을 하겠습니다"
    "자기소개 해주세요" ← 맥락 없는 질문

[RAG 있을 때]
사용자: "제 이력서를 보고 면접 질문 만들어주세요"

    ⬇️ 1단계: 이력서를 벡터 DB에서 검색
    → "분산 캐시 시스템을 구축했습니다" (유사도 0.92)
    → "Kafka를 활용한 이벤트 드리븐 아키텍처" (유사도 0.85)

    ⬇️ 2단계: 검색 결과를 AI에게 전달
    "참고 자료: [이력서 내용 청크들...]"
    "이 자료를 바탕으로 면접 질문을 생성하세요"

AI: "이력서에서 분산 캐시 시스템을 구축하셨다고 하셨는데,
     캐시 무효화(Cache Invalidation) 전략은 어떻게 설계하셨나요?" ← 맥락 있는 질문!
```

## 4-2. RAG의 3단계

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  1. 저장     │     │  2. 검색     │     │  3. 생성     │
│  (Indexing)  │ → → │ (Retrieval)  │ → → │(Generation) │
└─────────────┘     └──────────────┘     └─────────────┘

1단계 - 저장 (한 번만 하면 됨):
  이력서 텍스트 → 청크로 자르기 → 임베딩 → ChromaDB에 저장

2단계 - 검색 (질문 생성할 때마다):
  "이 사람의 기술 경험" → 임베딩 → ChromaDB에서 유사 청크 검색

3단계 - 생성 (GPT-4o가 담당):
  시스템 프롬프트 + 검색된 청크들 + "면접 질문을 만들어주세요"
  → GPT-4o가 맥락 있는 질문을 생성
```

## 4-3. RAG가 없으면 어떻게 되나?

```
우리 프로젝트에서 RAG 없이 면접을 하면:

시스템 프롬프트:
  "당신은 10년 경력 면접관입니다."
  "이력서: 저는 백엔드 개발자입니다... (전체 텍스트)"
  "관련 문서 참고: (없음)"          ← ★ RAG 컨텍스트가 비어있음

→ AI는 전체 이력서 텍스트만 보고 질문을 만듦
→ 이력서가 길면 중요한 부분을 놓칠 수 있음
→ 특정 키워드와 관련된 심층 질문을 만들기 어려움

RAG가 있으면:
  "관련 문서 참고:
    [관련 청크 1] 분산 캐시 시스템을 설계하고 Redis Cluster를 도입...
    [관련 청크 2] 초당 10만 요청을 처리하는 API 게이트웨이를 구축...
    [관련 청크 3] Kafka를 활용한 비동기 메시지 처리 파이프라인..."

→ AI가 이 3개의 핵심 부분에 집중해서 질문을 만듦
→ 훨씬 구체적이고 맥락 있는 질문이 나옴
```

---

# Part 2. 동작 원리

---

# 5. 전체 데이터 흐름

## 5-1. 면접 세션의 전체 생명주기

```
┌─────────────────────────────────────────────────────────────────┐
│                    면접 세션 전체 흐름                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [1] 면접 시작                                                   │
│  사용자가 이력서/자소서/채용공고를 선택하고 "면접 시작" 클릭          │
│      ↓                                                          │
│  Spring Boot: 세션 생성 (session_id = 42)                        │
│      ↓                                                          │
│  ai-server로 첫 질문 요청:                                       │
│    POST /interview/question                                      │
│    {                                                             │
│      sessionId: "42",                                            │
│      resumeContent: "이력서 전문...",                              │
│      coverLetterContent: "자소서 전문...",                         │
│      jobDescription: "채용공고 전문...",                           │
│      conversationHistory: []    ← 첫 질문이니 비어있음             │
│    }                                                             │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─           │
│                                                                 │
│  [2] RAG 저장 (★ 1단계에서 구현할 부분)                           │
│  ai-server의 interview_service.py 내부:                          │
│    if 첫 질문이면:                                                │
│      이력서 텍스트 → 청킹 → 임베딩 → ChromaDB에 저장              │
│      자소서 텍스트 → 청킹 → 임베딩 → ChromaDB에 저장              │
│      채용공고 텍스트 → 청킹 → 임베딩 → ChromaDB에 저장             │
│                                                                 │
│      ChromaDB 컬렉션 "session_42" 생성됨                         │
│      ┌──────────────────────────────────┐                       │
│      │ session_42                        │                       │
│      │  resume_chunk_0: "Spring Boot..." │                       │
│      │  resume_chunk_1: "MSA 설계..."    │                       │
│      │  cover_letter_chunk_0: "지원..."  │                       │
│      │  ...                              │                       │
│      └──────────────────────────────────┘                       │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─           │
│                                                                 │
│  [3] RAG 검색 → 질문 생성                                        │
│    검색 쿼리 = "이력서 + 채용공고" 합침                             │
│    → ChromaDB에서 유사 청크 3개 검색                              │
│    → GPT-4o 프롬프트에 주입                                      │
│    → 면접 질문 생성: "분산 캐시의 무효화 전략은?"                    │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─           │
│                                                                 │
│  [4] 면접 진행 (5회 반복)                                         │
│    질문 → 사용자 답변 → 다음 질문 → ... → 5번째 질문 완료          │
│    (매 질문마다 [3]의 RAG 검색이 반복됨)                           │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─           │
│                                                                 │
│  [5] 면접 종료 (★ 3단계에서 구현할 부분)                           │
│    Spring Boot: 세션 상태 → COMPLETED                            │
│    Spring Boot: 피드백 생성 요청                                  │
│    Spring Boot: DELETE /extract/vector/42                        │
│    → ai-server: ChromaDB에서 "session_42" 컬렉션 삭제            │
│                                                                 │
│      ChromaDB 컬렉션 "session_42" 삭제됨 ✓                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 5-2. 한 줄 요약

```
시작 → 문서 벡터화 → (질문할 때마다) 유사 검색 → 질문 생성 → 종료 시 정리
```

---

# 6. 청킹(Chunking)

## 6-1. 왜 문서를 잘라야 하나?

이력서가 이렇게 생겼다고 합시다:

```
[이력서 전체 - 2000자]

"저는 OO대학교 컴퓨터공학과를 졸업했습니다.
재학 중 Spring Boot를 사용한 웹 서비스를 개발했으며,
졸업 후에는 XX회사에서 3년간 백엔드 개발자로 근무했습니다.
주요 업무로는 MSA 아키텍처 설계, Redis를 활용한 캐싱 전략 수립,
Kafka 기반 이벤트 드리븐 시스템 구축 등을 담당했습니다.
... (중략) ...
최근에는 AI 서비스의 API 설계에 관심을 갖고 있으며,
LangChain과 FastAPI를 활용한 RAG 시스템을 구현한 경험이 있습니다."
```

이 2000자를 **통째로 하나의 벡터**로 만들면?

```
2000자 전체 → [0.45, 0.32, 0.67, ...] (하나의 벡터)

이 벡터는 이력서의 "평균적인 의미"를 표현함
→ Spring Boot에 대한 것도, Redis에 대한 것도, AI에 대한 것도 아닌
→ 뭔가 "전체적인" 벡터가 됨
→ 특정 주제에 대한 검색 정밀도가 떨어짐
```

그래서 **잘라야** 합니다:

```
[청크 1 - 500자] "저는 OO대학교... Spring Boot를 사용한 웹 서비스..."
  → [0.82, 0.15, 0.91, ...] ← 교육/Spring Boot 관련 벡터

[청크 2 - 500자] "XX회사에서 3년간... MSA 아키텍처... Redis... Kafka..."
  → [0.75, 0.20, 0.85, ...] ← 인프라/아키텍처 관련 벡터

[청크 3 - 500자] "AI 서비스... LangChain... FastAPI... RAG 시스템..."
  → [0.88, 0.05, 0.72, ...] ← AI/RAG 관련 벡터
```

이제 "캐시 관련 경험"을 검색하면 **청크 2**가 정확하게 매칭됩니다!

## 6-2. 이 프로젝트의 청킹 설정

```python
# ai-server/services/embedding_service.py
_CHUNK_SIZE = 500     # 한 청크에 최대 500자
_CHUNK_OVERLAP = 50   # 연속된 청크 간 50자 겹침
```

## 6-3. overlap(겹침)이 왜 필요한가?

```
원본 텍스트:
"... Redis Cluster를 도입하여 분산 캐시 | 시스템의 가용성을 99.9%까지 향상 ..."
                                        ↑
                              여기서 청크가 잘리면?

[청크 1] "... Redis Cluster를 도입하여 분산 캐시"
[청크 2] "시스템의 가용성을 99.9%까지 향상 ..."

→ "분산 캐시 시스템"이라는 하나의 의미가 두 청크로 찢어짐!
→ 어떤 청크도 완전한 의미를 담지 못함

overlap = 50을 적용하면:

[청크 1] "... Redis Cluster를 도입하여 분산 캐시"
[청크 2] "를 도입하여 분산 캐시 시스템의 가용성을 99.9%까지 향상 ..."
          ←── 50자 겹침 ──→

→ 청크 2에 "분산 캐시 시스템"이 완전히 포함됨!
→ 검색 정밀도 향상
```

## 6-4. 실제 청킹 코드

```python
# ai-server/services/embedding_service.py

def chunk_text(text, chunk_size=500, overlap=50):
    """
    텍스트를 500자 단위로 자르되, 50자씩 겹치게 합니다.
    """
    if not text or not text.strip():
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size          # 현재 위치에서 500자
        chunk = text[start:end].strip()   # 공백 제거

        if chunk:
            chunks.append(chunk)

        start = end - overlap             # 다음 시작 = 끝 - 50 (50자 겹침)

    return chunks
```

**동작 예시:**

```
텍스트 길이: 1200자, chunk_size=500, overlap=50

청크 1: text[0:500]    (0~499번째 글자)
청크 2: text[450:950]  (450~949번째 글자, 앞 50자 겹침)
청크 3: text[900:1200] (900~1199번째 글자, 앞 50자 겹침)

결과: 3개의 청크
```

---

# 7. 유사도 검색

## 7-1. 코사인 유사도

두 벡터가 얼마나 "비슷한 방향"을 가리키는지 측정하는 방법입니다.

```
             ↗ 벡터 A "Spring Boot"
           /
          / 20° (작은 각도 = 비슷!)
        /
      ────────→ 벡터 B "백엔드 프레임워크"


             ↗ 벡터 A "Spring Boot"
           /
          /
        /   90° (큰 각도 = 다름!)
      /
      ↓ 벡터 C "맛있는 김치찌개"

코사인 유사도:
  cos(20°) = 0.94  → 매우 비슷
  cos(90°) = 0.00  → 전혀 다름
  범위: -1 ~ 1 (1에 가까울수록 비슷)
```

## 7-2. 이 프로젝트에서의 검색 과정

```
1. 검색 쿼리: "이력서 내용 + 채용공고 내용"
   (이 두 개를 합쳐서 하나의 검색어로 만듦)

2. 쿼리를 임베딩:
   "Spring Boot 경험자 모집..." → [0.80, 0.17, 0.89, ...]

3. ChromaDB에서 비교:
   청크1 "Spring Boot 3년"      → 코사인 유사도 0.92  ← 1등!
   청크2 "MSA 설계"             → 코사인 유사도 0.85  ← 2등
   청크3 "AI 서비스 개발"        → 코사인 유사도 0.78  ← 3등
   청크4 "대학교 졸업"           → 코사인 유사도 0.45
   청크5 "취미: 등산"            → 코사인 유사도 0.12

4. 상위 3개 반환:
   ["Spring Boot 3년", "MSA 설계", "AI 서비스 개발"]
```

```python
# 이 프로젝트의 유사도 설정
collection = client.get_or_create_collection(
    name="session_42",
    metadata={"hnsw:space": "cosine"},  # ← 코사인 유사도 사용
)
```

---

# 8. 컬렉션(Collection)

## 8-1. 이 프로젝트의 컬렉션 설계

```
[컬렉션 = 세션별 독립 공간]

사용자 A의 면접 (session_id = 42):
  컬렉션명: "session_42"
  ┌─────────────────────────────────────────┐
  │ resume_chunk_0: "Spring Boot 3년..."     │
  │ resume_chunk_1: "MSA 설계..."            │
  │ cover_letter_chunk_0: "지원 동기..."     │
  │ job_desc_chunk_0: "채용 요건..."         │
  └─────────────────────────────────────────┘

사용자 B의 면접 (session_id = 78):
  컬렉션명: "session_78"
  ┌─────────────────────────────────────────┐
  │ resume_chunk_0: "Python 개발 5년..."     │
  │ resume_chunk_1: "데이터 분석..."          │
  │ ...                                      │
  └─────────────────────────────────────────┘

→ 세션별로 완전히 분리!
→ 사용자 A의 이력서가 사용자 B의 면접에 섞일 일 없음
```

## 8-2. 왜 세션별로 분리하나?

1. **보안:** 다른 사용자의 문서가 검색되면 안 됨
2. **정리 용이:** 세션 종료 시 컬렉션 하나만 삭제하면 끝
3. **충돌 방지:** 같은 사용자가 여러 면접을 동시에 진행해도 안전

## 8-3. 컬렉션 이름 규칙

```python
collection_name = f"session_{session_id}"

# 예시:
# session_id = "42"  → "session_42"
# session_id = "abc" → "session_abc"

# ChromaDB 제한:
# - 3~63자
# - 알파벳, 숫자, 하이픈, 밑줄만 허용
# - 시작과 끝은 알파벳/숫자여야 함
```

---

# Part 3. 코드 완전 해설

---

# 9. embedding_service.py 완전 해설

**파일 위치:** `ai-server/services/embedding_service.py`
**역할:** 텍스트를 1536차원 벡터로 변환

```python
"""
텍스트 임베딩 서비스 — 전체 코드 + 줄별 해설
"""

import os
from typing import List
from fastapi import HTTPException
from openai import AsyncOpenAI

# ──────────────────────────────────────────
# 설정값
# ──────────────────────────────────────────
_EMBEDDING_MODEL = "text-embedding-3-small"  # OpenAI 임베딩 모델
_CHUNK_SIZE = 500                             # 한 청크 최대 500자
_CHUNK_OVERLAP = 50                           # 연속 청크 간 50자 겹침


# ──────────────────────────────────────────
# 함수 1: 텍스트를 청크로 자르기
# ──────────────────────────────────────────
def chunk_text(text: str, chunk_size=_CHUNK_SIZE, overlap=_CHUNK_OVERLAP) -> List[str]:
    """
    목적: 긴 텍스트를 500자씩 자르기 (50자 겹침 포함)

    왜 필요한가?
    - 임베딩 API에 입력 길이 제한이 있음
    - 너무 긴 텍스트는 "평균적인" 벡터가 되어 검색 정밀도가 떨어짐
    - 짧은 청크 → 특정 주제에 대한 정밀한 벡터 → 정확한 검색
    """
    if not text or not text.strip():  # 빈 텍스트면 빈 리스트 반환
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size      # 현재 위치에서 500자 뒤
        chunk = text[start:end].strip()  # 해당 범위 추출 + 앞뒤 공백 제거

        if chunk:                     # 빈 문자열이 아니면 저장
            chunks.append(chunk)

        start = end - overlap         # 다음 시작 = 현재 끝 - 50 (겹침)

    return chunks


# ──────────────────────────────────────────
# 함수 2: 텍스트를 벡터로 변환
# ──────────────────────────────────────────
async def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    목적: 텍스트 목록을 OpenAI API로 벡터(1536차원) 목록으로 변환

    입력:  ["Spring Boot 3년", "MSA 설계"]
    출력:  [[0.82, 0.15, ...], [0.75, 0.20, ...]]

    async인 이유: OpenAI API 호출은 네트워크 I/O → 비동기로 해야 서버가 안 멈춤
    """
    if not texts:  # 빈 리스트면 빈 리스트 반환
        return []

    # OpenAI API 키 확인
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY가 설정되지 않았습니다.")

    # AsyncOpenAI 클라이언트 생성 (비동기)
    client = AsyncOpenAI(api_key=api_key)

    try:
        # OpenAI 임베딩 API 호출
        # input에 여러 텍스트를 한 번에 전달 → 네트워크 왕복 1회로 처리 (배치)
        response = await client.embeddings.create(
            model=_EMBEDDING_MODEL,  # "text-embedding-3-small"
            input=texts,             # ["텍스트1", "텍스트2", ...]
        )

        # API 응답 정렬 (순서 보장을 위해)
        sorted_data = sorted(response.data, key=lambda item: item.index)

        # 각 항목에서 embedding(벡터)만 추출
        return [item.embedding for item in sorted_data]

    except Exception as error:
        raise HTTPException(status_code=502, detail=f"텍스트 임베딩 실패: {error}")
```

---

# 10. vector_service.py 완전 해설

**파일 위치:** `ai-server/services/vector_service.py`
**역할:** ChromaDB에 벡터를 저장하고, 유사한 벡터를 검색하고, 삭제하는 모든 작업

```python
"""
Vector DB 서비스 (ChromaDB) — 전체 코드 + 줄별 해설
"""

import logging
import os
from typing import List, Optional
import chromadb
from services.embedding_service import chunk_text, embed_texts

logger = logging.getLogger(__name__)

# ChromaDB 클라이언트를 한 번만 만들어서 재사용 (싱글턴)
_chroma_client: Optional[chromadb.ClientAPI] = None


# ──────────────────────────────────────────
# 내부 함수 1: ChromaDB 연결
# ──────────────────────────────────────────
def _get_client() -> chromadb.ClientAPI:
    """
    ChromaDB 클라이언트를 가져옵니다 (처음 호출 시 1번만 생성).

    2가지 모드:
    1. HTTP 모드 (CHROMA_HOST 환경변수 있음)
       → Docker Compose에서 "chromadb" 컨테이너에 연결
       → 데이터가 영구 보존됨

    2. 메모리 모드 (환경변수 없음)
       → 별도 설치 없이 파이썬 프로세스 안에서 동작
       → 프로그램 종료하면 데이터 사라짐
       → 개발/테스트 용도
    """
    global _chroma_client

    if _chroma_client is not None:  # 이미 만들었으면 재사용
        return _chroma_client

    chroma_host = os.getenv("CHROMA_HOST")         # 예: "chromadb"
    chroma_port = int(os.getenv("CHROMA_PORT", "8001"))  # 예: 8000

    if chroma_host:
        # Docker 환경: HTTP로 ChromaDB 서버에 연결
        logger.info("ChromaDB HTTP 클라이언트 연결: %s:%s", chroma_host, chroma_port)
        _chroma_client = chromadb.HttpClient(host=chroma_host, port=chroma_port)
    else:
        # 로컬 개발: 메모리 기반 (설치 불필요)
        logger.warning("CHROMA_HOST 환경변수 없음 — 메모리 기반 ChromaDB 사용")
        _chroma_client = chromadb.EphemeralClient()

    return _chroma_client


# ──────────────────────────────────────────
# 내부 함수 2: 컬렉션 가져오기
# ──────────────────────────────────────────
def _get_collection(session_id: str) -> chromadb.Collection:
    """
    세션 ID에 해당하는 컬렉션을 가져옵니다.
    없으면 자동으로 새로 만듭니다.

    컬렉션명 규칙: "session_{session_id}"
    유사도 방식: cosine (코사인 유사도)
    """
    client = _get_client()
    collection_name = f"session_{session_id}"

    return client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},  # 코사인 유사도 사용
    )


# ──────────────────────────────────────────
# 핵심 함수 1: 문서 → 벡터 → ChromaDB 저장
# ──────────────────────────────────────────
async def upsert_document(session_id: str, doc_id: str, text: str) -> int:
    """
    목적: 문서 텍스트를 ChromaDB에 저장

    동작 순서:
    1. text → chunk_text()로 500자씩 자름
    2. 각 청크 → embed_texts()로 벡터 변환
    3. ChromaDB의 "session_{session_id}" 컬렉션에 저장

    upsert의 의미:
    - 같은 ID가 있으면 → 업데이트 (update)
    - 같은 ID가 없으면 → 추가 (insert)
    - update + insert = upsert

    반환값: 저장된 청크 수
    """
    # 1단계: 텍스트를 청크로 분할
    chunks = chunk_text(text)
    if not chunks:
        logger.warning("upsert_document: 청크 없음 (빈 텍스트)")
        return 0

    # 각 청크의 고유 ID 생성: "resume_chunk_0", "resume_chunk_1", ...
    chunk_ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]

    # 각 청크의 메타데이터 (부가 정보)
    chunk_metadatas = [{"doc_id": doc_id, "chunk_index": i} for i in range(len(chunks))]

    # 2단계: 임베딩 (텍스트 → 벡터)
    embeddings = await embed_texts(chunks)  # OpenAI API 호출

    # 3단계: ChromaDB에 저장
    collection = _get_collection(session_id)
    collection.upsert(
        ids=chunk_ids,              # ["resume_chunk_0", "resume_chunk_1", ...]
        documents=chunks,           # ["Spring Boot 3년...", "MSA 설계...", ...]
        embeddings=embeddings,      # [[0.82, 0.15, ...], [0.75, 0.20, ...], ...]
        metadatas=chunk_metadatas,  # [{"doc_id": "resume", "chunk_index": 0}, ...]
    )

    logger.info("벡터 저장 완료: session_id=%s doc_id=%s chunks=%d",
                session_id, doc_id, len(chunks))
    return len(chunks)


# ──────────────────────────────────────────
# 핵심 함수 2: 유사 청크 검색
# ──────────────────────────────────────────
async def search_similar(session_id: str, query: str, n_results: int = 3) -> List[str]:
    """
    목적: 질문 텍스트와 가장 비슷한 청크 3개를 검색

    동작 순서:
    1. query → embed_texts()로 벡터 변환
    2. ChromaDB에서 코사인 유사도가 높은 청크 n개 반환

    중요: 검색 실패해도 빈 리스트만 반환 → 면접이 멈추지 않음
    """
    try:
        collection = _get_collection(session_id)

        # 컬렉션이 비어있으면 검색 불가
        if collection.count() == 0:
            return []

        # 검색 쿼리를 벡터로 변환
        query_embeddings = await embed_texts([query])

        # ChromaDB 유사도 검색
        results = collection.query(
            query_embeddings=query_embeddings,
            n_results=min(n_results, collection.count()),  # 저장된 것보다 많이 요청하면 오류
        )

        # results 구조: {"documents": [["청크1", "청크2", "청크3"]]}
        # → [0]을 해야 실제 리스트를 얻음 (쿼리별 중첩 리스트)
        documents = results.get("documents", [[]])[0]
        return [doc for doc in documents if doc]  # 빈 문자열 제외

    except Exception as error:
        logger.warning("벡터 검색 실패 (RAG 건너뜀): %s", error)
        return []  # 실패해도 빈 리스트 → 면접 계속 진행


# ──────────────────────────────────────────
# 핵심 함수 3: 컬렉션 삭제 (세션 종료 시)
# ──────────────────────────────────────────
def delete_session_collection(session_id: str) -> None:
    """
    목적: 면접 종료 시 해당 세션의 벡터 데이터를 완전히 삭제

    동작: ChromaDB에서 "session_{session_id}" 컬렉션을 통째로 삭제

    주의:
    - 삭제 후 복구 불가능
    - 이미 없는 컬렉션을 삭제해도 WARNING만 뜨고 크래시하지 않음
    """
    try:
        client = _get_client()
        collection_name = f"session_{session_id}"
        client.delete_collection(name=collection_name)
        logger.info("세션 컬렉션 삭제: %s", collection_name)
    except Exception as error:
        logger.warning("컬렉션 삭제 실패: %s — %s", session_id, error)
```

---

# 11. document.py 라우터 완전 해설

**파일 위치:** `ai-server/routers/document.py`
**역할:** 파일 업로드 → 텍스트 추출 → (선택적) 벡터 저장

```python
"""
문서 텍스트 추출 API — 전체 코드 + 줄별 해설
"""

from typing import Optional
from fastapi import APIRouter, File, Form, Request, UploadFile
from limiter import limiter
from schemas.document import DocumentExtractResponse
from services.document_service import extract_document_text
from services.vector_service import upsert_document

router = APIRouter(prefix="/extract", tags=["Document"])


@router.post("/document", response_model=DocumentExtractResponse)
@limiter.limit("10/minute")  # 1분에 10번까지만 호출 가능 (남용 방지)
async def extract_document(
    request: Request,
    file: UploadFile = File(...),               # 업로드할 파일 (필수)
    session_id: Optional[str] = Form(None),     # 세션 ID (선택) ← ★ 핵심!
    doc_id: Optional[str] = Form(None),         # 문서 ID (선택)
) -> DocumentExtractResponse:
    """
    [동작 흐름]

    1. 파일에서 텍스트 추출 (PDF → 텍스트, TXT → 그대로)
    2. session_id가 있으면 → ChromaDB에 벡터 저장
       session_id가 없으면 → 텍스트만 반환 (벡터 저장 안 함)
    3. 추출된 텍스트를 응답으로 반환

    [왜 session_id가 선택적인가?]
    - 문서 업로드 자체는 면접 시작 전에도 할 수 있음
    - 면접 세션이 생성된 후에 session_id를 넘기면 그때 벡터 저장
    - session_id 없이 호출하면 단순 텍스트 추출만 수행
    """

    # 1단계: 파일에서 텍스트 추출
    extracted_text = await extract_document_text(file)

    # 2단계: session_id가 있으면 벡터 저장
    if session_id:
        effective_doc_id = doc_id or (file.filename or "unknown")
        try:
            chunk_count = await upsert_document(session_id, effective_doc_id, extracted_text)
            logger.info("RAG 벡터 저장 완료: chunks=%d", chunk_count)
        except Exception as error:
            # ★ 중요: 벡터 저장 실패해도 텍스트는 정상 반환!
            # 벡터 저장은 "부가 기능"이므로 실패해도 핵심 기능(텍스트 추출)은 동작
            logger.warning("벡터 저장 실패: %s", error)

    # 3단계: 추출된 텍스트 반환
    return DocumentExtractResponse(extractedText=extracted_text)
```

### curl로 이 API 테스트하기

```bash
# 텍스트만 추출 (벡터 저장 X)
curl -X POST http://localhost:8000/extract/document \
  -F "file=@이력서.pdf"

# 텍스트 추출 + 벡터 저장 (session_id 포함)
curl -X POST http://localhost:8000/extract/document \
  -F "file=@이력서.pdf" \
  -F "session_id=42" \
  -F "doc_id=resume"
```

---

# 12. interview_service.py RAG 부분 해설

**파일 위치:** `ai-server/services/interview_service.py`
**역할:** 면접 질문 생성 시 RAG 컨텍스트를 프롬프트에 주입

```python
# RAG 컨텍스트 빌더 — 핵심 함수

async def _build_rag_context(session_id: Optional[str], query: str) -> str:
    """
    목적: ChromaDB에서 유사 청크를 검색해 프롬프트에 넣을 문자열로 만들기

    입력:
      session_id = "42"
      query = "이력서 내용 + 채용공고 내용" (합쳐서 검색)

    출력 (성공 시):
      "[관련 청크 1]
       Spring Boot 기반 MSA 아키텍처를 설계하고...

       [관련 청크 2]
       Redis Cluster를 도입해 분산 캐시...

       [관련 청크 3]
       Kafka 기반 이벤트 드리븐 시스템을..."

    출력 (실패 시):
      "(없음)"
    """
    if not session_id:
        return "(없음)"  # session_id가 없으면 RAG 불가

    # ChromaDB에서 유사 청크 3개 검색
    chunks = await search_similar(session_id, query, n_results=3)

    if not chunks:
        return "(없음)"  # 검색 결과 없으면

    # 번호를 붙여서 포맷팅
    return "\n\n".join(
        f"[관련 청크 {i + 1}]\n{chunk}"
        for i, chunk in enumerate(chunks)
    )


# 질문 생성 함수에서 RAG를 사용하는 부분

async def generate_interview_question(
    resume_content, cover_letter_content, job_description,
    conversation_history, question_type=None, session_id=None,
):
    # ...

    # RAG 검색 쿼리 = 이력서 + 채용공고 (가장 관련 높은 정보)
    rag_query = (resume_content or "") + " " + (job_description or "")
    rag_context = await _build_rag_context(session_id, rag_query)

    # 프롬프트에 주입
    # interview_question_human.txt에 {rag_context} 플레이스홀더가 있음
    human_prompt = _load_prompt("interview_question_human.txt").format(
        resume_content=resume_content or "(없음)",
        cover_letter_content=cover_letter_content or "(없음)",
        job_description=job_description or "(없음)",
        rag_context=rag_context,    # ★ 여기에 RAG 결과가 들어감!
        conversation_history=_format_history(conversation_history),
        question_type=resolved_type,
    )

    # GPT-4o가 이 프롬프트를 보고 맥락 있는 질문을 생성
    # ...
```

### 프롬프트에서 RAG가 어떻게 사용되나

```
# ai-server/prompts/interview_question_human.txt (일부)

## 지원자 이력서
{resume_content}

## 자기소개서
{cover_letter_content}

## 채용 공고
{job_description}

## 관련 문서 참고 (RAG)          ← ★ 이 부분!
{rag_context}

## 이전 대화 기록
{conversation_history}

위 내용을 바탕으로 면접 질문을 생성해주세요.
```

```
[RAG 없을 때 GPT-4o가 받는 프롬프트]
## 관련 문서 참고 (RAG)
(없음)
→ 이력서 전체를 훑어보며 일반적인 질문 생성

[RAG 있을 때 GPT-4o가 받는 프롬프트]
## 관련 문서 참고 (RAG)
[관련 청크 1]
분산 캐시 시스템을 설계하고 Redis Cluster를 도입하여...

[관련 청크 2]
Kafka를 활용한 이벤트 드리븐 아키텍처를 구축하여...

[관련 청크 3]
초당 10만 요청을 처리하는 API 게이트웨이를 구축...

→ 이 3개의 핵심 내용에 집중해서 구체적인 질문 생성!
```

---

# Part 4. 실행과 테스트

---

# 13. 개발 환경에서 실행하기

## 13-1. 필요한 것

```
1. Python 3.10+
2. pip install chromadb openai  (또는 pip install -r requirements.txt)
3. OPENAI_API_KEY 환경변수 설정
```

## 13-2. 메모리 모드로 실행 (가장 간단)

```bash
# ai-server/.env에 CHROMA_HOST를 설정하지 않으면 자동으로 메모리 모드
cd ai-server
pip install -r requirements.txt

# .env 파일에 OPENAI_API_KEY만 설정
echo "OPENAI_API_KEY=sk-..." > .env

# 서버 실행
uvicorn main:app --host 0.0.0.0 --port 8000

# 로그에 이렇게 뜨면 성공:
# WARNING: CHROMA_HOST 환경변수 없음 — 메모리 기반 ChromaDB 사용
```

**메모리 모드의 장단점:**
```
장점: 별도 설치 불필요, 즉시 시작
단점: 서버 재시작하면 데이터 사라짐
용도: 개발, 테스트
```

---

# 14. Docker로 실행하기

## 14-1. docker-compose.yml의 ChromaDB 부분

```yaml
# 이 프로젝트의 docker-compose.yml에서 ChromaDB 관련 부분

services:
  chromadb:
    image: chromadb/chroma:latest       # ChromaDB 공식 이미지
    ports:
      - "8001:8000"                      # 호스트 8001 → 컨테이너 8000
    volumes:
      - chroma_data:/chroma/chroma       # 데이터 영구 보존
    environment:
      - ANONYMIZED_TELEMETRY=false       # 익명 사용 통계 비활성화
    healthcheck:                         # 헬스체크
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/heartbeat"]
      interval: 10s
      timeout: 5s
      retries: 3

  ai-server:
    build: ./ai-server
    environment:
      - CHROMA_HOST=chromadb             # ★ 이게 있으면 HTTP 모드로 연결
      - CHROMA_PORT=8000                 # 컨테이너 내부 포트
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      chromadb:
        condition: service_healthy       # ChromaDB가 준비된 후에 시작

volumes:
  chroma_data:                           # 컨테이너 삭제해도 데이터 유지
```

## 14-2. Docker 실행

```bash
# 전체 서비스 실행
docker compose up -d

# ChromaDB만 실행 (개발 중)
docker compose up -d chromadb

# 로그 확인
docker compose logs ai-server

# ChromaDB 상태 확인
curl http://localhost:8001/api/v1/heartbeat
# 응답: {"nanosecond heartbeat": 1234567890}
```

## 14-3. Docker vs 메모리 모드 비교

```
┌──────────────┬─────────────────────┬─────────────────────┐
│              │ 메모리 모드          │ Docker 모드          │
├──────────────┼─────────────────────┼─────────────────────┤
│ 설정         │ 아무것도 안 함       │ docker compose up    │
│ 데이터 보존  │ 서버 재시작 시 삭제  │ 영구 보존            │
│ 속도         │ 매우 빠름           │ 빠름                 │
│ 용도         │ 개발/테스트          │ 스테이징/운영        │
│ 환경변수     │ CHROMA_HOST 없음    │ CHROMA_HOST=chromadb │
└──────────────┴─────────────────────┴─────────────────────┘
```

---

# 15. 직접 테스트해보기

## 15-1. 문서 업로드 + 벡터 저장

```bash
# 이력서 파일 업로드 (session_id 포함)
curl -X POST http://localhost:8000/extract/document \
  -F "file=@이력서.pdf" \
  -F "session_id=test_1" \
  -F "doc_id=resume"

# 응답:
# {"extractedText": "저는 OO대학교 컴퓨터공학과를 졸업했습니다..."}

# 서버 로그:
# INFO: 벡터 저장 완료: session_id=test_1 doc_id=resume chunks=5
```

## 15-2. 텍스트 직접 벡터 저장 (Python)

```python
# Python 스크립트로 직접 테스트
import asyncio
from services.vector_service import upsert_document, search_similar

async def test():
    # 1. 저장
    text = """
    저는 Spring Boot 기반의 마이크로서비스를 3년간 개발했습니다.
    Redis Cluster를 활용한 분산 캐시 시스템을 구축했으며,
    Kafka 기반의 이벤트 드리븐 아키텍처를 설계한 경험이 있습니다.
    최근에는 AI 서비스의 API 설계에 관심을 갖고 있으며,
    LangChain과 FastAPI를 활용한 RAG 시스템을 구현했습니다.
    """
    chunk_count = await upsert_document("test_session", "resume", text)
    print(f"저장된 청크 수: {chunk_count}")

    # 2. 검색
    results = await search_similar("test_session", "캐시 시스템 경험")
    for i, doc in enumerate(results):
        print(f"\n[결과 {i+1}]")
        print(doc)

asyncio.run(test())
```

## 15-3. 면접 질문 생성 (RAG 포함)

```bash
# 면접 질문 요청 (session_id 포함 → RAG 활성화)
curl -X POST http://localhost:8000/interview/question \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test_1",
    "resumeContent": "Spring Boot 3년 경험, Redis 분산 캐시 구축",
    "coverLetterContent": "백엔드 개발자로서 성장하고 싶습니다",
    "jobDescription": "백엔드 시니어 개발자 모집",
    "conversationHistory": []
  }'

# 응답:
# {"question": "이력서에서 Redis Cluster를 활용한 분산 캐시 시스템을 구축하셨다고
#               하셨는데, 캐시 무효화(Cache Invalidation) 전략은 어떻게 설계하셨나요?"}
```

## 15-4. 컬렉션 삭제 확인

```bash
# 벡터 삭제 (3단계에서 구현할 엔드포인트)
curl -X DELETE http://localhost:8000/extract/vector/test_1

# 응답:
# {"message": "session_test_1 컬렉션 삭제 완료"}
```

---

# 16. 자주 나오는 오류와 해결법

## 오류 1: "OPENAI_API_KEY가 설정되지 않았습니다"

```
원인: 환경변수에 API 키가 없음
해결:
  # .env 파일에 추가
  OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx

  # 또는 직접 설정
  export OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

## 오류 2: "ChromaDB connection refused"

```
원인: Docker ChromaDB 컨테이너가 안 떠 있음
해결:
  docker compose up -d chromadb
  # 기다린 후
  curl http://localhost:8001/api/v1/heartbeat
```

## 오류 3: "Collection session_XX not found"

```
원인: 메모리 모드에서 서버를 재시작해서 데이터가 사라짐
해결:
  - Docker 모드로 전환 (CHROMA_HOST 설정)
  - 또는 문서를 다시 업로드
```

## 오류 4: "no such collection: session_XX" (삭제 시)

```
원인: 이미 삭제된 컬렉션을 다시 삭제하려 함
해결: 이 오류는 무시해도 됨 (코드에서 WARNING으로만 처리)
```

## 오류 5: 검색 결과가 비어있음

```
원인 1: session_id 없이 문서를 업로드해서 벡터가 저장 안 됨
원인 2: 메모리 모드에서 서버 재시작됨
원인 3: 아직 문서를 업로드하지 않음

확인 방법 (Python):
  from services.vector_service import _get_collection
  col = _get_collection("42")
  print(col.count())  # 0이면 비어있음
```

---

# Part 5. 실전 구현

---

# 17. 1단계 구현: RAG 프론트엔드 연결

## 17-1. 현재 문제 진단

```python
# ai-server/services/interview_service.py (현재)

async def generate_interview_question(
    resume_content, cover_letter_content, job_description,
    conversation_history, question_type=None, session_id=None,
):
    # RAG 검색 시도
    rag_query = (resume_content or "") + " " + (job_description or "")
    rag_context = await _build_rag_context(session_id, rag_query)
    # → session_id는 있지만, ChromaDB에 데이터가 없어서 "(없음)" 반환!
```

**문제:** session_id는 Java 백엔드에서 잘 전달되는데,
아무도 ChromaDB에 문서를 저장하지 않았으니 검색할 게 없습니다.

## 17-2. 해결: 첫 질문 생성 시 자동 벡터화

```python
# ai-server/services/interview_service.py (수정 후)

async def generate_interview_question(
    resume_content, cover_letter_content, job_description,
    conversation_history, question_type=None, session_id=None,
):
    # ★ 추가할 코드 (첫 질문일 때만 벡터화)
    if session_id and not conversation_history:
        # conversation_history가 비어있음 = 첫 번째 질문
        from services.vector_service import upsert_document
        try:
            if resume_content:
                await upsert_document(session_id, "resume", resume_content)
            if cover_letter_content:
                await upsert_document(session_id, "cover_letter", cover_letter_content)
            if job_description:
                await upsert_document(session_id, "job_description", job_description)
            logger.info("RAG 문서 자동 벡터화 완료: session_id=%s", session_id)
        except Exception as e:
            logger.warning("RAG 문서 벡터화 실패 (계속 진행): %s", e)

    # 이하 기존 코드 그대로
    rag_query = (resume_content or "") + " " + (job_description or "")
    rag_context = await _build_rag_context(session_id, rag_query)
    # → 이제 ChromaDB에 데이터가 있으니 유사 청크 3개 반환됨!
```

## 17-3. 왜 이렇게 하면 되나?

```
[수정 전]
1. Spring Boot → ai-server: "질문 만들어줘" (resumeContent 있음, sessionId 있음)
2. ai-server: RAG 검색 시도 → ChromaDB 비어있음 → "(없음)"
3. GPT-4o: 맥락 없는 질문 생성

[수정 후]
1. Spring Boot → ai-server: "질문 만들어줘" (resumeContent 있음, sessionId 있음)
2. ai-server: 첫 질문이니까 문서를 먼저 벡터화!
   - 이력서 → 청크 5개 → ChromaDB 저장
   - 자소서 → 청크 3개 → ChromaDB 저장
   - 채용공고 → 청크 2개 → ChromaDB 저장
3. ai-server: RAG 검색 → 유사 청크 3개 찾음!
4. GPT-4o: 맥락 있는 질문 생성 ✓
```

## 17-4. 왜 첫 질문에서만 벡터화하나?

```
Q: 매 질문마다 벡터화하면 안 되나?
A: 안 됩니다. 이유:

1. OpenAI 임베딩 API 호출 = 돈 + 시간
   - 이력서 10개 청크 × 질문 5번 = 50번 호출 (낭비)
   - 첫 번째에만 하면 10번만 호출 (효율적)

2. upsert이므로 같은 ID로 다시 저장해도 에러는 안 남
   - 하지만 매번 API 호출하는 건 낭비

3. 문서 내용은 세션 동안 바뀌지 않음
   - 한 번 저장하면 세션 끝날 때까지 유효
```

---

# 18. 3단계 구현: 세션 종료 시 컬렉션 정리

## 18-1. 현재 문제

```
면접 끝남 → 세션 상태 COMPLETED → 끝

ChromaDB에는 session_42 컬렉션이 그대로 남아있음
session_43, session_44, ... 계속 쌓임
→ 스토리지 낭비, 장기적으로 성능 저하
```

## 18-2. 해결: DELETE 엔드포인트 + 종료 시 호출

### (1) ai-server: 삭제 엔드포인트 추가

```python
# ai-server/routers/document.py에 추가

from services.vector_service import delete_session_collection

@router.delete(
    "/vector/{session_id}",
    summary="세션 벡터 컬렉션 삭제",
)
async def delete_vector_collection(session_id: str):
    """
    면접 종료 시 해당 세션의 ChromaDB 컬렉션을 삭제합니다.

    Spring Boot의 endSession()에서 호출됩니다.
    이미 삭제된 컬렉션에 대해 호출해도 에러가 나지 않습니다.
    """
    delete_session_collection(session_id)
    return {"message": f"session_{session_id} 컬렉션 삭제 완료"}
```

### (2) Spring Boot: 삭제 호출 메서드

```java
// PythonAiService.java에 추가

public void deleteVectorCollection(String sessionId) {
    try {
        // ai-server의 DELETE /extract/vector/{sessionId} 호출
        restTemplate.delete(aiServerUrl + "/extract/vector/" + sessionId);
        log.debug("벡터 컬렉션 삭제 완료: session_{}", sessionId);
    } catch (Exception e) {
        // 삭제 실패해도 면접 종료는 정상 진행 (부가 기능이므로)
        log.warn("벡터 컬렉션 삭제 실패 (무시): session_{} — {}", sessionId, e.getMessage());
    }
}
```

### (3) Spring Boot: 세션 종료 시 호출

```java
// InterviewService.java의 endSession() 끝에 추가

public InterviewSessionResponse endSession(Long sessionId, Long userId) {
    // ... 기존 종료 로직 (상태 변경, 피드백 생성) ...

    // ★ 추가: ChromaDB 컬렉션 정리
    aiService.deleteVectorCollection(session.getId().toString());

    return InterviewSessionResponse.from(session);
}
```

## 18-3. 전체 흐름

```
[면접 종료 흐름 — 수정 후]

사용자: "면접 종료" 클릭
  ↓
프론트엔드: POST /api/interviews/{sessionId}/end
  ↓
Spring Boot InterviewService.endSession():
  1. session.status = COMPLETED
  2. 피드백 생성 요청 → ai-server
  3. ★ aiService.deleteVectorCollection("42")
       ↓
     ai-server: DELETE /extract/vector/42
       ↓
     vector_service.delete_session_collection("42")
       ↓
     ChromaDB: "session_42" 컬렉션 삭제 ✓
  4. 응답 반환
  ↓
프론트엔드: 피드백 화면으로 이동
```

## 18-4. 엣지 케이스 처리

```
Q: 벡터화를 안 한 세션을 종료하면?
A: delete_session_collection()이 "컬렉션 없음" 예외를 catch하고
   WARNING만 남기고 정상 진행됩니다.

Q: 삭제 API 호출이 실패하면?
A: PythonAiService.deleteVectorCollection()이 예외를 catch하고
   WARNING만 남기고 면접 종료는 정상 완료됩니다.
   → 면접 종료가 벡터 삭제 때문에 실패하면 안 되니까요.

Q: 같은 세션에 대해 두 번 삭제하면?
A: 두 번째는 "이미 없음" WARNING만 뜨고 정상입니다.
```

---

# 부록: 핵심 용어 정리

| 용어 | 설명 | 비유 |
|------|------|------|
| **Vector** | 숫자 배열 [0.82, 0.15, ...] | 텍스트의 "좌표" |
| **Embedding** | 텍스트 → 벡터 변환 | 텍스트에 GPS 좌표 부여 |
| **Chunk** | 텍스트를 잘라놓은 조각 (500자) | 책의 페이지 |
| **Collection** | 벡터들을 모아놓은 그룹 | 폴더 |
| **Upsert** | 있으면 업데이트, 없으면 추가 | "덮어쓰기 저장" |
| **Query** | 검색할 텍스트 | 구글에 입력하는 검색어 |
| **Cosine Similarity** | 두 벡터의 유사도 (0~1) | 두 화살표의 방향 차이 |
| **RAG** | 검색 후 AI에게 참고자료 전달 | 시험 전에 족보 보기 |
| **ChromaDB** | 벡터를 저장하는 DB | 벡터 전용 창고 |
| **EphemeralClient** | 메모리 기반 임시 DB | 화이트보드 (지우면 사라짐) |
| **HttpClient** | 서버에 연결하는 영구 DB | 금고 (영구 보관) |
