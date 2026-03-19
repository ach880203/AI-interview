from fastapi import APIRouter, Request

from limiter import limiter
from schemas.learning import (
    LearningGradeRequest,
    LearningGradeResponse,
    LearningProblemsRequest,
    LearningProblemsResponse,
)
from services import learning_service

router = APIRouter(prefix="/learning", tags=["Learning"])


@router.post(
    "/generate",
    response_model=LearningProblemsResponse,
    summary="학습 문제 생성 (GPT-4o)",
    description=(
        "과목·난이도·유형·수량을 지정하면 AI가 학습 문제를 생성합니다.\n\n"
        "- `type`: MULTIPLE(객관식) | SHORT(주관식) | MIX(혼합)\n"
        "- `difficulty`: EASY | MEDIUM | HARD\n"
        "- 과목(subject)에 따라 전용 시스템 프롬프트가 자동 선택됩니다 "
        "(영어·국사·IT·기본)."
    ),
)
@limiter.limit("10/minute")
async def generate_problems(request: Request, body: LearningProblemsRequest) -> LearningProblemsResponse:
    return await learning_service.generate_problems(
        body.subject,
        body.difficulty,
        body.count,
        body.type,
        body.userAccuracy,
    )


@router.post(
    "/grade",
    response_model=LearningGradeResponse,
    summary="학습 답변 채점 (GPT-4o)",
    description=(
        "문제·정답·해설·사용자 답변을 분석하여 정오답과 AI 피드백을 반환합니다.\n\n"
        "단순 정오답 판정이 아닌 '왜 틀렸는지' + 관련 개념 설명이 포함됩니다."
    ),
)
@limiter.limit("20/minute")
async def grade_answer(request: Request, body: LearningGradeRequest) -> LearningGradeResponse:
    return await learning_service.grade_answer(
        body.question,
        body.correctAnswer,
        body.userAnswer,
        body.explanation,
    )
