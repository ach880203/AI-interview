"""
문서 텍스트 추출 및 벡터 저장 라우터

[역할]
업로드된 PDF/TXT/MD 파일에서 텍스트를 추출하고,
session_id가 제공된 경우 ChromaDB에 임베딩 벡터를 저장합니다.

[RAG 연동]
session_id를 넘기면 추출한 텍스트가 벡터 DB에 저장되어
이후 /interview/question 호출 시 관련 청크가 자동으로 프롬프트에 주입됩니다.

[벡터 컬렉션 삭제]
면접 세션 종료 시 Spring Boot 백엔드가 DELETE /extract/vector/{session_id}를 호출해
ChromaDB에 남아 있는 세션 컬렉션을 정리합니다.
"""

import logging
from typing import Optional

from fastapi import APIRouter, File, Form, Request, UploadFile

from limiter import limiter
from schemas.document import DocumentExtractResponse
from services.document_service import extract_document_text
from services.vector_service import delete_session_collection, upsert_document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/extract", tags=["Document"])


@router.post(
    "/document",
    response_model=DocumentExtractResponse,
    summary="문서 텍스트 추출 (+ 벡터 저장)",
    description=(
        "PDF·TXT·MD 파일에서 텍스트를 추출합니다.\n\n"
        "- session_id를 함께 전달하면 추출한 텍스트를 ChromaDB에 청크 단위로 저장합니다.\n"
        "- 저장된 벡터는 /interview/question 요청 시 RAG 컨텍스트로 활용됩니다."
    ),
)
@limiter.limit("10/minute")
async def extract_document(
    request: Request,
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    doc_id: Optional[str] = Form(None),
) -> DocumentExtractResponse:
    """
    문서를 업로드하면 텍스트를 추출해 반환합니다.

    [session_id 동작]
    - 있는 경우: 텍스트를 임베딩해 ChromaDB 컬렉션 "session_{session_id}"에 저장
    - 없는 경우: 기존과 동일하게 텍스트만 반환 (벡터 저장 생략)

    [doc_id 동작]
    - 없으면 파일명을 사용합니다.
    - 같은 doc_id로 다시 업로드하면 기존 벡터를 덮어씁니다.
    """
    extracted_text = await extract_document_text(file)

    # session_id가 있는 경우에만 벡터 저장
    if session_id:
        effective_doc_id = doc_id or (file.filename or "unknown")
        try:
            chunk_count = await upsert_document(session_id, effective_doc_id, extracted_text)
            logger.info(
                "RAG 벡터 저장 완료: session_id=%s doc_id=%s chunks=%d",
                session_id,
                effective_doc_id,
                chunk_count,
            )
        except Exception as error:
            # 벡터 저장 실패해도 텍스트 추출 결과는 정상 반환 (부분 실패 허용)
            logger.warning("벡터 저장 실패 (텍스트 추출은 성공): %s", error)

    return DocumentExtractResponse(extractedText=extracted_text)


@router.delete(
    "/vector/{session_id}",
    summary="세션 벡터 컬렉션 삭제",
    description=(
        "면접 세션 종료 시 Spring Boot 백엔드가 호출합니다.\n\n"
        "ChromaDB에서 해당 세션의 컬렉션(session_{session_id})을 삭제해 스토리지를 정리합니다.\n"
        "컬렉션이 이미 없는 경우에도 200으로 응답합니다."
    ),
)
async def delete_vector_collection(session_id: str) -> dict:
    """
    세션 종료 후 ChromaDB에 남아 있는 벡터 컬렉션을 삭제합니다.

    [실패 처리]
    delete_session_collection()은 이미 없는 컬렉션에 대해서도 WARNING 로그만 남깁니다.
    삭제 실패가 면접 결과에 영향을 주지 않도록 항상 200을 반환합니다.
    """
    delete_session_collection(session_id)
    logger.info("벡터 컬렉션 삭제 요청 처리: session_id=%s", session_id)
    return {"message": f"session_{session_id} 컬렉션 삭제 완료"}
