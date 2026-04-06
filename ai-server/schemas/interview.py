from typing import List

from pydantic import BaseModel, Field


class ConversationTurn(BaseModel):
    question: str
    answer: str


class InterviewQuestionRequest(BaseModel):
    resumeContent: str | None = None
    coverLetterContent: str | None = None
    jobDescription: str | None = None
    conversationHistory: List[ConversationTurn] = Field(default_factory=list)
    questionType: str | None = None
    # RAG 컨텍스트 검색을 위한 세션 식별자 (없으면 벡터 검색 건너뜀)
    sessionId: str | None = None


class InterviewQuestionResponse(BaseModel):
    question: str
    questionType: str = "INITIAL"


class InterviewFeedbackRequest(BaseModel):
    conversationHistory: List[ConversationTurn] = Field(default_factory=list)
    # 질문별 답변 시간 (예: "Q1: 45초, Q2: 120초, Q3: 80초") — 없으면 None
    answerDurations: str | None = None
    # 채용공고 본문 — 키워드 커버리지 분석에 사용. 없으면 분석 건너뜀
    jobDescription: str | None = None


class DailyPracticeRequest(BaseModel):
    question: str
    answer: str


class DailyPracticeResponse(BaseModel):
    score: int       # 0~100
    feedback: str    # 간결한 피드백 (3~5문장)


class InterviewFeedbackResponse(BaseModel):
    logicScore: int              # 0~100
    relevanceScore: int          # 0~100
    specificityScore: int        # 0~100
    communicationScore: int      # 0~100: 의사소통 능력
    professionalismScore: int    # 0~100: 전문성
    overallScore: int            # 0~100: 5개 점수 평균
    strengths: str               # 잘한 부분
    weakPoints: str              # 부족한 부분
    improvements: str            # 개선 방향
    questionFeedbacks: str       # 질문별 상세 분석 (STAR ✓/✗ 포함)
    attitudeScore: int           # 0~100: 면접 태도 (헤징 표현 빈도, 결론 명확성)
    attitudeFeedback: str        # 태도 피드백 (헤징 목록, 개선 방법)
    starScore: int               # 0~100: STAR 기법 적용도
    consistencyScore: int        # 0~100: 답변 간 사실 정보 일관성
    consistencyFeedback: str     # 일관성 분석 (모순 발견 시 Q번호·내용 명시)
    recommendedAnswer: str       # 모범 답변 예시
    timingAnalysis: str          # 질문별 답변 시간 분석
    keywordAnalysis: str         # 채용공고 키워드 커버리지 분석
