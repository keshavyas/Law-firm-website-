from abc import ABC, abstractmethod
from google import genai
from .config import settings
import logging
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Retry decorator — retries up to 3 times on any Exception with exponential
# back-off (1 s, 2 s, 4 s). Can be tuned via constructor if needed later.
# ---------------------------------------------------------------------------
def _make_retry():
    return retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type(Exception),
        before_sleep=lambda rs: logger.warning(
            f"Retry {rs.attempt_number} after error: {rs.outcome.exception()}"
        ),
    )

class AIAdapter(ABC):
    @abstractmethod
    async def summarize(self, text: str) -> str:
        pass

    @abstractmethod
    async def extract_deadlines(self, text: str) -> str:
        pass


class GeminiAdapter(AIAdapter):
    """
    Adapter for Google Gemini via the modern google-genai SDK (>= 1.0.0).
    Uses the stable v1 API endpoint. Tries a primary model and falls back
    to alternatives if a 404 is returned (model retired / region-blocked).
    """

    def __init__(self):
        if not settings.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY environment variable is not set.")

        self.client = genai.Client(
            api_key=settings.GOOGLE_API_KEY,
            http_options={'api_version': 'v1'}
        )

        # Priority model list — explicitly verified to be active and responsive for this account.
        # These identifiers have been confirmed to work with the stable v1 API.
        self.models_to_try = [
            "models/gemini-2.5-flash",
            "models/gemini-2.5-flash-lite",
        ]
        logger.info(f"GeminiAdapter initialized with stable v1 API. Primary fallback model: {self.models_to_try[0]}")

    async def _call_model(self, model_name: str, prompt: str) -> str:
        """Single model call — decorated externally with retry logic."""
        response = await self.client.aio.models.generate_content(
            model=model_name,
            contents=prompt,
        )
        if response and response.text:
            return response.text
        raise ValueError(f"Model {model_name} returned an empty response (possible safety block).")

    async def _generate_with_fallback(self, prompt: str) -> str:
        last_error: str = ""
        for model_name in self.models_to_try:
            try:
                logger.info(f"Trying model: {model_name}")
                # Apply per-call retry with exponential back-off
                result = await _make_retry()(self._call_model)(model_name, prompt)
                logger.info(f"Success with model: {model_name}")
                return result
            except Exception as exc:
                last_error = str(exc)
                err_lower = last_error.lower()
                # Skip to next model on 'not found', 'not supported', or 'quota/exhausted' errors
                if any(x in err_lower for x in ["404", "not found", "not supported", "429", "quota", "exhausted"]):
                    logger.warning(f"Model {model_name} failed or capped, trying next. Error: {last_error}")
                    continue
                # For auth or other critical errors stop immediately — trying other models won't help
                logger.error(f"Non-retryable error with model {model_name}: {last_error}")
                raise Exception(f"Gemini API Error: {last_error}")

        raise Exception(f"All Gemini models exhausted. Last error: {last_error}")

    async def summarize(self, text: str) -> str:
        prompt = (
            "You are an expert legal assistant. Provide a concise, professional summary "
            "of the following legal case, highlighting key parties, main legal issues, "
            "claims, and important dates:\n\n" + text
        )
        return await self._generate_with_fallback(prompt)

    async def extract_deadlines(self, text: str) -> str:
        prompt = (
            "You are an expert legal assistant. Extract all deadlines, important dates, "
            "and time-sensitive obligations from the following legal text. "
            "Present them as a clear, ordered list:\n\n" + text
        )
        return await self._generate_with_fallback(prompt)


def get_adapter(provider: str = None) -> AIAdapter:
    provider = provider or settings.DEFAULT_PROVIDER
    if provider == "gemini":
        return GeminiAdapter()
    raise ValueError(f"Unsupported AI provider: {provider}")
