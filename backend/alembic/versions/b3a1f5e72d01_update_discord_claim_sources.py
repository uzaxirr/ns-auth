"""update discord claim sources

Revision ID: b3a1f5e72d01
Revises: e6ec3c33120a
Create Date: 2026-03-01 20:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision = "b3a1f5e72d01"  # type: str
down_revision = "e6ec3c33120a"  # type: str
branch_labels = None  # type: Union[str, Sequence[str], None]
depends_on = None  # type: Union[str, Sequence[str], None]


def upgrade() -> None:
    op.execute(
        "UPDATE claim_definitions SET source = 'discord' "
        "WHERE name IN ('roles', 'name', 'picture')"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE claim_definitions SET source = 'model' "
        "WHERE name IN ('roles', 'name', 'picture')"
    )
