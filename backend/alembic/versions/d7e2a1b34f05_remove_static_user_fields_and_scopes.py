"""Remove static user fields and scopes

Drop cohort, bio, socials, wallet_address columns from users table.
Delete scope_definitions and claim_definitions for removed scopes.

Revision ID: d7e2a1b34f05
Revises: c4f8a2e91d03
Create Date: 2026-03-01

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d7e2a1b34f05"
down_revision = "c4f8a2e91d03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop static columns from users table
    op.drop_column("users", "cohort")
    op.drop_column("users", "bio")
    op.drop_column("users", "socials")
    op.drop_column("users", "wallet_address")

    # Delete claim definitions for removed claims
    op.execute("""
        DELETE FROM claim_definitions
        WHERE name IN ('bio', 'cohort', 'wallet_address', 'socials', 'posts_count', 'streak_days', 'last_active')
    """)

    # Delete scope definitions for removed scopes
    op.execute("""
        DELETE FROM scope_definitions
        WHERE name IN ('cohort', 'socials', 'wallet', 'activity')
    """)

    # Remove 'bio' claim from the profile scope's claims (JSON column)
    op.execute("""
        UPDATE scope_definitions
        SET claims = '["name", "picture"]'::json
        WHERE name = 'profile'
    """)


def downgrade() -> None:
    # Re-add columns
    op.add_column("users", sa.Column("wallet_address", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("socials", sa.JSON(), nullable=True))
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("cohort", sa.String(100), nullable=True))
