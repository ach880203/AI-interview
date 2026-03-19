from slowapi import Limiter
from slowapi.util import get_remote_address

# IP 기반 Rate Limiting — 비용이 큰 AI 엔드포인트 보호
# config_filename: slowapi의 .env 자동 탐지를 우회
#   (Windows cp949 환경에서 UTF-8 .env 파일 읽기 충돌 방지)
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://", config_filename="slowapi.env")
