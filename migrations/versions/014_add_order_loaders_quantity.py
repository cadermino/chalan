"""Add orders.loaders_quantity — optional count of extra loaders a
customer requests on top of the default cargador + chofer cargador.

Revision ID: 014
Revises: 013
Create Date: 2026-08-13
"""
from alembic import op

revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS loaders_quantity INTEGER")


def downgrade():
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS loaders_quantity")
