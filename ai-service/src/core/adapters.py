from abc import ABC, abstractmethod
from google import genai
from .config import settings
import logging

logger = logging.getLogger(__name__)

class AIAdapter(ABC):
    @abstractmethod
    async def summarize(self, text: str) -> str:
        pass
        
    @abstractmethod
    async def extract_deadlines(self, text: str) -> str:
        pass

class GeminiAdapter(AIAdapter):
    def __init__(self):
        # google-genai >= 1.0.0 uses the stable v1 API endpoint
        self.client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        # Models in order of preference — all available on the v1 stable API
        self.models_to_try = [
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
        ]

    async def _generate_with_fallback(self, prompt: str) -> str:
        last_error = None
        for model_name in self.models_to_try:
            try:
                logger.info(f"Attempting generation with model: {model_name}")
                # google-genai >= 1.0 uses client.aio for async
                response = await self.client.aio.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                if response and response.text:
                    logger.info(f"Successfully generated with model: {model_name}")
                    return response.text
                logger.warning(f"Model {model_name} returned empty response.")
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Model {model_name} failed: {last_error}")
                continue

        raise Exception(f"All Gemini models failed. Last error: {last_error}")

    async def summarize(self, text: str) -> str:
        try:
            prompt = (
                "You are a legal assistant. Please provide a concise and professional "
                "summary of the following legal case document. Highlight key parties, "
                "issues, and relevant dates:\n\n" + text
            )
            return await self._generate_with_fallback(prompt)
        except Exception as e:
            logger.error(f"Gemini Summarization Error: {str(e)}")
            raise Exception(f"Gemini API Error: {str(e)}")

    async def extract_deadlines(self, text: str) -> str:
        try:
            prompt = (
                "You are a legal assistant. Please extract all deadlines, important dates, "
                "and time-sensitive items from the following legal text:\n\n" + text
            )
            return await self._generate_with_fallback(prompt)
        except Exception as e:
            logger.error(f"Gemini Deadline Extraction Error: {str(e)}")
            raise Exception(f"Gemini API Error: {str(e)}")

def get_adapter(provider: str = None) -> AIAdapter:
    provider = provider or settings.DEFAULT_PROVIDER
    if provider == "gemini":
        return GeminiAdapter()
    else:
        raise ValueError(f"Unsupported AI provider: {provider}")
