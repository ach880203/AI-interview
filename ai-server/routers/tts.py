import os

from fastapi import APIRouter, Request
from fastapi.responses import Response
from openai import AsyncOpenAI

from limiter import limiter
from schemas.tts import TtsSpeakRequest

router = APIRouter(prefix="/tts", tags=["TTS"])


@router.post(
    "/speak",
    summary="텍스트 -> MP3 음성 변환 (OpenAI TTS)",
    description=(
        "입력한 텍스트를 OpenAI TTS(tts-1 모델)로 변환하여 MP3 오디오를 반환합니다.\n\n"
        "**모델**: tts-1 (빠른 응답, 자연스러운 발음)  \n"
        "**기본 음성**: nova (친근한 여성 목소리, 한국어 지원)  \n"
        "**출력 형식**: audio/mpeg (MP3)\n\n"
        "Spring Boot 백엔드가 이 엔드포인트를 호출하고, 결과를 프론트엔드에 전달합니다."
    ),
    response_class=Response,
    responses={
        200: {"content": {"audio/mpeg": {}}, "description": "MP3 오디오 데이터"},
        503: {"description": "OpenAI TTS API 호출 실패"},
    },
)
@limiter.limit("20/minute")
async def tts_speak(request: Request, body: TtsSpeakRequest) -> Response:
    """
    텍스트를 MP3 오디오로 변환합니다.

    [동작 방식]
    1. AsyncOpenAI 클라이언트로 tts-1 모델에 변환 요청
    2. 응답 bytes를 그대로 audio/mpeg Content-Type으로 반환
    3. Spring Boot가 이 bytes를 프론트엔드에 전달하면
       프론트엔드가 Audio() 객체로 재생합니다.

    [음성 선택 기준]
    nova: 면접관 역할에 자연스러운 여성 목소리 (기본값)
    """
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    response = await client.audio.speech.create(
        model="tts-1-hd",  # tts-1보다 발음·억양이 확연히 더 자연스러운 고품질 모델
        voice=body.voice,
        input=body.text,
        response_format="mp3",
    )

    # response.content - 변환된 MP3 오디오 bytes
    return Response(content=response.content, media_type="audio/mpeg")
