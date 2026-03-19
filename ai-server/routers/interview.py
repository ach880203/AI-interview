from fastapi import APIRouter, Request

from limiter import limiter
from schemas.interview import (
    InterviewFeedbackRequest,
    InterviewFeedbackResponse,
    InterviewQuestionRequest,
    InterviewQuestionResponse,
)
from services import interview_service

router = APIRouter(prefix="/interview", tags=["Interview"])


@router.post(
    "/question",
    response_model=InterviewQuestionResponse,
    summary="면접 질문 생성 (GPT-4o)",
    description=(
        "이력서·자기소개서·직무 설명·이전 대화 기록을 바탕으로 다음 면접 질문을 생성합니다.\n\n"
        "- conversationHistory가 비어 있으면 첫 질문(INITIAL)을 생성합니다.\n"
        "- 이전 답변이 모호하거나 심화가 필요하면 꼬리 질문(FOLLOWUP)을 생성합니다."
    ),
)
@limiter.limit("10/minute")
async def generate_question(request: Request, body: InterviewQuestionRequest) -> InterviewQuestionResponse:
    return await interview_service.generate_interview_question(
        body.resumeContent,
        body.coverLetterContent,
        body.jobDescription,
        body.conversationHistory,
        body.questionType,
    )


@router.post(
    "/feedback",
    response_model=InterviewFeedbackResponse,
    summary="면접 피드백 생성 (GPT-4o)",
    description=(
        "전체 면접 Q&A 히스토리를 분석하여 논리성·관련성·구체성 점수(0~100)와\n"
        "약점, 개선 방향, STAR 기법 모범 답안을 반환합니다."
    ),
)
@limiter.limit("5/minute")
async def generate_feedback(request: Request, body: InterviewFeedbackRequest) -> InterviewFeedbackResponse:
    return await interview_service.generate_feedback(body.conversationHistory)
