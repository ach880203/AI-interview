from typing import Optional

from pydantic import BaseModel, HttpUrl


class JobPostingScrapeRequest(BaseModel):
    url: HttpUrl


class JobPostingScrapedResponse(BaseModel):
    """채용공고 스크래핑 결과 스키마"""
    company: str
    position: str
    description: str
    location: Optional[str] = None  # 근무 지역 (예: 서울 강남구, 판교 등)
    due_date: Optional[str] = None  # yyyy-MM-dd 형식 마감일
    source_url: Optional[str] = None  # 원본 공고 URL
