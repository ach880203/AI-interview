from typing import List

from pydantic import BaseModel, Field


class AssetStoreResponse(BaseModel):
    assetId: str
    collectionName: str
    stored: bool = True


class LearningProblemAssetStoreRequest(BaseModel):
    subjectId: int | None = None
    subjectName: str
    difficulty: str
    problemType: str
    question: str
    choices: List[str] | None = None
    answer: str
    explanation: str
    conceptTags: List[str] = Field(default_factory=list)
    source: str = "ai_generated"
    qualityScore: int = Field(default=70, ge=0, le=100)
    assetId: str | None = None


class InterviewQuestionAssetStoreRequest(BaseModel):
    jobFamily: str | None = None
    questionType: str
    difficulty: str | None = None
    question: str
    resumeKeywords: List[str] = Field(default_factory=list)
    jobKeywords: List[str] = Field(default_factory=list)
    contextSummary: str | None = None
    conversationStage: str | None = None
    source: str = "ai_generated"
    qualityScore: int = Field(default=70, ge=0, le=100)
    assetId: str | None = None

