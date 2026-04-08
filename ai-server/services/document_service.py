import base64
from io import BytesIO
from pathlib import Path

import pdfplumber
from fastapi import HTTPException, UploadFile
from openai import AsyncOpenAI

_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
_MIME_MAP = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

_IMAGE_EXTRACT_PROMPT = (
    "이 이미지에서 모든 텍스트를 추출해주세요. "
    "줄바꿈과 문서 구조를 최대한 유지하면서 텍스트만 반환하세요."
)


async def extract_document_text(file: UploadFile) -> str:
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="비어 있는 문서 파일입니다.")

    suffix = Path(file.filename or "").suffix.lower()

    try:
        if suffix == ".pdf":
            with pdfplumber.open(BytesIO(file_bytes)) as pdf:
                text = "\n".join((page.extract_text() or "") for page in pdf.pages).strip()
            if text:
                return text
            # 스캔 PDF(이미지 기반) → GPT-4o Vision으로 재시도
            return await _extract_text_from_pdf_via_vision(file_bytes)

        if suffix in {".txt", ".md"}:
            return file_bytes.decode("utf-8").strip()

        if suffix in _IMAGE_SUFFIXES:
            return await _extract_text_from_image(file_bytes, suffix)

        raise HTTPException(
            status_code=400,
            detail="지원하지 않는 문서 형식입니다. PDF, 이미지(JPG/PNG/WEBP), TXT, MD 파일을 사용해주세요.",
        )
    except HTTPException:
        raise
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="텍스트 파일 인코딩을 해석하지 못했습니다.")
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"문서 추출에 실패했습니다: {error}")


async def _extract_text_from_pdf_via_vision(pdf_bytes: bytes) -> str:
    """pdfplumber로 추출 실패한 스캔 PDF를 페이지별 PNG로 렌더링 후 GPT-4o Vision으로 OCR 처리합니다."""
    import fitz  # pymupdf

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    client = AsyncOpenAI()
    page_texts: list[str] = []

    # 이력서·자기소개서는 보통 1~3페이지이므로 최대 10페이지까지만 처리
    for page in list(doc)[:10]:
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        base64_img = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:image/png;base64,{base64_img}"

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": _IMAGE_EXTRACT_PROMPT},
                    ],
                }
            ],
            max_tokens=4096,
        )
        text = response.choices[0].message.content or ""
        if text.strip():
            page_texts.append(text.strip())

    if not page_texts:
        raise HTTPException(
            status_code=400,
            detail="PDF에서 텍스트를 추출하지 못했습니다. 텍스트 복사가 가능한 PDF로 변환 후 다시 업로드해 주세요.",
        )
    return "\n\n".join(page_texts)


async def _extract_text_from_image(image_bytes: bytes, suffix: str) -> str:
    mime = _MIME_MAP.get(suffix, "image/jpeg")
    base64_image = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime};base64,{base64_image}"

    client = AsyncOpenAI()
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": _IMAGE_EXTRACT_PROMPT},
                ],
            }
        ],
        max_tokens=4096,
    )
    extracted = response.choices[0].message.content or ""
    if not extracted.strip():
        raise HTTPException(status_code=400, detail="이미지에서 텍스트를 추출하지 못했습니다.")
    return extracted.strip()
