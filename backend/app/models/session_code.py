from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SessionCode(Base):
    """Short-lived, single-use code for session token relay.

    After Discord login, the backend stores a session code (not the JWT itself)
    and redirects to the frontend with ?code=<code>. The frontend exchanges
    this code via POST /auth/session/exchange to get the actual session JWT.
    This prevents the session token from appearing in URLs, browser history,
    Referer headers, or server logs (RFC 6819 S5.1.1).
    """
    __tablename__ = "session_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
