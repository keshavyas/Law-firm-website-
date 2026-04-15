from fastapi import FastAPI, Depends, HTTPException
from .schemas.ai import SummarizeRequest, SummarizeResponse, DeadlineRequest, DeadlineResponse
from .core.adapters import get_adapter
from .core.config import settings
import logging
import asyncio

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.PROJECT_NAME, version=settings.PROJECT_VERSION)

# Simple in-memory cache for demonstration (Can be replaced with Postgres/Redis)
summary_cache = {}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}

from .core.database import get_case_documents, save_summary
from .core.eval import evaluate
from pypdf import PdfReader
import os

@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest):
    try:
        cache_key = request.case_id if request.case_id else str(hash(request.text))
        
        if settings.SUMMARY_CACHE_ENABLED and cache_key in summary_cache:
            logger.info(f"Cache hit for key: {cache_key}")
            return SummarizeResponse(summary=summary_cache[cache_key], status="success", cached=True)

        text_to_summarize = ""
        
        # 1. Fetch from Case Documents if case_id provided
        if request.case_id:
            case_info = await get_case_documents(request.case_id)
            if not case_info:
                return SummarizeResponse(summary="Fallback: Case not found", status="error", error="Case not found")
            
            text_to_summarize = f"Case Title: {case_info['title']}\nDescription: {case_info['description']}\n\nDocument Contents:\n"
            
            if case_info.get('documents'):
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
            return SummarizeResponse(summary="Fallback: No content to summarize", status="error", error="No content found")

        # 3. Call AI Adapter
        capped_text = text_to_summarize[:25000]
        adapter = get_adapter()
        
        try:
            summary = await asyncio.wait_for(adapter.summarize(capped_text), timeout=30.0)
        except asyncio.TimeoutError:
            return SummarizeResponse(summary="Fallback: Summarization took too long. Please try again later.", status="error", error="timeout")
        except Exception as api_err:
            return SummarizeResponse(summary="Fallback: AI service temporarily unavailable.", status="error", error=str(api_err))
            
        await save_summary(capped_text, summary)
        eval_metrics = evaluate(capped_text, summary)
        logger.info(f"Summarization eval metrics: {eval_metrics}")

        if settings.SUMMARY_CACHE_ENABLED:
            summary_cache[cache_key] = summary

        return SummarizeResponse(summary=summary, status="success", cached=False)

    except Exception as e:
        logger.error(f"Summarization error: {str(e)}")
        return SummarizeResponse(summary="Fallback: Internal server error occurred.", status="error", error=str(e))

@app.post("/extract-deadlines", response_model=DeadlineResponse)
async def extract_deadlines(request: DeadlineRequest):
    try:
        if not request.text.strip():
            return DeadlineResponse(deadlines="Fallback: No text provided", status="error", error="Empty text")
            
        adapter = get_adapter()
        try:
            deadlines = await asyncio.wait_for(adapter.extract_deadlines(request.text[:25000]), timeout=30.0)
        except asyncio.TimeoutError:
            return DeadlineResponse(deadlines="Fallback: Extraction took too long.", status="error", error="timeout")
        except Exception as e:
            return DeadlineResponse(deadlines="Fallback: AI service unavailable.", status="error", error=str(e))
            
        return DeadlineResponse(deadlines=deadlines, status="success")
    except Exception as e:
        logger.error(f"Deadline extraction error: {str(e)}")
        return DeadlineResponse(deadlines="Fallback: Internal server error.", status="error", error=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)
