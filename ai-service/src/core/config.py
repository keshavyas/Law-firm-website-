import os
from dotenv import load_dotenv

# Override=False ensures Docker/system env vars take priority over the .env file
load_dotenv(override=False)

class Settings:
    PROJECT_NAME: str = "Legal AI Service"
    PROJECT_VERSION: str = "1.0.0"

    # Gemini API Key — must be set in environment
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")

    # Configurable model via env var — defaults to the current recommended model
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    # Database Settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # Provider Settings
    DEFAULT_PROVIDER: str = os.getenv("DEFAULT_PROVIDER", "gemini")

    # Caching Settings
    SUMMARY_CACHE_ENABLED: bool = os.getenv("SUMMARY_CACHE_ENABLED", "True").lower() == "true"

settings = Settings()
