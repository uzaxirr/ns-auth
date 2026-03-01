"""Add Discord detail claims to scopes

Add claim_definitions for discord_username, discord_joined_at,
boosting_since, banner_url, accent_color, public_badges.
Update profile and date_joined scope_definitions to include them.

Revision ID: f1a3b7c92e04
Revises: d7e2a1b34f05
Create Date: 2026-03-01

"""
from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "f1a3b7c92e04"
down_revision = "d7e2a1b34f05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new claim definitions (all Discord-sourced)
    op.execute("""
        INSERT INTO claim_definitions (id, name, label, description, source, is_active, created_at)
        VALUES
            (gen_random_uuid(), 'discord_username', 'Discord Username', 'The user''s Discord handle (e.g. alice_dev)', 'discord', true, now()),
            (gen_random_uuid(), 'discord_joined_at', 'Discord Joined At', 'When the user joined the NS Discord server (ISO 8601)', 'discord', true, now()),
            (gen_random_uuid(), 'boosting_since', 'Boosting Since', 'When the user started boosting the NS server, or null', 'discord', true, now()),
            (gen_random_uuid(), 'banner_url', 'Banner URL', 'URL to the user''s Discord profile banner image', 'discord', true, now()),
            (gen_random_uuid(), 'accent_color', 'Accent Color', 'User''s profile accent color as hex (e.g. #1a2b3c)', 'discord', true, now()),
            (gen_random_uuid(), 'public_badges', 'Public Badges', 'Discord badges (e.g. Active Developer, Early Supporter)', 'discord', true, now())
        ON CONFLICT (name) DO NOTHING
    """)

    # Update profile scope: add discord_username, banner_url, accent_color, public_badges
    op.execute("""
        UPDATE scope_definitions
        SET claims = '["name", "picture", "discord_username", "banner_url", "accent_color", "public_badges"]'::json
        WHERE name = 'profile'
    """)

    # Update date_joined scope: add discord_joined_at, boosting_since
    op.execute("""
        UPDATE scope_definitions
        SET claims = '["date_joined", "discord_joined_at", "boosting_since"]'::json
        WHERE name = 'date_joined'
    """)


def downgrade() -> None:
    # Restore profile scope
    op.execute("""
        UPDATE scope_definitions
        SET claims = '["name", "picture"]'::json
        WHERE name = 'profile'
    """)

    # Restore date_joined scope
    op.execute("""
        UPDATE scope_definitions
        SET claims = '["date_joined"]'::json
        WHERE name = 'date_joined'
    """)

    # Remove new claim definitions
    op.execute("""
        DELETE FROM claim_definitions
        WHERE name IN ('discord_username', 'discord_joined_at', 'boosting_since', 'banner_url', 'accent_color', 'public_badges')
    """)
