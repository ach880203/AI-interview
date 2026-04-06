"""
Vector DB 서비스 (ChromaDB)

[역할]
문서 텍스트를 청크 단위로 임베딩해 ChromaDB에 저장하고,
질문 텍스트와 유사한 청크를 검색해 RAG 컨텍스트를 제공합니다.

[컬렉션 설계]
컬렉션명 = "session_{session_id}"
세션별로 독립된 컬렉션을 사용해 다른 사용자의 문서가 섞이지 않도록 합니다.

[연결 모드]
- CHROMA_HOST 환경변수 설정 시: 원격 ChromaDB HTTP 클라이언트 (Docker 컨테이너)
- 설정 없으면: EphemeralClient (메모리, 개발 환경 폴백)
"""

import json
import logging
import os
import uuid
from typing import Any, List, Optional

import chromadb

from services.embedding_service import chunk_text, embed_texts

logger = logging.getLogger(__name__)

LEARNING_PROBLEM_ASSET_COLLECTION = "learning_problem_assets"
INTERVIEW_QUESTION_ASSET_COLLECTION = "interview_question_assets"

# ChromaDB 클라이언트 — 지연 초기화로 앱 시작 시 불필요한 연결 오류 방지
_chroma_client: Optional[chromadb.ClientAPI] = None


def _get_client() -> chromadb.ClientAPI:
    """
    ChromaDB 클라이언트를 반환합니다 (싱글턴 패턴).

    [연결 전략]
    1. CHROMA_HOST 환경변수가 있으면 해당 호스트의 ChromaDB HTTP 서버에 연결합니다.
       Docker Compose 환경에서 컨테이너명 "chromadb"로 접근할 때 사용됩니다.
    2. 환경변수가 없으면 EphemeralClient(메모리 기반)로 폴백합니다.
       개발·테스트 환경에서 ChromaDB를 별도 설치 없이도 동작하게 합니다.
    """
    global _chroma_client

    if _chroma_client is not None:
        return _chroma_client

    chroma_host = os.getenv("CHROMA_HOST")
    chroma_port = int(os.getenv("CHROMA_PORT", "8001"))

    if chroma_host:
        logger.info("ChromaDB HTTP 클라이언트 연결: %s:%s", chroma_host, chroma_port)
        _chroma_client = chromadb.HttpClient(host=chroma_host, port=chroma_port)
    else:
        logger.warning(
            "CHROMA_HOST 환경변수 없음 — 메모리 기반 ChromaDB 사용 (데이터 비영속)"
        )
        _chroma_client = chromadb.EphemeralClient()

    return _chroma_client


def _get_collection(session_id: str) -> chromadb.Collection:
    """
    세션 ID에 해당하는 ChromaDB 컬렉션을 가져오거나 새로 만듭니다.

    [컬렉션 이름 규칙]
    "session_{session_id}" 형식을 사용합니다.
    ChromaDB 컬렉션명은 3~63자, 알파벳·숫자·하이픈·밑줄만 허용합니다.
    session_id는 영숫자로 구성된 UUID 또는 숫자 ID를 가정합니다.
    """
    client = _get_client()
    collection_name = f"session_{session_id}"
    # get_or_create_collection: 이미 있으면 가져오고, 없으면 새로 생성
    return client.get_or_create_collection(
        name=collection_name,
        # cosine 유사도 사용 — 임베딩 벡터 크기보다 방향이 중요한 경우 적합
        metadata={"hnsw:space": "cosine"},
    )


async def upsert_document(session_id: str, doc_id: str, text: str) -> int:
    """
    문서 텍스트를 청크로 분할하고 임베딩 후 ChromaDB에 저장합니다.

    [파라미터]
    - session_id: 세션 식별자 (컬렉션 분리에 사용)
    - doc_id: 문서 식별자 (같은 doc_id로 다시 업로드하면 덮어씀)
    - text: 저장할 텍스트 원문

    [반환값]
    저장된 청크 수를 반환합니다.

    [동작 방식]
    1. chunk_text()로 텍스트를 500자 청크로 분할
    2. embed_texts()로 OpenAI 임베딩 API 호출 (배치 처리)
    3. ChromaDB upsert — 같은 ID 존재 시 업데이트, 없으면 추가
    """
    chunks = chunk_text(text)
    if not chunks:
        logger.warning("upsert_document: 청크 없음 (빈 텍스트) doc_id=%s", doc_id)
        return 0

    # 청크별 고유 ID: "{doc_id}_chunk_{인덱스}"
    chunk_ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
    chunk_metadatas = [{"doc_id": doc_id, "chunk_index": i} for i in range(len(chunks))]

    # 임베딩 API 호출 (배치)
    embeddings = await embed_texts(chunks)

    # ChromaDB에 저장
    collection = _get_collection(session_id)
    collection.upsert(
        ids=chunk_ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=chunk_metadatas,
    )

    logger.info("벡터 저장 완료: session_id=%s doc_id=%s chunks=%d", session_id, doc_id, len(chunks))
    return len(chunks)


async def search_similar(session_id: str, query: str, n_results: int = 3) -> List[str]:
    """
    질문 텍스트와 가장 유사한 문서 청크를 검색합니다.

    [파라미터]
    - session_id: 검색할 컬렉션 식별자
    - query: 검색 쿼리 (면접 질문 생성 시 현재 컨텍스트)
    - n_results: 반환할 최대 청크 수 (기본값 3)

    [반환값]
    유사도 높은 순서로 정렬된 텍스트 청크 목록을 반환합니다.

    [오류 처리]
    컬렉션이 비어 있거나 검색 실패 시 빈 목록을 반환합니다 (면접 진행 차단하지 않음).
    """
    try:
        collection = _get_collection(session_id)

        # 컬렉션이 비어 있으면 검색 불가
        if collection.count() == 0:
            return []

        # 쿼리 임베딩
        query_embeddings = await embed_texts([query])

        results = collection.query(
            query_embeddings=query_embeddings,
            n_results=min(n_results, collection.count()),  # 저장된 수보다 많이 요청하면 오류 방지
        )

        # results["documents"]는 [[chunk1, chunk2, ...]] 형태 (쿼리별 중첩 리스트)
        documents = results.get("documents", [[]])[0]
        return [doc for doc in documents if doc]
    except Exception as error:
        logger.warning("벡터 검색 실패 (RAG 건너뜀): session_id=%s error=%s", session_id, error)
        return []


def delete_session_collection(session_id: str) -> None:
    """
    세션 종료 시 해당 세션의 컬렉션을 삭제합니다.

    [주의]
    면접 세션이 완전히 종료될 때만 호출하세요.
    삭제 후에는 복구할 수 없습니다.
    """
    try:
        client = _get_client()
        collection_name = f"session_{session_id}"
        client.delete_collection(name=collection_name)
        logger.info("세션 컬렉션 삭제: %s", collection_name)
    except Exception as error:
        # 이미 없는 컬렉션 삭제 시도도 있으므로 WARNING으로 처리
        logger.warning("컬렉션 삭제 실패 (이미 없거나 오류): %s — %s", session_id, error)
