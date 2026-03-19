from fastapi import APIRouter, File, Request, UploadFile

from limiter import limiter
from schemas.stt import SttResponse
from services.whisper_service import SUPPORTED_EXTENSIONS, speech_to_text

router = APIRouter(prefix="/stt", tags=["STT"])


@router.post(
    "",
    response_model=SttResponse,
    summary="음성 파일 → 텍스트 변환 (Whisper STT)",
    description=(
        "multipart/form-data의 **audio** 필드로 오디오 파일을 업로드하면 "
        "OpenAI Whisper(whisper-1)가 한국어 텍스트로 변환합니다.\n\n"
        f"**지원 형식:** {', '.join(sorted(SUPPORTED_EXTENSIONS))}  \n"
        "**최대 크기:** 25 MB (Whisper API 제한)"
    ),
    responses={
        200: {"description": "변환 성공", "content": {"application/json": {"example": {"text": "안녕하세요, 반갑습니다."}}}},
        400: {"description": "지원하지 않는 형식 / 빈 파일 / 25 MB 초과"},
        503: {"description": "OpenAI Whisper API 호출 실패"},
    },
)
@limiter.limit("20/minute")
async def stt_endpoint(
    request: Request,
    audio: UploadFile = File(
        ...,
        description=(
            "변환할 오디오 파일. "
            f"지원 형식: {', '.join(sorted(SUPPORTED_EXTENSIONS))}. "
            "최대 25 MB."
        ),
    ),
) -> SttResponse:
    """
    음성 파일을 텍스트로 변환하는 STT 엔드포인트.

    Spring Boot가 multipart/form-data로 'audio' 필드에
    오디오 파일을 첨부하여 이 엔드포인트를 호출합니다.
    """
    # 서비스 레이어에 위임 — 유효성 검증, Whisper 호출, 임시 파일 정리 모두 서비스에서 처리
    text = await speech_to_text(audio)
    return SttResponse(text=text)
