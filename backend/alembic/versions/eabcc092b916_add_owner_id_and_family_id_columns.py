"""add owner_id and family_id columns

Revision ID: eabcc092b916
Revises: 1b6f071bb555
Create Date: 2026-03-07 14:51:56.739939
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'eabcc092b916'
down_revision: Union[str, None] = '1b6f071bb555'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('oauth_apps', sa.Column('owner_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_oauth_apps_owner_id', 'oauth_apps', 'users', ['owner_id'], ['id'], ondelete='SET NULL')
    op.add_column('refresh_tokens', sa.Column('family_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_refresh_tokens_family_id'), 'refresh_tokens', ['family_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_refresh_tokens_family_id'), table_name='refresh_tokens')
    op.drop_column('refresh_tokens', 'family_id')
    op.drop_constraint('fk_oauth_apps_owner_id', 'oauth_apps', type_='foreignkey')
    op.drop_column('oauth_apps', 'owner_id')
