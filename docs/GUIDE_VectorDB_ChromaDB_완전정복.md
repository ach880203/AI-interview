# Vector DB · ChromaDB · RAG 완전 정복 가이드

> 이 문서는 Vector DB, ChromaDB, RAG를 **완전 처음 접하는 사람**을 위해 작성했습니다.
> "이게 뭔지", "왜 쓰는지", "어떻게 동작하는지", "코드를 어떻게 쓰는지"를
> 처음 배우는 학생에게 가르쳐주는 선생님처럼 단계별로 설명합니다.
> 모든 설명은 **이 프로젝트에서 실제로 작성된 코드**를 기준으로 합니다.

---

## 목차

1. [Vector DB가 왜 필요한가 — 기존 DB의 한계](#1-vector-db가-왜-필요한가--기존-db의-한계)
2. [임베딩(Embedding)이란 무엇인가](#2-임베딩embedding이란-무엇인가)
3. [Vector DB란 무엇인가](#3-vector-db란-무엇인가)
4. [ChromaDB 소개](#4-chromadb-소개)
5. [RAG란 무엇인가](#5-ragretrieval-augmented-generation이란)
6. [이 프로젝트에서 RAG가 어떻게 동작하는가](#6-이-프로젝트에서-rag가-어떻게-동작하는가)
7. [embedding_service.py 완전 해설](#7-embedding_servicepy-완전-해설)
8. [vector_service.py 완전 해설](#8-vector_servicepy-완전-해설)
9. [document.py 라우터 완전 해설](#9-documentpy-라우터-완전-해설)
10. [interview_service.py RAG 적용 완전 해설](#10-interview_servicepy-rag-적용-완전-해설)
11. [백엔드 Java에서 sessionId 전달하는 원리](#11-백엔드-java에서-sessionid-전달하는-원리)
12. [Docker Compose로 ChromaDB 실행하기](#12-docker-compose로-chromadb-실행하기)
13. [개발 환경 실행 순서](#13-개발-환경-실행-순서)
14. [자주 나오는 오류와 해결법](#14-자주-나오는-오류와-해결법)
15. [전체 흐름 최종 요약](#15-전체-흐름-최종-요약)

---

# 1. Vector DB가 왜 필요한가 — 기존 DB의 한계

## 1-1. 우리가 아는 일반 DB (MariaDB)

지금까지 사용하던 MariaDB는 **정확한 값**을 찾는 데 특화되어 있습니다.

```sql
-- "정확히 일치"하는 것만 찾을 수 있음
SELECT * FROM resumes WHERE content LIKE '%Spring Boot%';

-- "Spring Boot를 잘 아는 개발자 경험 관련 내용"을 찾고 싶어도
-- LIKE는 글자 패턴만 비교 → 의미를 모름
```

예를 들어 이런 상황을 생각해봅시다.

```
사용자의 이력서에 이런 내용이 있습니다:
  "저는 백엔드 프레임워크를 3년간 사용했으며,
   마이크로서비스 아키텍처를 설계한 경험이 있습니다."

AI 면접관이 이 이력서를 보고 이런 질문을 생성하고 싶습니다:
  "Spring Boot와 관련된 심층 질문을 하고 싶다"

LIKE 검색으로는?
  LIKE '%Spring Boot%' → "Spring Boot"라는 단어가 없으니 못 찾음

하지만 의미적으로는:
  "백엔드 프레임워크 3년" ≈ "Spring Boot 경험"
  마이크로서비스 ≈ Spring Boot 생태계와 관련

→ 의미가 비슷한데도 일반 DB는 찾을 수 없음
```

## 1-2. 의미 기반 검색이 필요한 이유

```
면접 상황:
  지원자: "저는 분산 시스템을 다뤄봤어요"

  면접관(AI)이 이력서에서 관련 내용을 찾고 싶음:
    → "분산 시스템", "MSA", "마이크로서비스", "Kafka", "Redis Cluster" 등
       다양한 표현 모두가 관련 있음

  LIKE '%분산 시스템%':
    → "MSA 경험"이 있어도 단어가 다르면 못 찾음

  의미 기반 검색 (Vector DB):
    → "분산 시스템"의 의미와 비슷한 모든 텍스트를 찾음
    → "MSA", "마이크로서비스", "컨테이너 오케스트레이션" 등도 검색됨
```

**결론:** 텍스트의 "의미"를 기준으로 검색하려면 Vector DB가 필요합니다.

---

# 2. 임베딩(Embedding)이란 무엇인가

## 2-1. 컴퓨터는 텍스트를 이해하지 못한다

컴퓨터는 기본적으로 숫자만 다룰 수 있습니다.

```
사람:     "Spring Boot는 백엔드 프레임워크야" → 의미 이해 O
컴퓨터:   "Spring Boot는 백엔드 프레임워크야" → 글자 나열일 뿐, 의미 X
```

그렇다면 텍스트의 "의미"를 컴퓨터가 다루려면 어떻게 해야 할까요?

## 2-2. 텍스트를 숫자 벡터로 변환한다

**임베딩(Embedding)** = 텍스트를 의미를 담은 숫자 배열(벡터)로 변환하는 기술

```
"Java 백엔드 개발 3년" → [0.23, -0.45, 0.89, 0.12, 0.67, ..., 0.34]
                                                         (숫자 1536개)

"Spring Boot API 개발" → [0.21, -0.44, 0.91, 0.10, 0.65, ..., 0.33]
                                                         (숫자 1536개)

"강아지 산책 하기"     → [-0.67, 0.34, -0.12, 0.89, -0.23, ..., 0.71]
                                                         (숫자 1536개)
```

**핵심 규칙:** 의미가 비슷한 텍스트 → 비슷한 숫자 배열

```
"Java 백엔드" 벡터:    [0.23, -0.45, 0.89, ...]
"Spring Boot 개발" 벡터: [0.21, -0.44, 0.91, ...]
→ 숫자가 비슷함 → 의미가 비슷하다

"강아지 산책" 벡터:    [-0.67, 0.34, -0.12, ...]
→ 숫자가 완전히 다름 → 의미가 관련 없다
```

## 2-3. 1536차원이란?

우리 프로젝트는 OpenAI의 `text-embedding-3-small` 모델을 사용합니다.
이 모델은 텍스트를 **1536개 숫자**로 변환합니다.

```
1차원: 점 (숫자 1개) — 위치 1개
2차원: 평면 (숫자 2개) — x, y 좌표
3차원: 공간 (숫자 3개) — x, y, z 좌표
1536차원: 상상하기 어렵지만, 텍스트의 의미를 1536가지 측면으로 표현
```

왜 차원이 많을수록 좋을까요?

```
2차원으로 "사람"을 표현한다면:
  [키, 몸무게] → 체형만 표현 가능, 성격·나이·직업 표현 불가

10차원으로 "사람"을 표현한다면:
  [키, 몸무게, 나이, 성격, 직업, ...] → 더 정확하게 표현

1536차원으로 텍스트를 표현한다면:
  → 의미, 문체, 주제, 감정, 도메인... 매우 세밀하게 표현 가능
  → 유사도 계산이 매우 정확해짐
```

## 2-4. 유사도(Similarity)는 어떻게 계산하는가

두 벡터가 얼마나 비슷한지 수학적으로 계산합니다.

**코사인 유사도(Cosine Similarity):**

```
두 벡터의 "방향"이 얼마나 같은지 측정

방향이 같다 (각도 0°) → 코사인 유사도 = 1 → 매우 유사
방향이 다르다 (각도 90°) → 코사인 유사도 = 0 → 관련 없음
방향이 반대 (각도 180°) → 코사인 유사도 = -1 → 반대 의미

"Java 백엔드" ↔ "Spring Boot 개발":
  → 방향 거의 같음 → 유사도 0.95 (매우 유사)

"Java 백엔드" ↔ "강아지 산책":
  → 방향 전혀 다름 → 유사도 0.03 (관련 없음)
```

---

# 3. Vector DB란 무엇인가

## 3-1. 벡터를 저장하고 검색하는 데이터베이스

```
일반 DB (MariaDB):
  저장: 행·열 테이블 (텍스트, 숫자, 날짜)
  검색: WHERE 조건, LIKE, JOIN → 정확 일치

Vector DB (ChromaDB):
  저장: 벡터 (1536개 숫자 배열) + 원본 텍스트 + 메타데이터
  검색: 입력 벡터와 가장 "가까운" 벡터 찾기 → 의미 유사 검색
```

## 3-2. 어떻게 "가까운" 벡터를 찾는가 — HNSW 알고리즘

수백만 개의 벡터에서 가장 비슷한 것을 찾으려면 특별한 알고리즘이 필요합니다.

```
단순 방법 (모든 벡터와 비교):
  저장된 벡터 100만 개 × 쿼리 1개 = 100만 번 계산
  → 너무 느림

HNSW (계층적 그래프):
  벡터를 여러 층의 그래프로 연결
  → 관련 없는 벡터는 건너뜀
  → 100만 개에서도 밀리초 단위 검색
  → ChromaDB가 기본으로 사용하는 알고리즘
```

## 3-3. Vector DB와 일반 DB를 함께 쓰는 이유

```
이 프로젝트의 DB 구조:

MariaDB (일반 DB):
  - users 테이블: 회원 정보
  - resumes 테이블: 이력서 원본 텍스트 저장
  - interview_sessions 테이블: 세션 정보

ChromaDB (Vector DB):
  - session_42 컬렉션: 세션 42의 이력서 벡터들
  - session_43 컬렉션: 세션 43의 이력서 벡터들

역할 분담:
  MariaDB: "이 사용자의 이력서 원본 내용을 저장"
  ChromaDB: "이 이력서 중 지금 질문과 관련된 부분을 빠르게 찾기"
```

---

# 4. ChromaDB 소개

## 4-1. ChromaDB란?

ChromaDB는 **오픈소스 벡터 데이터베이스**입니다.

```
주요 특징:
  - 무료 오픈소스
  - Python 우선 (Python에서 가장 쉽게 사용)
  - 로컬 실행 가능 (클라우드 없이도 동작)
  - Docker 이미지 제공
  - FastAPI/LangChain과 잘 통합됨
```

유명한 Vector DB 비교:

```
ChromaDB:   로컬 실행 가능, 소규모 프로젝트 적합, 무료
Pinecone:   클라우드 서비스, 대규모 서비스, 유료
Weaviate:   오픈소스, 중대규모, 복잡한 설정
Milvus:     오픈소스, 대규모, 복잡한 설정

→ 이 프로젝트 규모에서는 ChromaDB가 가장 적합
```

## 4-2. ChromaDB의 데이터 구조

```
ChromaDB
└── 컬렉션(Collection) ← MariaDB의 "테이블"과 비슷
    ├── session_42      ← 면접 세션 42번 데이터
    │   ├── ID: "resume.pdf_chunk_0"
    │   │   ├── document: "저는 Java 개발자로 3년간..."  (원본 텍스트)
    │   │   ├── embedding: [0.23, -0.45, ...]          (벡터 1536개)
    │   │   └── metadata: {"doc_id": "resume.pdf", "chunk_index": 0}
    │   ├── ID: "resume.pdf_chunk_1"
    │   │   ├── document: "Spring Boot를 사용하여..."
    │   │   ├── embedding: [0.21, -0.44, ...]
    │   │   └── metadata: {"doc_id": "resume.pdf", "chunk_index": 1}
    │   └── ...
    └── session_43      ← 면접 세션 43번 데이터
        └── ...
```

## 4-3. ChromaDB 실행 방식 두 가지

```
방식 1: EphemeralClient (메모리)
  - 코드로 바로 생성, 별도 프로세스 없음
  - 서버 재시작하면 데이터 사라짐
  - 개발/테스트 환경에서 사용

방식 2: HttpClient (HTTP 서버)
  - 별도의 ChromaDB 서버 프로세스 실행
  - 데이터가 파일/볼륨에 영구 저장
  - Docker 컨테이너로 실행
  - 운영 환경에서 사용
```

---

# 5. RAG(Retrieval-Augmented Generation)이란?

## 5-1. GPT의 한계: 내 이력서를 모른다

```
일반적인 ChatGPT 사용:
  나: "내 이력서에서 Java 경험 관련 면접 질문 만들어줘"
  GPT: "이력서를 모르는데요?" → 일반적인 질문만 생성

이 프로젝트 목표:
  사용자의 이력서를 분석해서 개인화된 질문 생성
  "이력서에 Spring Boot 3년이라고 적혀 있으니까
   → Spring Boot의 DI 컨테이너에 대해 물어봐야겠다"
```

## 5-2. 이력서 전체를 GPT에 보내면 안 되는가?

```
이력서 3000자 전체를 GPT에 보내면:

  장점:
    - GPT가 모든 정보를 봄

  단점:
    - 토큰 비용 증가 (GPT-4o는 1000 토큰당 $0.01)
    - GPT의 "컨텍스트 윈도우" 제한 (한 번에 처리할 수 있는 최대 길이)
    - 중요한 정보가 긴 텍스트에 묻혀서 GPT가 놓칠 수 있음
    - 이력서 10개, 자기소개서 10개, 채용공고 10개를 모두 보내면
      → 수만 토큰 = 비용 폭증

  RAG 해결책:
    - 지금 질문과 "관련된 500자짜리 조각 3개"만 GPT에 전달
    - 비용 절감 + 품질 향상
```

## 5-3. RAG 동작 원리

```
RAG = Retrieval (검색) + Augmented (보강된) + Generation (생성)

단계 1 - 저장 (Indexing):
  이력서 원문 → 청크로 분할 → 각 청크를 벡터로 변환 → ChromaDB에 저장

단계 2 - 검색 (Retrieval):
  "면접 질문 생성" 요청 → 관련 청크 검색 → 상위 3개 선택

단계 3 - 생성 (Generation):
  검색된 청크 + 원래 질문 → GPT에 함께 전달 → 개인화된 답변 생성
```

## 5-4. RAG 적용 전후 비교

```
RAG 없을 때:
  GPT에 전달: "면접 질문을 만들어주세요"
  GPT 생성: "자기소개를 해주세요." (누구에게나 같은 질문)

RAG 있을 때:
  GPT에 전달:
    "면접 질문을 만들어주세요.
     [참고 자료]
     - 청크1: 'Java 개발 3년, Spring Boot 전문, JPA 사용 경험'
     - 청크2: 'AWS EC2 운영, S3 파일 업로드 구현'"

  GPT 생성:
    "이력서에 JPA를 사용하셨다고 하셨는데,
     N+1 문제를 겪어보신 경험이 있으신가요?
     어떻게 해결하셨나요?" (개인화된 심층 질문)
```

---

# 6. 이 프로젝트에서 RAG가 어떻게 동작하는가

## 6-1. 전체 흐름 다이어그램

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [1단계] 이력서 업로드 (문서를 벡터로 저장)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  사용자 → 브라우저 (파일 선택)
           │
           ▼
  POST /extract/document
  form-data: { file: 이력서.pdf, session_id: "42", doc_id: "resume.pdf" }
           │
           ▼ (ai-server/routers/document.py)
  PDF 텍스트 추출 (pypdf)
  "저는 Java 개발자로 3년간 근무했습니다. Spring Boot를..."
           │
           ▼ (ai-server/services/embedding_service.py)
  chunk_text() → 500자씩 분할
    청크0: "저는 Java 개발자로 3년간..."
    청크1: "Spring Boot를 사용하여..."
    청크2: "AWS EC2에서 서비스를..."
           │
           ▼
  embed_texts() → OpenAI API 호출 (1번에 모두 전송)
    청크0 → [0.23, -0.45, 0.89, ...] (1536개 숫자)
    청크1 → [0.21, -0.44, 0.91, ...]
    청크2 → [0.19, -0.43, 0.88, ...]
           │
           ▼ (ai-server/services/vector_service.py)
  ChromaDB "session_42" 컬렉션에 저장
  upsert(ids, documents, embeddings)
           │
           ▼
  응답: { "extractedText": "저는 Java 개발자로..." }


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [2단계] 면접 질문 생성 (RAG 검색 후 GPT에 주입)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Spring Boot → POST /interview/question
  JSON: { sessionId: "42", resumeContent: "...", jobDescription: "..." }
           │
           ▼ (ai-server/services/interview_service.py)
  _build_rag_context(session_id="42", query="Java 개발자... 백엔드 채용")
           │
           ▼
  embed_texts(["Java 개발자... 백엔드 채용"]) → 쿼리 벡터 [0.22, -0.43, ...]
           │
           ▼
  ChromaDB "session_42" 검색
    모든 청크 벡터와 코사인 유사도 계산:
      청크0: 유사도 0.95  ← 가장 관련 있음
      청크1: 유사도 0.89
      청크2: 유사도 0.71
    상위 3개 반환
           │
           ▼
  rag_context = """
    [관련 청크 1]
    저는 Java 개발자로 3년간 근무했습니다...

    [관련 청크 2]
    Spring Boot를 사용하여 REST API를...

    [관련 청크 3]
    AWS EC2에서 서비스를 운영했습니다...
  """
           │
           ▼
  GPT 프롬프트 구성:
    [이력서]: (전체)
    [채용공고]: (전체)
    [참고 자료]: rag_context  ← 핵심 내용 강조
    "위 정보로 면접 질문 하나 생성하세요"
           │
           ▼
  GPT-4o 호출
           │
           ▼
  "이력서에 JPA를 사용하셨다고 하셨는데, N+1 문제 경험이 있으신가요?"
```

## 6-2. sessionId가 핵심인 이유

```
세션 ID = 면접 한 번의 고유 번호

왜 세션 단위로 분리하는가?

  사용자 A, 세션 42: "Java 백엔드 이력서"
  사용자 B, 세션 43: "React 프론트엔드 이력서"

  session_42 컬렉션 → A의 문서만 저장
  session_43 컬렉션 → B의 문서만 저장

  A의 면접에서 검색 → session_42만 검색 → B의 이력서 절대 노출 안 됨

보안 + 격리 + 정확도 모두 해결
```

---

# 7. embedding_service.py 완전 해설

**파일:** `ai-server/services/embedding_service.py`

```python
"""
텍스트 임베딩 서비스

[역할]
OpenAI text-embedding-3-small 모델을 사용해 텍스트를 1536차원 벡터로 변환합니다.
긴 텍스트는 chunk_text()로 잘라낸 뒤 각 청크를 임베딩합니다.
"""

import os
from typing import List

from fastapi import HTTPException
from openai import AsyncOpenAI
```

**임포트 해설:**

```python
import os
# 환경변수 읽기용 (OPENAI_API_KEY)
# os.getenv("OPENAI_API_KEY") → .env 파일의 값 읽어옴

from typing import List
# 파이썬 타입 힌트 (List[str] = 문자열 리스트)
# Python 3.9 이후로는 list[str]로 써도 되지만
# 호환성을 위해 typing.List 사용

from fastapi import HTTPException
# FastAPI에서 HTTP 에러를 발생시키는 클래스
# raise HTTPException(status_code=503) → 클라이언트에 503 응답 전송

from openai import AsyncOpenAI
# OpenAI 비동기 클라이언트
# Async = 비동기 (await 사용 가능)
# → API 응답 기다리는 동안 다른 요청 처리 가능
```

---

## 7-1. 상수 설정

```python
# 임베딩 모델명 — 비용·품질 균형이 좋은 small 모델 사용
_EMBEDDING_MODEL = "text-embedding-3-small"

# 청크 크기 및 겹침 설정
_CHUNK_SIZE = 500
_CHUNK_OVERLAP = 50
```

**왜 변수명 앞에 `_`(언더스코어)가 붙는가?**

```python
# 파이썬 관례:
# _이름 = 이 모듈 내부에서만 사용 (외부에서 임포트 자제)
# 이름  = 외부에서도 사용 가능 (공개 API)

# 예시:
_EMBEDDING_MODEL = "..."  # 내부 상수 (외부에서 직접 사용하지 말 것)
embed_texts = ...          # 외부에서 호출 가능한 함수
```

**모델 선택 이유:**

```
text-embedding-3-small:
  - 벡터 차원: 1536
  - 비용: $0.02 / 1M 토큰 (매우 저렴)
  - 속도: 빠름

text-embedding-3-large:
  - 벡터 차원: 3072
  - 비용: $0.13 / 1M 토큰 (6.5배 비쌈)
  - 속도: 느림

→ 면접 질문 생성 수준에서는 small로 충분
```

---

## 7-2. chunk_text() 함수 완전 해설

```python
def chunk_text(text: str, chunk_size: int = _CHUNK_SIZE, overlap: int = _CHUNK_OVERLAP) -> List[str]:
```

**함수 시그니처 읽는 법:**

```python
def chunk_text(          # 함수 이름
    text: str,           # 파라미터1: 분할할 텍스트 (문자열)
    chunk_size: int = 500, # 파라미터2: 청크 크기 (기본값 500)
    overlap: int = 50    # 파라미터3: 겹침 크기 (기본값 50)
) -> List[str]:          # 반환 타입: 문자열 리스트
```

**전체 구현:**

```python
def chunk_text(text: str, chunk_size: int = _CHUNK_SIZE, overlap: int = _CHUNK_OVERLAP) -> List[str]:
    if not text or not text.strip():
        return []
    # ↑ 텍스트가 None이거나 공백만 있으면 빈 리스트 반환
    # text.strip() = 앞뒤 공백 제거 후 빈 문자열이면 False

    chunks: List[str] = []  # 결과를 담을 빈 리스트
    start = 0               # 현재 청크의 시작 위치

    while start < len(text):
        # ① 끝 위치 계산
        end = start + chunk_size   # 500자 뒤

        # ② 텍스트 잘라내기
        chunk = text[start:end].strip()
        # text[0:500] = 0번째부터 499번째까지 (500자)
        # .strip() = 청크 앞뒤 공백 제거

        # ③ 빈 청크가 아니면 추가
        if chunk:
            chunks.append(chunk)

        # ④ 다음 청크 시작 위치 계산 (overlap만큼 겹침)
        start = end - overlap
        # 500 - 50 = 450 → 450번째부터 다음 청크 시작
        # → 450~500 구간(50자)이 이전 청크와 겹침

    return chunks
```

**숫자로 이해하기 (텍스트 1200자, chunk_size=500, overlap=50):**

```
시작:
  start=0, end=500  → text[0:500]   → 청크0 (0~499번째 글자)
  start = 500-50 = 450

2번째:
  start=450, end=950 → text[450:950] → 청크1 (450~949번째)
  450~499번째 = 이전 청크와 겹치는 50자
  start = 950-50 = 900

3번째:
  start=900, end=1400 → text[900:1200] → 청크2 (900~1199, 텍스트 끝까지)
  start = 1400-50 = 1350

4번째:
  start=1350 > len(text)=1200 → while 종료

결과: 3개의 청크
```

---

## 7-3. embed_texts() 함수 완전 해설

```python
async def embed_texts(texts: List[str]) -> List[List[float]]:
```

**`async`가 왜 필요한가:**

```python
# 동기 함수 (sync):
def embed_texts_sync(texts):
    response = openai.embed(texts)  # 이 줄에서 0.5초 대기
    return response                 # 대기하는 동안 다른 요청 처리 불가

# 비동기 함수 (async):
async def embed_texts_async(texts):
    response = await openai.embed(texts)  # 대기 중에 다른 요청 처리 가능
    return response

# FastAPI는 비동기로 동작하므로 async 사용 권장
```

**전체 구현:**

```python
async def embed_texts(texts: List[str]) -> List[List[float]]:
    # ① 빈 리스트 체크 — API 호출 비용 절약
    if not texts:
        return []

    # ② API 키 확인
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    # ↑ 503 Service Unavailable: 서버 자체는 살아있지만 의존 서비스(OpenAI) 사용 불가

    # ③ 비동기 OpenAI 클라이언트 생성
    client = AsyncOpenAI(api_key=api_key)

    try:
        # ④ 임베딩 API 호출 (배치 처리 — 리스트를 한 번에 전송)
        response = await client.embeddings.create(
            model=_EMBEDDING_MODEL,  # "text-embedding-3-small"
            input=texts,             # ["텍스트1", "텍스트2", "텍스트3"]
        )
        # ↑ API 1번 호출로 여러 텍스트를 한 번에 임베딩
        # 개별 호출보다 훨씬 빠르고 비용도 같음

        # ⑤ 응답 구조 이해
        # response.data = [
        #   EmbeddingObject(index=0, embedding=[0.23, ...]),
        #   EmbeddingObject(index=1, embedding=[0.21, ...]),
        #   EmbeddingObject(index=2, embedding=[0.19, ...]),
        # ]

        # ⑥ index 기준으로 정렬 (API 응답 순서 보장을 위해)
        sorted_data = sorted(response.data, key=lambda item: item.index)
        # lambda item: item.index = 각 객체의 index 값으로 정렬

        # ⑦ 벡터만 추출해서 반환
        return [item.embedding for item in sorted_data]
        # 리스트 컴프리헨션: [각 item의 embedding, for 각 item in sorted_data]
        # 반환값: [[벡터1], [벡터2], [벡터3]] (2중 리스트)

    except Exception as error:
        raise HTTPException(status_code=502, detail=f"텍스트 임베딩 실패: {error}")
        # ↑ 502 Bad Gateway: 상위 서비스(OpenAI)에서 오류 발생
```

**반환값 구조:**

```python
texts = ["Java 개발 3년", "Spring Boot 사용", "AWS 운영"]

result = await embed_texts(texts)
# result = [
#   [0.23, -0.45, 0.89, ..., 0.34],  # "Java 개발 3년"의 벡터 (1536개)
#   [0.21, -0.44, 0.91, ..., 0.33],  # "Spring Boot 사용"의 벡터 (1536개)
#   [0.19, -0.43, 0.88, ..., 0.31],  # "AWS 운영"의 벡터 (1536개)
# ]
# result[0] = "Java 개발 3년"의 벡터
# result[1] = "Spring Boot 사용"의 벡터
# result[0][0] = 0.23 (벡터의 첫 번째 숫자)
```

---

# 8. vector_service.py 완전 해설

**파일:** `ai-server/services/vector_service.py`

```python
import logging
import os
from typing import List, Optional

import chromadb

from services.embedding_service import chunk_text, embed_texts

logger = logging.getLogger(__name__)
```

**`logger = logging.getLogger(__name__)` 이란?**

```python
# __name__ = 현재 파일의 모듈 이름 (예: "services.vector_service")
# 로거(Logger) = 로그를 출력하는 객체

# 사용:
logger.info("벡터 저장 완료: ...")   # 정보성 로그 (파란색)
logger.warning("검색 실패: ...")     # 경고 로그 (노란색)
logger.error("심각한 오류: ...")     # 에러 로그 (빨간색)

# print() 대신 logger를 쓰는 이유:
# - 로그 레벨 조절 가능 (개발: DEBUG, 운영: WARNING)
# - 어떤 파일에서 출력된 건지 자동 표시
# - 타임스탬프 자동 추가
```

---


## 8-1. 싱글턴 클라이언트 (_get_client)

```python
# ChromaDB 클라이언트를 전역 변수로 관리 (싱글턴 패턴)
_chroma_client: Optional[chromadb.ClientAPI] = None
# ↑ 처음에는 None (아직 연결 안 함)
# Optional[X] = X이거나 None일 수 있다는 타입 힌트


def _get_client() -> chromadb.ClientAPI:
    global _chroma_client
    # ↑ 이 함수 안에서 전역변수 _chroma_client를 수정하겠다고 선언
    # global 없이 _chroma_client = ... 하면 지역변수가 새로 만들어짐

    if _chroma_client is not None:
        return _chroma_client
    # ↑ 이미 연결이 있으면 재사용 → 새 연결 생성 비용 없음

    chroma_host = os.getenv("CHROMA_HOST")   # 예: "chromadb" 또는 None
    chroma_port = int(os.getenv("CHROMA_PORT", "8001"))
    # os.getenv("CHROMA_PORT", "8001") = 환경변수 없으면 "8001" 기본값 사용
    # int(...) = 문자열을 숫자로 변환

    if chroma_host:
        # Docker 컨테이너 환경: HTTP로 ChromaDB 서버에 연결
        _chroma_client = chromadb.HttpClient(host=chroma_host, port=chroma_port)
    else:
        # 로컬 개발 환경: 메모리에 저장 (재시작하면 사라짐)
        _chroma_client = chromadb.EphemeralClient()

    return _chroma_client
```

**싱글턴 패턴이 동작하는 방식:**

```
첫 번째 호출:
  _chroma_client = None
  → _chroma_client is not None? → False
  → CHROMA_HOST 확인 → HttpClient 생성
  → _chroma_client = <연결된 클라이언트>
  → 반환

두 번째 호출:
  _chroma_client = <연결된 클라이언트>
  → _chroma_client is not None? → True
  → 즉시 반환 (새 연결 안 함)

세 번째, 네 번째... 모두 같은 클라이언트 재사용
```

---

## 8-2. 컬렉션 관리 (_get_collection)

```python
def _get_collection(session_id: str) -> chromadb.Collection:
    client = _get_client()
    collection_name = f"session_{session_id}"
    # f"..." = f-string (변수를 문자열에 직접 삽입)
    # session_id = "42" → collection_name = "session_42"

    return client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
        # ↑ hnsw = 검색 알고리즘 이름 (Hierarchical Navigable Small World)
        #   space: "cosine" = 코사인 유사도 사용
        #   (다른 옵션: "l2" = 유클리드 거리, "ip" = 내적)
    )
    # get_or_create_collection:
    # - "session_42" 이미 있음 → 그것 가져옴
    # - "session_42" 없음 → 새로 만들고 가져옴
```

---

## 8-3. upsert_document() — 문서 저장

```python
async def upsert_document(session_id: str, doc_id: str, text: str) -> int:
```

**파라미터:**

```python
session_id = "42"        # 면접 세션 ID
doc_id = "resume.pdf"    # 문서 ID (같은 ID로 다시 업로드하면 덮어씀)
text = "저는 Java..."     # 저장할 텍스트 전체
```

**전체 구현 단계별 해설:**

```python
async def upsert_document(session_id: str, doc_id: str, text: str) -> int:
    # 1단계: 텍스트를 500자 청크로 분할
    chunks = chunk_text(text)
    # chunks = ["저는 Java 개발자로 3년간...", "Spring Boot를 사용...", ...]

    if not chunks:
        logger.warning("upsert_document: 청크 없음 (빈 텍스트) doc_id=%s", doc_id)
        return 0
    # ↑ 빈 텍스트면 저장할 것이 없으니 0 반환

    # 2단계: 청크별 고유 ID 생성
    chunk_ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
    # doc_id="resume.pdf", 청크 3개라면:
    # chunk_ids = ["resume.pdf_chunk_0", "resume.pdf_chunk_1", "resume.pdf_chunk_2"]

    # range(len(chunks)) = range(3) = [0, 1, 2]
    # f"{doc_id}_chunk_{i}" → 각 인덱스에 대해 ID 생성

    # 3단계: 메타데이터 생성 (나중에 어떤 문서의 몇 번째 청크인지 알기 위해)
    chunk_metadatas = [{"doc_id": doc_id, "chunk_index": i} for i in range(len(chunks))]
    # chunk_metadatas = [
    #   {"doc_id": "resume.pdf", "chunk_index": 0},
    #   {"doc_id": "resume.pdf", "chunk_index": 1},
    #   {"doc_id": "resume.pdf", "chunk_index": 2},
    # ]

    # 4단계: 모든 청크를 한 번에 임베딩 (API 1번 호출로 처리)
    embeddings = await embed_texts(chunks)
    # embed_texts(["청크0", "청크1", "청크2"]) → [[벡터0], [벡터1], [벡터2]]

    # 5단계: ChromaDB에 저장
    collection = _get_collection(session_id)
    collection.upsert(
        ids=chunk_ids,              # ["resume.pdf_chunk_0", ...]
        documents=chunks,           # ["저는 Java 개발자로...", ...]
        embeddings=embeddings,      # [[0.23, -0.45, ...], ...]
        metadatas=chunk_metadatas,  # [{"doc_id": "resume.pdf", ...}, ...]
    )
    # upsert = update + insert
    # - 같은 ID가 있으면 덮어씀 (update)
    # - 없으면 새로 추가 (insert)
    # → 같은 이력서를 수정 후 다시 업로드해도 안전하게 갱신됨

    logger.info("벡터 저장 완료: session_id=%s doc_id=%s chunks=%d",
                session_id, doc_id, len(chunks))
    # 로그 포맷: "벡터 저장 완료: session_id=42 doc_id=resume.pdf chunks=3"

    return len(chunks)  # 저장된 청크 수 반환 (로거·API 응답용)
```

---

## 8-4. search_similar() — 유사 청크 검색

```python
async def search_similar(session_id: str, query: str, n_results: int = 3) -> List[str]:
```

**파라미터:**

```python
session_id = "42"           # 어느 세션의 컬렉션에서 검색할지
query = "Java 백엔드 경험"   # 검색할 내용 (지금 질문 생성에 필요한 키워드)
n_results = 3               # 가장 유사한 청크 몇 개 가져올지
```

**전체 구현 단계별 해설:**

```python
async def search_similar(session_id: str, query: str, n_results: int = 3) -> List[str]:
    try:
        # 1단계: 컬렉션 가져오기
        collection = _get_collection(session_id)

        # 2단계: 빈 컬렉션 체크
        if collection.count() == 0:
            return []
        # ↑ 아직 문서를 업로드하지 않은 상태
        # 빈 컬렉션에 query하면 오류 발생 → 미리 체크

        # 3단계: 쿼리 텍스트를 벡터로 변환
        query_embeddings = await embed_texts([query])
        # [query] = 리스트로 감쌈 (embed_texts는 리스트를 받음)
        # 반환값: [[0.22, -0.43, 0.90, ...]] (2중 리스트)

        # 4단계: 유사도 검색
        results = collection.query(
            query_embeddings=query_embeddings,
            n_results=min(n_results, collection.count()),
            # min()을 쓰는 이유:
            # n_results=3인데 저장된 청크가 2개라면
            # → 3개 요청 = 오류 발생
            # → min(3, 2) = 2 → 2개만 요청해서 오류 방지
        )

        # 5단계: 결과 구조 이해
        # results = {
        #   "ids": [["id1", "id2", "id3"]],
        #   "documents": [["청크1 텍스트", "청크2 텍스트", "청크3 텍스트"]],
        #   "distances": [[0.05, 0.12, 0.18]],
        #   "metadatas": [[{"doc_id": ...}, ...]],
        # }
        # 왜 2중 리스트인가?
        # → query_embeddings에 여러 쿼리를 넣을 수 있어서 쿼리별로 중첩
        # → 우리는 쿼리가 1개이므로 [0]으로 첫 번째 결과만 사용

        documents = results.get("documents", [[]])[0]
        # results.get("documents", [[]]): 키 없으면 [[]] 반환 (안전)
        # [0]: 첫 번째 쿼리의 결과 리스트
        # → ["청크1 텍스트", "청크2 텍스트", "청크3 텍스트"]

        return [doc for doc in documents if doc]
        # None이나 빈 문자열 제거 후 반환

    except Exception as error:
        # 검색 실패해도 면접 진행은 계속할 수 있도록
        # → RAG 없이 기본 GPT로 자동 폴백
        logger.warning("벡터 검색 실패 (RAG 건너뜀): session_id=%s error=%s",
                       session_id, error)
        return []  # 빈 리스트 반환 → interview_service에서 "(없음)" 처리
```

---

# 9. document.py 라우터 완전 해설

**파일:** `ai-server/routers/document.py`

## 9-1. 파일과 텍스트 데이터를 동시에 받는 방법

```python
@router.post("/document")
async def extract_document(
    request: Request,
    file: UploadFile = File(...),              # 필수 파일
    session_id: Optional[str] = Form(None),   # 선택적 텍스트 필드
    doc_id: Optional[str] = Form(None),       # 선택적 텍스트 필드
) -> DocumentExtractResponse:
```

**왜 `Form(None)`을 쓰는가:**

```
JSON 요청 (application/json):
  { "session_id": "42" }
  → Body() 또는 파라미터로 받음

파일 업로드 (multipart/form-data):
  파일 + 텍스트 필드들을 함께 전송
  → File()로 파일 받음
  → Form()으로 텍스트 필드 받음
  → 둘을 섞을 수 없음! (파일이 있으면 JSON Body 사용 불가)

그래서 session_id도 Form으로 받아야 함
```

**JavaScript에서 호출하는 방법:**

```javascript
// 프론트엔드 코드 예시
const formData = new FormData();
formData.append('file', selectedFile);      // 파일 추가
formData.append('session_id', '42');        // 텍스트 필드 추가
formData.append('doc_id', 'resume.pdf');    // 텍스트 필드 추가

const response = await fetch('http://localhost:8000/extract/document', {
    method: 'POST',
    body: formData,
    // Content-Type 헤더 설정하면 안 됨!
    // 브라우저가 boundary 포함해서 자동으로 설정
});
```

**실제 HTTP 요청 모습 (multipart/form-data):**

```
POST /extract/document HTTP/1.1
Content-Type: multipart/form-data; boundary=----boundary123

------boundary123
Content-Disposition: form-data; name="file"; filename="resume.pdf"
Content-Type: application/pdf

(PDF 바이너리 데이터)
------boundary123
Content-Disposition: form-data; name="session_id"

42
------boundary123
Content-Disposition: form-data; name="doc_id"

resume.pdf
------boundary123--
```

## 9-2. 부분 실패 허용 설계

```python
# 1단계: 텍스트 추출 (항상 실행)
extracted_text = await extract_document_text(file)

# 2단계: 벡터 저장 (선택적)
if session_id:
    effective_doc_id = doc_id or (file.filename or "unknown")
    # doc_id가 없으면 파일명을 ID로 사용
    # file.filename도 없으면 "unknown" 사용

    try:
        chunk_count = await upsert_document(session_id, effective_doc_id, extracted_text)
        logger.info("RAG 벡터 저장 완료: ...")
    except Exception as error:
        # ★ 핵심: 벡터 저장 실패해도 예외를 다시 던지지 않음!
        logger.warning("벡터 저장 실패 (텍스트 추출은 성공): %s", error)
        # → 이 에러는 로그만 남기고 계속 진행

# 3단계: 텍스트는 항상 반환
return DocumentExtractResponse(extractedText=extracted_text)
```

**왜 이렇게 설계했는가 — "Graceful Degradation":**

```
나쁜 설계:
  벡터 저장 실패 → raise Exception → 500 에러
  → 사용자: "이력서 업로드 실패" → 면접 시작 불가

좋은 설계 (Graceful Degradation = 점진적 성능 저하):
  벡터 저장 실패 → 경고 로그만 → 텍스트 정상 반환
  → 사용자: "이력서 업로드 성공"
  → 면접 진행 가능 (RAG 없이, 이력서 전체로 GPT 질문 생성)
  → 기능이 약간 저하되지만 완전 차단은 없음

"벡터 DB가 다운됐을 때도 면접은 계속 진행되어야 한다"
```

---

# 10. interview_service.py RAG 적용 완전 해설

**파일:** `ai-server/services/interview_service.py`

## 10-1. _build_rag_context() — RAG 컨텍스트 빌드

```python
async def _build_rag_context(session_id: Optional[str], query: str) -> str:
    """
    세션 ID로 ChromaDB에서 유사 청크를 검색해 RAG 컨텍스트 문자열을 만듭니다.
    """
    if not session_id:
        return "(없음)"
    # ↑ sessionId 파라미터 없이 요청하면 RAG 건너뜀
    # → 기존 API 호환성 유지 (sessionId 없이 호출해도 동작)

    chunks = await search_similar(session_id, query, n_results=3)
    # search_similar = vector_service.py의 함수
    # 실패 시 [] 반환 (내부에서 try-except 처리)

    if not chunks:
        return "(없음)"
    # ↑ 저장된 문서 없거나 검색 실패 시 "(없음)" 반환
    # → GPT 프롬프트의 [참고 자료] 섹션에 "(없음)" 표시

    # 청크에 번호 붙여서 GPT가 구분하기 쉽게 포맷팅
    return "\n\n".join(f"[관련 청크 {i + 1}]\n{chunk}" for i, chunk in enumerate(chunks))
    # enumerate(chunks) = [(0, 청크0), (1, 청크1), (2, 청크2)]
    # f"[관련 청크 {i+1}]\n{chunk}" = "[관련 청크 1]\n청크 내용"
    # "\n\n".join([...]) = 각 항목을 두 줄 띄워서 연결
```

**반환값 예시:**

```
"[관련 청크 1]
저는 Java 개발자로 3년간 스타트업에서 근무했습니다. Spring Boot를 사용하여 REST API를 개발하고...

[관련 청크 2]
JPA와 QueryDSL을 활용하여 복잡한 쿼리를 최적화했습니다. N+1 문제를 경험하고 FetchType.LAZY와 Batch Size로 해결했습니다...

[관련 청크 3]
AWS EC2와 RDS를 사용하여 서비스를 운영했으며, GitHub Actions로 CI/CD 파이프라인을 구축했습니다..."
```

## 10-2. generate_interview_question() RAG 주입

```python
async def generate_interview_question(
    resume_content: str | None,
    cover_letter_content: str | None,
    job_description: str | None,
    conversation_history: List[ConversationTurn],
    question_type: str | None = None,
    session_id: str | None = None,    # ← 새로 추가된 파라미터
) -> InterviewQuestionResponse:

    resolved_type = _resolve_question_type(conversation_history, question_type)

    # RAG 검색 쿼리 구성
    # 이력서 내용 + 직무 설명을 합쳐서 검색
    rag_query = " ".join(filter(None, [resume_content, job_description]))
    # filter(None, [...]) = None 값 제거
    # " ".join([...]) = 공백으로 연결
    # 예: "Java 개발자 3년 경험 Spring Boot 백엔드 개발자 채용"

    rag_context = await _build_rag_context(session_id, rag_query or "면접 질문")
    # rag_query가 None이면 "면접 질문" 사용

    # 프롬프트 템플릿에 rag_context 포함
    human_prompt = human_template.format(
        question_type=resolved_type,
        resume_content=resume_content or "(없음)",
        cover_letter_content=cover_letter_content or "(없음)",
        job_description=job_description or "(없음)",
        conversation_history=_format_history(conversation_history),
        rag_context=rag_context,    # ← 검색된 청크 주입
    )

    # 이하 GPT 호출 (변경 없음)
    ...
```

## 10-3. 프롬프트 템플릿 (interview_question_human.txt)

```
[질문 유형]: {question_type}

[이력서]:
{resume_content}

[자기소개서]:
{cover_letter_content}

[채용공고]:
{job_description}

[이전 대화 기록]:
{conversation_history}

[참고 자료 (지원자 업로드 문서에서 검색된 관련 내용)]:
{rag_context}

위 정보를 바탕으로 다음 면접 질문 하나를 생성하세요.
```

**실제로 GPT에 전달되는 프롬프트 예시:**

```
[질문 유형]: FOLLOWUP

[이력서]:
저는 Java 개발자로 3년간 근무했으며...
(이력서 전체 3000자)

[자기소개서]:
저는 팀워크를 중시하며...
(자기소개서 전체 2000자)

[채용공고]:
백엔드 개발자 채용, Spring Boot 경험자 우대...

[이전 대화 기록]:
Q1: 자기소개를 해주세요.
A1: 저는 Java 개발자로 3년간...

[참고 자료 (지원자 업로드 문서에서 검색된 관련 내용)]:
[관련 청크 1]
JPA와 QueryDSL을 활용하여 복잡한 쿼리를 최적화했습니다.
N+1 문제를 경험하고 FetchType.LAZY와 Batch Size로 해결했습니다...

[관련 청크 2]
Spring Boot에서 트랜잭션 처리 시 @Transactional 어노테이션을 사용하고
propagation 속성을 통해 중첩 트랜잭션을 관리했습니다...

위 정보를 바탕으로 다음 면접 질문 하나를 생성하세요.

─────────────────────────────────
GPT가 생성한 답변:

"이력서에 JPA를 활용하여 N+1 문제를 해결하셨다고 하셨는데,
 구체적으로 어떤 상황에서 발생했고, @BatchSize를 적용할 때
 주의해야 할 점은 무엇이라고 생각하시나요?"
```

---

# 11. 백엔드 Java에서 sessionId 전달하는 원리

## 11-1. 전체 전달 경로

```
사용자 → Spring Boot → Python AI 서버
         (Java 코드)    (Python 코드)

InterviewService.java
  ↓ session.getId().toString()
AiService.java (인터페이스)
  ↓ sessionId 파라미터
PythonAiService.java (구현체)
  ↓ InterviewQuestionRequest record에 포함
  ↓ JSON 직렬화 후 HTTP POST
interview_service.py (Python)
  ↓ body.sessionId로 수신
ChromaDB 검색
```

## 11-2. Java record로 JSON 만들기

```java
// PythonAiService.java 내부
private record InterviewQuestionRequest(
    String resumeContent,
    String coverLetterContent,
    String jobDescription,
    List<ConversationTurnDto> conversationHistory,
    String questionType,
    String sessionId       // ← Python의 sessionId 필드와 이름 동일하게!
) {}
```

**Java record가 JSON으로 변환되면:**

```java
new InterviewQuestionRequest(
    "저는 Java 개발자로...",  // resumeContent
    "저는 팀워크를...",       // coverLetterContent
    "백엔드 개발자 채용",     // jobDescription
    List.of(...),            // conversationHistory
    "FOLLOWUP",              // questionType
    "42"                     // sessionId
)
```

```json
{
  "resumeContent": "저는 Java 개발자로...",
  "coverLetterContent": "저는 팀워크를...",
  "jobDescription": "백엔드 개발자 채용",
  "conversationHistory": [...],
  "questionType": "FOLLOWUP",
  "sessionId": "42"
}
```

## 11-3. Python이 수신하는 방법

```python
# schemas/interview.py
class InterviewQuestionRequest(BaseModel):
    resumeContent: str | None = None
    coverLetterContent: str | None = None
    jobDescription: str | None = None
    conversationHistory: List[ConversationTurn] = Field(default_factory=list)
    questionType: str | None = None
    sessionId: str | None = None    # ← Java의 sessionId와 동일 이름

# routers/interview.py
@router.post("/question")
async def generate_question(request: Request, body: InterviewQuestionRequest):
    return await interview_service.generate_interview_question(
        body.resumeContent,
        body.coverLetterContent,
        body.jobDescription,
        body.conversationHistory,
        body.questionType,
        body.sessionId,    # ← Python이 받아서 전달
    )
```

**Pydantic이 하는 일:**

```
JSON 수신: { "sessionId": "42", "resumeContent": "..." }
    ↓
Pydantic BaseModel이 자동으로 파싱
    ↓
body.sessionId = "42"
body.resumeContent = "..."
→ 타입 검사, 유효성 검사 자동 수행
```

---

# 12. Docker Compose로 ChromaDB 실행하기

## 12-1. docker-compose.yml 전체 해설

```yaml
# 추가된 ChromaDB 서비스
chromadb:
  image: chromadb/chroma:latest
  # ↑ Docker Hub에서 공식 ChromaDB 이미지 사용
  # chromadb/chroma = 이미지 이름
  # :latest = 최신 버전 (고정 버전 사용 권장: :0.5.0)

  container_name: ai-interview-chroma
  # ↑ 컨테이너에 이름 지정 (없으면 랜덤 이름)
  # docker ps 했을 때 이 이름으로 보임

  restart: unless-stopped
  # ↑ 크래시/재부팅 시 자동 재시작
  # unless-stopped = 수동으로 stop하지 않으면 항상 재시작

  ports:
    - "8001:8000"
  # ↑ "호스트포트:컨테이너포트"
  # 컨테이너 내부: ChromaDB가 8000 포트에서 실행
  # 외부에서 접근: localhost:8001
  # 왜 8001? → 우리 ai-server도 8000을 사용하므로 충돌 방지

  volumes:
    - chroma_data:/chroma/chroma
  # ↑ "볼륨이름:컨테이너경로"
  # 컨테이너 내부의 /chroma/chroma 폴더를
  # 호스트의 chroma_data 볼륨에 연결
  # → 컨테이너 재시작해도 데이터 유지 (영속성)

  environment:
    ANONYMIZED_TELEMETRY: "false"
  # ↑ ChromaDB가 사용 통계를 수집하는 기능 비활성화
  # 개인정보 보호 + 네트워크 요청 제거

  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/heartbeat"]
    # ↑ ChromaDB가 정상 동작하는지 확인하는 명령어
    # curl -f = HTTP 요청 후 실패하면 비정상 종료 (exit code != 0)
    # /api/v1/heartbeat = ChromaDB 상태 확인 엔드포인트
    start_period: 10s   # 처음 10초는 상태 체크 안 함 (시작 시간)
    interval: 10s       # 10초마다 체크
    timeout: 5s         # 5초 안에 응답 없으면 실패
    retries: 5          # 5번 연속 실패하면 unhealthy


# ai-server가 ChromaDB를 사용하는 설정
ai-server:
  environment:
    CHROMA_HOST: chromadb   # ← Docker 내부에서 컨테이너명으로 접근
    CHROMA_PORT: 8000       # ← 컨테이너 내부 포트 (외부 8001이 아님!)
  depends_on:
    chromadb:
      condition: service_healthy
  # ↑ ChromaDB가 healthy 상태가 될 때까지 ai-server 시작 대기
  # healthcheck가 성공해야 ai-server가 시작됨
```

## 12-2. Docker 내부 네트워크 이해

```
외부 세계 (개발자 컴퓨터):
  브라우저 → localhost:8001 → ChromaDB 컨테이너

Docker 내부 네트워크:
  ai-server 컨테이너 → chromadb:8000 → ChromaDB 컨테이너
                         ↑ 컨테이너명이 도메인처럼 동작

왜 다른가?
  Docker Compose는 모든 서비스를 같은 내부 네트워크에 연결
  내부에서는 컨테이너명으로 바로 접근 가능
  외부 포트 매핑(8001)은 호스트→컨테이너 접근용
```

## 12-3. 볼륨(Volume) 이란?

```
Docker 컨테이너의 문제점:
  컨테이너를 삭제하면 내부 데이터도 모두 사라짐
  → ChromaDB에 저장한 벡터가 모두 사라짐!

볼륨(Volume) 해결책:
  데이터를 컨테이너 밖에 별도 저장
  컨테이너 삭제/재시작해도 데이터 유지

volumes:
  chroma_data:  ← 이 선언이 볼륨을 생성

volumes:
  - chroma_data:/chroma/chroma  ← 컨테이너의 /chroma/chroma를 볼륨에 연결
```

---

# 13. 개발 환경 실행 순서

## 13-1. 로컬 개발 (ChromaDB 없이)

ChromaDB 없어도 EphemeralClient(메모리)로 자동 폴백됩니다.

```bash
# 1. ai-server 폴더로 이동
cd ai-server

# 2. 패키지 설치 (처음 한 번만)
pip install -r requirements.txt
# requirements.txt에 chromadb>=0.5.0 포함

# 3. 환경변수 설정 (.env 파일)
# OPENAI_API_KEY=sk-...

# 4. 서버 실행
python main.py
# → CHROMA_HOST 없음 감지
# → WARNING: 메모리 기반 ChromaDB 사용 (데이터 비영속)
# → 서버 정상 실행
```

## 13-2. Docker로 ChromaDB만 실행

```bash
# ChromaDB만 별도 실행 (개발 중 자주 사용)
docker-compose up chromadb -d
# -d = background (데몬 모드)

# 실행 확인
docker-compose ps chromadb
# ai-interview-chroma  Up  0.0.0.0:8001->8000/tcp

# ChromaDB 상태 확인
curl http://localhost:8001/api/v1/heartbeat
# {"nanosecond heartbeat": 1234567890123456789}

# 환경변수 설정 후 ai-server 실행
export CHROMA_HOST=localhost
export CHROMA_PORT=8001
python main.py
# → ChromaDB HTTP 클라이언트 연결: localhost:8001
```

## 13-3. Docker Compose 전체 실행

```bash
# 모든 서비스 한 번에 실행
docker-compose up -d

# 실행 순서 (depends_on 기준):
# 1. MariaDB 시작 → healthy 될 때까지 대기
# 2. ChromaDB 시작 → healthy 될 때까지 대기
# 3. ai-server 시작 (MariaDB, ChromaDB healthy 후)
# 4. backend 시작 (MariaDB, ai-server 후)
# 5. frontend 시작 (backend 후)

# 로그 확인
docker-compose logs -f chromadb
docker-compose logs -f ai-server

# 서비스 중지
docker-compose down
# 데이터 삭제 포함:
docker-compose down -v  # 볼륨도 삭제 (주의!)
```

## 13-4. RAG 기능 직접 테스트

```bash
# 1. ChromaDB 실행 (위 방법으로)

# 2. ai-server 실행

# 3. 문서 업로드 테스트 (curl)
curl -X POST http://localhost:8000/extract/document \
  -F "file=@이력서.pdf" \
  -F "session_id=test_session_1" \
  -F "doc_id=resume.pdf"

# 응답: { "extractedText": "저는 Java 개발자로..." }

# 4. 면접 질문 생성 테스트 (RAG 활성화)
curl -X POST http://localhost:8000/interview/question \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test_session_1",
    "resumeContent": "저는 Java 개발자로 3년간...",
    "conversationHistory": [],
    "questionType": "INITIAL"
  }'

# 응답: { "question": "JPA를 사용하셨다고 하셨는데...", "questionType": "INITIAL" }
```

---

# 14. 자주 나오는 오류와 해결법

## 14-1. ChromaDB 관련 오류

```
오류: InvalidCollectionException: Collection name must be between 3 and 63 characters
원인: 컬렉션 이름이 3자 미만이거나 63자 초과
해결: session_id를 짧은 숫자 ID로 사용 ("42", "100" 등)
      컬렉션명 = "session_42" → 11자 → 정상
```

```
오류: InvalidArgumentError: n_results can't be greater than number of elements
원인: 저장된 청크 수보다 많은 결과를 요청
해결: min(n_results, collection.count()) 사용 (이미 적용됨)
```

```
오류: Connection refused localhost:8001
원인: ChromaDB 컨테이너 미실행
해결:
  docker-compose up chromadb -d
  docker-compose ps chromadb  # 상태 확인
```

```
오류: chromadb.errors.ChromaError: Could not connect to server
원인: ai-server에서 chromadb:8000 접근 실패
해결:
  1. docker-compose ps에서 chromadb healthy 확인
  2. CHROMA_HOST=chromadb (컨테이너명, localhost 아님)
  3. CHROMA_PORT=8000 (컨테이너 내부 포트, 8001 아님)
```

## 14-2. 임베딩 관련 오류

```
오류: HTTPException 503 OPENAI_API_KEY가 설정되지 않았습니다
원인: .env 파일에 OPENAI_API_KEY 없음
해결: ai-server/.env에 OPENAI_API_KEY=sk-... 추가
```

```
오류: openai.RateLimitError: Rate limit reached
원인: OpenAI API 분당 요청 제한 초과
해결: 잠시 대기 후 재시도
      또는 요금제 업그레이드
```

## 14-3. RAG 관련 오류 (치명적이지 않음)

```
상황: 벡터 검색은 실패했지만 면접 질문은 생성됨
이유: vector_service.search_similar()가 try-except로 감싸져 있어
      실패 시 빈 리스트 반환 → RAG 없이 기본 질문 생성

로그 확인:
  WARNING: 벡터 검색 실패 (RAG 건너뜀): session_id=42 error=...
```

---

# 15. 전체 흐름 최종 요약

## 15-1. 핵심 개념 3줄

```
1. 임베딩: 텍스트를 1536개 숫자 배열로 변환 → 의미를 수학으로 표현

2. ChromaDB: 벡터(숫자 배열)를 저장하고 "비슷한 의미의 텍스트"를 빠르게 찾는 DB

3. RAG: 문서 전체 대신 "지금 질문과 관련된 500자 조각 3개"만 GPT에 전달
        → 비용 절감 + 개인화된 심층 질문 생성
```

## 15-2. 파일별 역할 정리

```
ai-server/
├── services/
│   ├── embedding_service.py  → 텍스트 ↔ 벡터 변환 (OpenAI API 호출)
│   │                            chunk_text(): 500자씩 분할
│   │                            embed_texts(): 벡터로 변환 (배치)
│   │
│   ├── vector_service.py     → ChromaDB CRUD
│   │                            upsert_document(): 문서 저장
│   │                            search_similar(): 유사 청크 검색
│   │                            _get_client(): 싱글턴 연결 관리
│   │
│   └── interview_service.py  → GPT 질문 생성 + RAG 적용
│                                _build_rag_context(): 검색 후 포맷팅
│                                generate_interview_question(): RAG 주입
│
├── routers/
│   └── document.py           → 파일 업로드 + 벡터 저장 트리거
│                                POST /extract/document
│
└── prompts/
    └── interview_question_human.txt → GPT 프롬프트 템플릿
                                        {rag_context} 플레이스홀더 포함

backend/
└── domain/interview/
    └── InterviewService.java  → session.getId().toString() → AI 서버에 전달
```

## 15-3. 환경별 동작 방식

```
┌─────────────────┬──────────────────────────────┬──────────────────────────────┐
│                 │ 로컬 개발 (Docker 없음)        │ Docker Compose 운영           │
├─────────────────┼──────────────────────────────┼──────────────────────────────┤
│ CHROMA_HOST     │ 없음                          │ "chromadb" (컨테이너명)       │
│ ChromaDB 연결   │ EphemeralClient (메모리)       │ HttpClient (HTTP)             │
│ 데이터 영속성   │ 서버 재시작 시 사라짐           │ 볼륨에 영구 저장              │
│ 용도            │ 개발·테스트                    │ 운영·스테이징                  │
│ ChromaDB 설치   │ 불필요                         │ Docker 컨테이너 자동 실행     │
└─────────────────┴──────────────────────────────┴──────────────────────────────┘
```

## 15-4. 비용 계산 (참고)

```
이력서 1개 (약 3000자 ≈ 1500 토큰) 업로드 시:
  → 청크 6개 생성
  → embed_texts 호출 1회 (6개 배치)
  → 비용: $0.02 / 1,000,000 × 1,500 = $0.00003 (약 0.04원)

면접 질문 생성 1회 (쿼리 ~500 토큰):
  → embed_texts 호출 1회 (쿼리 1개)
  → 비용: $0.02 / 1,000,000 × 500 = $0.00001 (약 0.01원)

사용자 1000명 × 면접 10회 = 10,000회:
  → 임베딩 비용: 약 $0.1 (약 140원)

결론: RAG 임베딩 비용은 GPT 질문 생성 비용에 비해 무시할 수준
```
