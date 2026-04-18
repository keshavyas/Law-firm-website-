from abc import ABC, abstractmethod
from google import genai
from .config import settings
import logging
import asyncio

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
        # We reuse the same client but use the .aio namespace for async calls
        self.client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        self.models_to_try = [
            'gemini-1.5-flash',
            'gemini-1.5-flash-latest',
            'gemini-1.5-pro',
            'gemini-2.0-flash-exp', # Adding a newer experimental model as an extra fallback
        ]

    async def _generate_with_fallback(self, prompt: str) -> str:
        last_error = None
        for model_name in self.models_to_try:
            try:
                logger.info(f"Attempting generation with model: {model_name}")
                # Use the asynchronous namespace .aio
                response = await self.client.aio.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                
                if response and response.text:
                    return response.text
                
                logger.warning(f"Model {model_name} returned empty response or was filtered.")
                
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Model {model_name} failed: {last_error}")
                # If the error is definitely not a 'not found' error, it might be quota/auth
                # but we'll try other models regardless to be safe.
                continue
        
        raise Exception(f"All Gemini models failed. Last error: {last_error}")

    async def summarize(self, text: str) -> str:
        try:
            prompt = f"Please provide a concise and professional summary of the following legal document/text:\n\n{text}"
            return await self._generate_with_fallback(prompt)
        except Exception as e:
            logger.error(f"Gemini Summarization Error: {str(e)}")
            raise Exception(f"Gemini API Error: {str(e)}")

    async def extract_deadlines(self, text: str) -> str:
        try:
            prompt = f"Please extract all deadlines and dates from the following legal text:\n\n{text}"
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
