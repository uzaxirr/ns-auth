from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    """OAuth 2.0 token response."""
    access_token: str = Field(..., description="RS256-signed JWT access token.")
    token_type: str = Field("Bearer", description="Token type (always `Bearer`).")
    expires_in: int = Field(..., description="Token lifetime in seconds (default 3600).")
    scope: Optional[str] = Field(None, description="Space-separated granted scopes.")


class IntrospectResponse(BaseModel):
    """Token introspection response (RFC 7662)."""
    active: bool = Field(..., description="`true` if the token is valid and not expired/revoked.")
    scope: Optional[str] = Field(None, description="Space-separated scopes.")
    client_id: Optional[str] = Field(None, description="Client that the token was issued to.")
    token_type: Optional[str] = Field(None, description="Token type (`Bearer`).")
    exp: Optional[int] = Field(None, description="Expiration timestamp (Unix epoch).")
    iat: Optional[int] = Field(None, description="Issued-at timestamp (Unix epoch).")
    jti: Optional[str] = Field(None, description="Unique token identifier (UUID).")
    iss: Optional[str] = Field(None, description="Issuer URL.")
