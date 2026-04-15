from abc import ABC, abstractmethod
import google.generativeai as genai
from .config import settings

class AIAdapter(ABC):
    @abstractmethod
    def summarize(self, text: str) -> str:
        pass

class GeminiAdapter(AIAdapter):
    def __init__(self):
        genai.configure(api_key=settings.GOOGLE_API_KEY)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    def summarize(self, text: str) -> str:
        try:
            prompt = f"Please provide a concise and professional summary of the following legal document/text:\n\n{text}"
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            raise Exception(f"Gemini API Error: {str(e)}")

def get_adapter(provider: str = None) -> AIAdapter:
    provider = provider or settings.DEFAULT_PROVIDER
    if provider == "gemini":
        return GeminiAdapter()
    else:
        raise ValueError(f"Unsupported AI provider: {provider}")
