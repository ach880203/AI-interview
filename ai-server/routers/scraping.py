from fastapi import APIRouter, Request

from limiter import limiter
from schemas.scraping import JobPostingScrapeRequest, JobPostingScrapedResponse
from services.scraping_service import scrape_job_posting

router = APIRouter(prefix="/scrape", tags=["Scraping"])


@router.post(
    "/job-posting",
    response_model=JobPostingScrapedResponse,
    summary="채용공고 스크래핑",
)
@limiter.limit("10/minute")
async def scrape_job_posting_endpoint(
    request: Request,
    body: JobPostingScrapeRequest,
) -> JobPostingScrapedResponse:
    return await scrape_job_posting(str(body.url))
