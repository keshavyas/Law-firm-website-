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

@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest):
    try:
        # 1. Check Caching
        cache_key = request.case_id if request.case_id else str(hash(request.text))
        
        if settings.SUMMARY_CACHE_ENABLED and cache_key in summary_cache:
            logger.info(f"Cache hit for key: {cache_key}")
            return SummarizeResponse(summary=summary_cache[cache_key], cached=True)

        # 2. Extract text (simplified for now, assumes text is provided)
        # In a real scenario, if case_id is provided, we'd fetch from DB.
        text_to_summarize = request.text
        if not text_to_summarize:
             raise HTTPException(status_code=400, detail="No text or case_id provided")

        # 3. Call AI Adapter
        adapter = get_adapter()
        summary = adapter.summarize(text_to_summarize)

        # 4. Store in Cache
        if settings.SUMMARY_CACHE_ENABLED:
            summary_cache[cache_key] = summary

        return SummarizeResponse(summary=summary, cached=False)

    except Exception as e:
        logger.error(f"Summarization error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)
