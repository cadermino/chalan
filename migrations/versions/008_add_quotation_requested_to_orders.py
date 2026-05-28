"""Add quotation_requested flag to orders

Revision ID: 008
Revises: 007
Create Date: 2026-05-28
"""
from alembic import op

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS quotation_requested BOOLEAN DEFAULT FALSE
    """)


def downgrade():
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS quotation_requested")
