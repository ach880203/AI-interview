from pydantic import BaseModel


class SttResponse(BaseModel):
    text: str
