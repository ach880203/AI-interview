import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from limiter import limiter

logger = logging.getLogger(__name__)

# .env 파일 로드 (OPENAI_API_KEY, MODEL_NAME)
load_dotenv()

from routers import document, interview, learning, scraping, stt, tts  # noqa: E402 (load_dotenv 이후에 임포트)

# ── 앱 초기화 ─────────────────────────────────────────────────
app = FastAPI(
    title="AI Interview Platform — AI Server",
    description=(
        "면접 질문 생성, 피드백, STT(Whisper), 학습 문제 생성/채점 API\n\n"
        "Spring Boot 백엔드(8080)에서 호출하며, 직접 외부에 노출하지 않습니다."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Rate Limiting ─────────────────────────────────────────────
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# ── CORS ─────────────────────────────────────────────────────
# Spring Boot(8080), React(5173) 에서의 직접 테스트 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 라우터 등록 ───────────────────────────────────────────────
app.include_router(stt.router)       # POST /stt            — Whisper 음성→텍스트 변환
app.include_router(tts.router)       # POST /tts/speak      — OpenAI TTS 텍스트→음성 변환
app.include_router(interview.router)
app.include_router(learning.router)
app.include_router(scraping.router)
app.include_router(document.router)


# ── /interview/question 요청 진단용 헬퍼 ──────────────────────
def _extract_interview_request_headers(request: Request) -> dict:
    """
    /interview/question 요청에서 body 전달 문제를 추적하기 위한 핵심 헤더만 추출합니다.

    [왜 필요한가]
    body가 비어 도착하는 문제는 Content-Type, Content-Length, Transfer-Encoding,
    Host 같은 전송 계층 정보와 함께 봐야 원인을 좁히기 쉽습니다.
    모든 헤더를 그대로 남기면 로그가 과하게 길어질 수 있어 핵심 항목만 골라 기록합니다.
    """
    target_header_names = [
        "host",
        "content-type",
        "content-length",
        "transfer-encoding",
        "user-agent",
        "accept",
        "connection",
    ]

    return {
        header_name: request.headers.get(header_name)
        for header_name in target_header_names
        if request.headers.get(header_name) is not None
    }


# ── /interview/question 요청/응답 진단 미들웨어 ───────────────
@app.middleware("http")
async def log_interview_question_request(request: Request, call_next):
    """
    면접 질문 생성 요청의 실제 body 도착 여부를 진단하기 위한 미들웨어입니다.

    [동작 방식]
    1. /interview/question 요청만 가로챕니다.
    2. body를 먼저 읽어 헤더/길이/내용을 로그로 남깁니다.
    3. FastAPI 라우터가 동일 body를 다시 읽을 수 있도록 request를 복원합니다.
    4. 응답 상태 코드까지 함께 기록해 요청-응답 흐름을 한 번에 볼 수 있게 합니다.
    """
    if request.url.path != "/interview/question":
        return await call_next(request)

    body = await request.body()
    decoded_body = body.decode("utf-8", errors="replace")

    logger.warning(
        "[AI 요청 진단] path=%s method=%s headers=%s body_length=%s body=%s",
        request.url.path,
        request.method,
        _extract_interview_request_headers(request),
        len(body),
        decoded_body,
    )

    async def receive():
        return {
            "type": "http.request",
            "body": body,
            "more_body": False,
        }

    restored_request = Request(request.scope, receive)
    response = await call_next(restored_request)

    logger.warning(
        "[AI 요청 진단] path=%s response_status=%s",
        request.url.path,
        response.status_code,
    )
    return response


# ── 전역 예외 핸들러 — Spring Boot 호환 형식 ─────────────────
# Spring Boot GlobalExceptionHandler가 기대하는 형식:
# { "success": false, "error": { "code": "...", "message": "..." } }

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTPException → Spring Boot 호환 에러 응답으로 변환"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": "AI_SERVER_ERROR",
                "message": str(exc.detail),
            },
        },
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Rate Limit 초과 → 429 + Spring Boot 호환 형식"""
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "success": False,
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "요청 횟수가 제한을 초과했습니다. 잠시 후 다시 시도해 주세요.",
            },
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """422 Pydantic 유효성 검사 실패 — 로그 + Spring Boot 호환 형식"""
    body = await request.body()
    logger.error(
        "[422] 요청 유효성 검사 실패 — path=%s\nheaders=%s\nerrors=%s\nbody_length=%s\nbody=%s",
        request.url.path,
        _extract_interview_request_headers(request),
        exc.errors(),
        len(body),
        body.decode("utf-8", errors="replace"),
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "; ".join(
                    f"{'.'.join(str(loc) for loc in e['loc'])}: {e['msg']}"
                    for e in exc.errors()
                ),
            },
        },
    )


# ── 헬스 체크 ─────────────────────────────────────────────────
@app.get("/health", tags=["Health"], summary="서버 상태 확인")
async def health_check():
    """
    서버 기동 상태 및 설정된 모델명을 반환합니다.
    Spring Boot가 AI 서버 연결 전 상태를 확인할 때 사용합니다.
    """
    api_key_set = bool(os.getenv("OPENAI_API_KEY"))
    return {
        "status": "ok",
        "model": os.getenv("MODEL_NAME", "gpt-4o"),
        "apiKeyConfigured": api_key_set,
    }


# ── 직접 실행 진입점 ──────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
