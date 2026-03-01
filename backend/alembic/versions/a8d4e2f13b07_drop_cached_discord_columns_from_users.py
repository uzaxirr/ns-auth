"""Drop cached Discord columns from users

Remove discord_username, discord_avatar, discord_roles, display_name,
avatar_url, user_metadata from users table. All profile data is now
fetched live from the Discord API — no DB storage needed.

Revision ID: a8d4e2f13b07
Revises: f1a3b7c92e04
Create Date: 2026-03-01

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision = "a8d4e2f13b07"
down_revision = "f1a3b7c92e04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("users", "discord_username")
    op.drop_column("users", "discord_avatar")
    op.drop_column("users", "discord_roles")
    op.drop_column("users", "display_name")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "user_metadata")


def downgrade() -> None:
    op.add_column("users", sa.Column("user_metadata", JSON, nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("display_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("discord_roles", JSON, nullable=True))
    op.add_column("users", sa.Column("discord_avatar", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("discord_username", sa.String(255), nullable=True))
