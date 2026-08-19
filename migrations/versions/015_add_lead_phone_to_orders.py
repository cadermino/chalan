"""Add orders.lead_phone — optional contact phone captured from an
anonymous visitor between step-one and step-two, before any account
exists, so leads who never finish registering can still be followed up.

Revision ID: 015
Revises: 014
Create Date: 2026-08-18
"""
from alembic import op

revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS lead_phone VARCHAR(15)")


def downgrade():
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS lead_phone")
