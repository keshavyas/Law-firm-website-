from fastapi import FastAPI, Depends, HTTPException
from .schemas.ai import SummarizeRequest, SummarizeResponse
from .core.adapters import get_adapter
from .core.config import settings
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.PROJECT_NAME, version=settings.PROJECT_VERSION)

# Simple in-memory cache for demonstration (Can be replaced with Postgres/Redis)
summary_cache = {}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}

from .core.database import get_case_documents
from pypdf import PdfReader
import os

# ... (logger setup)

@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest):
    try:
        cache_key = request.case_id if request.case_id else str(hash(request.text))
        
        if settings.SUMMARY_CACHE_ENABLED and cache_key in summary_cache:
            logger.info(f"Cache hit for key: {cache_key}")
            return SummarizeResponse(summary=summary_cache[cache_key], cached=True)

        text_to_summarize = ""
        
        # 1. Fetch from Case Documents if case_id provided
        if request.case_id:
            case_info = await get_case_documents(request.case_id)
            if not case_info:
                raise HTTPException(status_code=404, detail="Case not found")
            
            text_to_summarize = f"Case Title: {case_info['title']}\nDescription: {case_info['description']}\n\nDocument Contents:\n"
            
            for doc_filename in case_info['documents']:
                file_path = f"/app/uploads/{doc_filename}"
                if os.path.exists(file_path):
                    try:
                        if doc_filename.lower().endswith('.pdf'):
                            reader = PdfReader(file_path)
                            for page in reader.pages:
                                text_to_summarize += page.extract_text() + "\n"
                        elif doc_filename.lower().endswith(('.txt', '.doc', '.docx')): # simple text read for now
                             with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                                 text_to_summarize += f.read() + "\n"
                    except Exception as fe:
                        logger.warning(f"Could not read {doc_filename}: {str(fe)}")

        # 2. Append provided text if any
        if request.text:
            text_to_summarize += f"\nAdditional Text:\n{request.text}"

        if not text_to_summarize.strip():
             raise HTTPException(status_code=400, detail="No content found to summarize")

        # 3. Call AI Adapter
        adapter = get_adapter()
        summary = adapter.summarize(text_to_summarize[:25000]) # Cap text for LLM window

        if settings.SUMMARY_CACHE_ENABLED:
            summary_cache[cache_key] = summary

        return SummarizeResponse(summary=summary, cached=False)

    except Exception as e:
        logger.error(f"Summarization error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)
