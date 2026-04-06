from io import BytesIO
from pathlib import Path

import pdfplumber
from fastapi import HTTPException, UploadFile


async def extract_document_text(file: UploadFile) -> str:
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="비어 있는 문서 파일입니다.")

    suffix = Path(file.filename or "").suffix.lower()

    try:
        if suffix == ".pdf":
            with pdfplumber.open(BytesIO(file_bytes)) as pdf:
                text = "\n".join((page.extract_text() or "") for page in pdf.pages).strip()
            if not text:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "PDF에서 텍스트를 추출하지 못했습니다. "
                        "스캔된 이미지 PDF이거나 한글(HWP) 변환 PDF일 수 있습니다. "
                        "텍스트 복사가 가능한 PDF로 변환 후 다시 업로드해 주세요."
                    ),
                )
            return text

        if suffix in {".txt", ".md"}:
            return file_bytes.decode("utf-8").strip()

        raise HTTPException(status_code=400, detail="지원하지 않는 문서 형식입니다.")
    except HTTPException:
        raise
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="텍스트 파일 인코딩을 해석하지 못했습니다.")
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"문서 추출에 실패했습니다: {error}")
