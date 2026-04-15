from pydantic import BaseModel
from typing import Optional

class SummarizeRequest(BaseModel):
    case_id: Optional[str] = None
    text: Optional[str] = None

class SummarizeResponse(BaseModel):
    summary: str
    status: str = "success"
    error: Optional[str] = None
    cached: bool = False

class DeadlineRequest(BaseModel):
    text: str

class DeadlineResponse(BaseModel):
    deadlines: str
    status: str = "success"
    error: Optional[str] = None
