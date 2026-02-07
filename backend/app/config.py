from __future__ import annotations

from typing import List, Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://uzaxirr@localhost:5432/oauth_provider"
    database_url_sync: str = "postgresql://uzaxirr@localhost:5432/oauth_provider"
    cors_origins: List[str] = ["http://localhost:5173"]
    token_expiry_seconds: int = 3600
    issuer: str = "http://localhost:8000"
    keys_dir: str = "keys"
    uploads_dir: str = "uploads"
    rsa_private_key: Optional[str] = None  # base64-encoded PEM
    rsa_public_key: Optional[str] = None  # base64-encoded PEM

    model_config = {"env_prefix": "OAUTH_"}


settings = Settings()
