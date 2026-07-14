"""Add carrier_notified_at to orders

Revision ID: 011
Revises: 010
Create Date: 2026-07-13
"""
from alembic import op

revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS carrier_notified_at TIMESTAMP
    """)


def downgrade():
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS carrier_notified_at")
