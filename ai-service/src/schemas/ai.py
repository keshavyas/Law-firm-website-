from pydantic import BaseModel
from typing import Optional

class SummarizeRequest(BaseModel):
    case_id: Optional[str] = None
    text: Optional[str] = None

class SummarizeResponse(BaseModel):
    summary: str
    cached: bool = False
