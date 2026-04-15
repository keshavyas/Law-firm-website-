from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from .config import settings
import logging

logger = logging.getLogger(__name__)

# Convert postgres:// to postgresql+asyncpg:// for async sqlalchemy
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

engine = create_async_engine(db_url, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_case_documents(case_id: str):
    async with AsyncSessionLocal() as session:
        try:
            # Query the 'cases' table directly for the JSONB 'documents' column
            result = await session.execute(
                text("SELECT documents, description, title FROM cases WHERE id = :case_id"),
                {"case_id": case_id}
            )
            row = result.fetchone()
            if row:
                return {
                    "documents": row[0], # List of filenames
                    "description": row[1],
                    "title": row[2]
                }
            return None
        except Exception as e:
            logger.error(f"DB Error: {str(e)}")
            return None
