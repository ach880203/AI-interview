from pydantic import BaseModel


class TtsSpeakRequest(BaseModel):
    """TTS 변환 요청 스키마"""
    text: str
    # shimmer: 부드럽고 명료한 여성 음성 — 면접관 역할에 적합
    # alloy / nova / echo / fable / onyx 중 선택 가능
    voice: str = "shimmer"
