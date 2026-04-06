"""
출제 자산 저장 라우터

[역할]
AI가 생성한 학습 문제와 면접 질문을 ChromaDB 영구 컬렉션에 저장합니다.
기존 session_{session_id} 문서 RAG 컬렉션과 분리하여, 이후 혼합 출제와
재사용 검색에 활용할 수 있는 출제 자산 저장소를 만듭니다.
"""

from fastapi import APIRouter, Request

from limiter import limiter
from schemas.asset import (
    AssetStoreResponse,
    InterviewQuestionAssetStoreRequest,
    LearningProblemAssetStoreRequest,
)
from services.asset_vector_service import (
    INTERVIEW_QUESTION_ASSET_COLLECTION,
    LEARNING_PROBLEM_ASSET_COLLECTION,
    upsert_interview_question_asset,
    upsert_learning_problem_asset,
)

router = APIRouter(prefix="/vector/assets", tags=["Vector Assets"])


@router.post(
    "/learning-problems",
    response_model=AssetStoreResponse,
    summary="학습 문제 자산 저장",
    description=(
        "AI가 생성한 학습 문제를 영구 출제 자산 컬렉션에 저장합니다.\n\n"
        "이 API로 저장된 문제는 이후 유사 개념 검색, 혼합 출제, 심화학습 추천에 재사용할 수 있습니다."
    ),
)
@limiter.limit("30/minute")
async def store_learning_problem_asset(
    request: Request,
    body: LearningProblemAssetStoreRequest,
) -> AssetStoreResponse:
    asset_id = await upsert_learning_problem_asset(
        asset_id=body.assetId,
        subject_id=body.subjectId,
        subject_name=body.subjectName,
        difficulty=body.difficulty,
        problem_type=body.problemType,
        question=body.question,
        choices=body.choices,
        answer=body.answer,
        explanation=body.explanation,
        concept_tags=body.conceptTags,
        source=body.source,
        quality_score=body.qualityScore,
    )
    return AssetStoreResponse(
        assetId=asset_id,
        collectionName=LEARNING_PROBLEM_ASSET_COLLECTION,
    )


@router.post(
    "/interview-questions",
    response_model=AssetStoreResponse,
    summary="면접 질문 자산 저장",
    description=(
        "AI가 생성한 면접 질문을 영구 출제 자산 컬렉션에 저장합니다.\n\n"
        "이 API로 저장된 질문은 이후 직무/질문 유형 기반 혼합 출제에 재사용할 수 있습니다."
    ),
)
@limiter.limit("30/minute")
async def store_interview_question_asset(
    request: Request,
    body: InterviewQuestionAssetStoreRequest,
) -> AssetStoreResponse:
    asset_id = await upsert_interview_question_asset(
        asset_id=body.assetId,
        job_family=body.jobFamily,
        question_type=body.questionType,
        difficulty=body.difficulty,
        question=body.question,
        resume_keywords=body.resumeKeywords,
        job_keywords=body.jobKeywords,
        context_summary=body.contextSummary,
        conversation_stage=body.conversationStage,
        source=body.source,
        quality_score=body.qualityScore,
    )
    return AssetStoreResponse(
        assetId=asset_id,
        collectionName=INTERVIEW_QUESTION_ASSET_COLLECTION,
    )
