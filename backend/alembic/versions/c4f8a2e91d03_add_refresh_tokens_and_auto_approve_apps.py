"""Add refresh_tokens table and auto-approve apps

Revision ID: c4f8a2e91d03
Revises: b3a1f5e72d01
Create Date: 2026-03-01

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c4f8a2e91d03"
down_revision = "b3a1f5e72d01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("token_hash", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("jti", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column(
            "client_id",
            sa.String(64),
            sa.ForeignKey("oauth_apps.client_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("scopes", postgresql.ARRAY(sa.String), default=[]),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Auto-approve all existing pending apps
    op.execute("UPDATE oauth_apps SET status = 'approved' WHERE status = 'pending'")

    # Update server_default for new apps
    op.alter_column(
        "oauth_apps",
        "status",
        server_default="approved",
    )


def downgrade() -> None:
    op.alter_column(
        "oauth_apps",
        "status",
        server_default="pending",
    )
    op.drop_table("refresh_tokens")
