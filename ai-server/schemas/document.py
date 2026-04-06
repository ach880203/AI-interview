from pydantic import BaseModel


class DocumentExtractResponse(BaseModel):
    extractedText: str
