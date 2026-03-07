"""add nonce to authorization_codes

Revision ID: 8effab1c2e12
Revises: eabcc092b916
Create Date: 2026-03-07 14:55:42.712806
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '8effab1c2e12'
down_revision: Union[str, None] = 'eabcc092b916'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('authorization_codes', sa.Column('nonce', sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column('authorization_codes', 'nonce')
