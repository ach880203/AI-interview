import os
import tempfile
from pathlib import Path

from fastapi import HTTPException, UploadFile
from openai import AsyncOpenAI

SUPPORTED_EXTENSIONS = {".m4a", ".mp3", ".ogg", ".wav", ".webm"}
MAX_FILE_SIZE = 25 * 1024 * 1024


async def speech_to_text(audio: UploadFile) -> str:
    suffix = Path(audio.filename or "").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="지원하지 않는 음성 형식입니다.")

    file_bytes = await audio.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="비어 있는 음성 파일입니다.")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="음성 파일은 25MB 이하여야 합니다.")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "음성 인식 키가 설정되지 않아 테스트용 텍스트를 반환합니다."

    client = AsyncOpenAI(api_key=api_key)

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(file_bytes)
        temp_path = temp_file.name

    try:
        with open(temp_path, "rb") as audio_file:
            response = await client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
            )
        return response.text.strip()
    except Exception as error:
        return f"음성 변환에 실패하여 테스트용 텍스트를 반환합니다. 원인: {error}"
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass
