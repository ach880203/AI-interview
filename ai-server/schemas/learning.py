from typing import List

from pydantic import BaseModel, Field


class LearningProblemsRequest(BaseModel):
    subject: str
    difficulty: str
    count: int = Field(ge=1, le=10)
    type: str
    userAccuracy: int | None = Field(default=None, ge=0, le=100)


class LearningProblemItem(BaseModel):
    type: str
    question: str
    choices: List[str] | None = None
    answer: str
    explanation: str


class LearningProblemsResponse(BaseModel):
    problems: List[LearningProblemItem]


class LearningGradeRequest(BaseModel):
    question: str
    correctAnswer: str
    userAnswer: str
    explanation: str | None = None


class LearningGradeResponse(BaseModel):
    isCorrect: bool
    aiFeedback: str
