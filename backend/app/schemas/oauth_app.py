from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class OAuthAppCreate(BaseModel):
    name: str
    description: Optional[str] = None
    scopes: List[str] = []
    redirect_uris: List[str] = []


class OAuthAppResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    client_id: str
    scopes: List[str]
    redirect_uris: List[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OAuthAppCreated(OAuthAppResponse):
    client_secret: str  # only returned once on creation
