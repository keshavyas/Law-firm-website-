from abc import ABC, abstractmethod
import google.generativeai as genai
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
    _configured = False

    def __init__(self):
        if not GeminiAdapter._configured:
            genai.configure(api_key=settings.GOOGLE_API_KEY)
            GeminiAdapter._configured = True
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    async def summarize(self, text: str) -> str:
        try:
            prompt = f"Please provide a concise and professional summary of the following legal document/text:\n\n{text}"
            response = await self.model.generate_content_async(prompt)
            if not response.text:
                 # Check if the response was blocked by safety filters
                 return "Summary unavailable: The content was filtered by the AI safety system."
            return response.text
        except Exception as e:
            logger.error(f"Gemini Summarization Error: {str(e)}")
            raise Exception(f"Gemini API Error: {str(e)}")

    async def extract_deadlines(self, text: str) -> str:
        try:
            prompt = f"Please extract all deadlines and dates from the following legal text:\n\n{text}"
            response = await self.model.generate_content_async(prompt)
            return response.text
        except Exception as e:
            raise Exception(f"Gemini API Error: {str(e)}")

def get_adapter(provider: str = None) -> AIAdapter:
    provider = provider or settings.DEFAULT_PROVIDER
    if provider == "gemini":
        return GeminiAdapter()
    else:
        raise ValueError(f"Unsupported AI provider: {provider}")

