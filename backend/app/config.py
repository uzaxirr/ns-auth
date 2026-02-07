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

    # Session management
    session_secret: str = "change-me-64-chars-minimum-secret-key-for-session-tokens-here!!"
    session_expiry_seconds: int = 86400  # 24 hours

    # Authorization code flow
    authorization_code_expiry_seconds: int = 600  # 10 minutes
    frontend_url: str = "http://localhost:5173"

    # Privy integration
    privy_app_id: str = ""
    privy_app_secret: str = ""

    model_config = {"env_prefix": "OAUTH_", "env_file": ".env"}


settings = Settings()
