import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "Legal AI Service"
    PROJECT_VERSION: str = "1.0.0"
    
    # Gemini API Key
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY")
    
    # Database Settings (linked to same Postgres as Node.js)
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    
    # Provider Settings
    DEFAULT_PROVIDER: str = os.getenv("DEFAULT_PROVIDER", "gemini")
    
    # Caching Settings
    SUMMARY_CACHE_ENABLED: bool = os.getenv("SUMMARY_CACHE_ENABLED", "True").lower() == "true"

settings = Settings()
