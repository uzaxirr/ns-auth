from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class OAuthAppCreate(BaseModel):
    """Request body for creating a new OAuth application."""
    name: str = Field(..., description="Display name of the application.", examples=["My Cool App"])
    description: Optional[str] = Field(None, description="Short description of the application.", examples=["A demo OAuth client for testing."])
    scopes: List[str] = Field([], description="Requested OAuth scopes. Validated against available scopes: openid, profile, email, cohort, activity, socials, wallet, offline_access.", examples=[["openid", "email", "profile"]])
    redirect_uris: List[str] = Field([], description="Allowed OAuth callback URLs.", examples=[["https://myapp.example.com/callback"]])
    icon_url: Optional[str] = Field(None, description="URL to the app icon (set via icon upload endpoint).")
    privacy_policy_url: Optional[str] = Field(None, description="URL to the app's privacy policy.", examples=["https://myapp.example.com/privacy"])


class OAuthAppUpdate(BaseModel):
    """Request body for partially updating an OAuth application. Only provided fields are changed."""
    name: Optional[str] = Field(None, description="New display name.")
    description: Optional[str] = Field(None, description="New description.")
    scopes: Optional[List[str]] = Field(None, description="New scopes (validated).")
    redirect_uris: Optional[List[str]] = Field(None, description="New redirect URIs.")
    icon_url: Optional[str] = Field(None, description="New icon URL.")
    privacy_policy_url: Optional[str] = Field(None, description="New privacy policy URL.")


class OAuthAppResponse(BaseModel):
    """OAuth application details (without client secret)."""
    id: UUID = Field(..., description="Unique app identifier.")
    name: str = Field(..., description="Display name.")
    description: Optional[str] = Field(None, description="App description.")
    client_id: str = Field(..., description="OAuth client ID (32-char hex).")
    scopes: List[str] = Field(..., description="Registered scopes.")
    redirect_uris: List[str] = Field(..., description="Registered callback URLs.")
    icon_url: Optional[str] = Field(None, description="App icon URL path.")
    privacy_policy_url: Optional[str] = Field(None, description="Privacy policy URL.")
    created_at: datetime = Field(..., description="UTC creation timestamp.")
    updated_at: datetime = Field(..., description="UTC last-updated timestamp.")

    model_config = {"from_attributes": True}


class OAuthAppCreated(OAuthAppResponse):
    """OAuth application with client secret. The secret is only returned once at creation time."""
    client_secret: str = Field(..., description="Client secret (returned ONCE at creation — stored as bcrypt hash, never retrievable again).")
