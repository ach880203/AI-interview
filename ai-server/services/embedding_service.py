"""
텍스트 임베딩 서비스

[역할]
OpenAI text-embedding-3-small 모델을 사용해 텍스트를 1536차원 벡터로 변환합니다.
긴 텍스트는 chunk_text()로 잘라낸 뒤 각 청크를 임베딩합니다.

[사용처]
- vector_service.py: 문서 업로드 시 청크 단위 임베딩 후 ChromaDB에 저장
- vector_service.py: 질문 텍스트를 임베딩해 유사 청크 검색
"""

import os
from typing import List

from fastapi import HTTPException
from openai import AsyncOpenAI

# 임베딩 모델명 — 비용·품질 균형이 좋은 small 모델 사용
_EMBEDDING_MODEL = "text-embedding-3-small"

# 청크 크기 및 겹침 설정
# - chunk_size: 한 청크에 담을 최대 문자 수 (토큰 아닌 문자 단위)
# - overlap: 연속된 청크 간 겹치는 문자 수 (문맥 단절 방지)
_CHUNK_SIZE = 500
_CHUNK_OVERLAP = 50


def chunk_text(text: str, chunk_size: int = _CHUNK_SIZE, overlap: int = _CHUNK_OVERLAP) -> List[str]:
    """
    긴 텍스트를 일정 크기의 청크로 분할합니다.

    [왜 필요한가]
    OpenAI 임베딩 API는 입력 텍스트 길이에 제한이 있으며,
    너무 긴 텍스트를 하나의 벡터로 표현하면 세부 내용이 평균화되어 검색 정밀도가 떨어집니다.
    짧은 청크 단위로 저장하면 질문과 가장 관련 있는 부분만 정확하게 검색할 수 있습니다.

    [overlap 이유]
    문장이 청크 경계에서 잘리면 문맥이 끊깁니다.
    앞 청크 끝부분을 다음 청크 앞에 붙여넣어 문맥 연속성을 보장합니다.

    예시 (chunk_size=10, overlap=3):
      "ABCDEFGHIJKLMNOP" ->
      "ABCDEFGHIJ"  (0~9)
      "HIJKLMNOP"   (7~15, 앞 청크의 마지막 3자 포함)
    """
    if not text or not text.strip():
        return []

    chunks: List[str] = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        # 다음 청크 시작 위치 = 현재 끝 - overlap
        start = end - overlap

    return chunks


async def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    텍스트 목록을 OpenAI 임베딩 API로 벡터화합니다.

    [반환값]
    각 텍스트에 대응하는 1536차원 float 벡터 목록을 반환합니다.
    texts[i] -> 반환값[i] 순서가 보장됩니다.

    [오류 처리]
    OPENAI_API_KEY가 없거나 API 호출 실패 시 HTTPException을 발생시킵니다.
    """
    if not texts:
        return []

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY가 설정되지 않았습니다.")

    client = AsyncOpenAI(api_key=api_key)

    try:
        response = await client.embeddings.create(
            model=_EMBEDDING_MODEL,
            input=texts,
        )
        # API 응답은 입력 순서를 보장하므로 index 기준으로 정렬
        sorted_data = sorted(response.data, key=lambda item: item.index)
        return [item.embedding for item in sorted_data]
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"텍스트 임베딩 실패: {error}")
