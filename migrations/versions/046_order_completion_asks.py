"""When a visitor who left only their WhatsApp was asked for the missing data.

"Completar órdenes" in the backoffice opens WhatsApp asking what the order
still needs before it can go to carriers (moving day, what it carries, name
and email). These columns keep the same visitor from being written to twice
in a row and say, later, whether those who were asked completed the order.

Revision ID: 046
Revises: 045
Create Date: 2026-11-03
"""
from alembic import op

revision = '046'
down_revision = '045'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE orders ADD COLUMN IF NOT EXISTS completion_asked_at TIMESTAMP NULL')
    op.execute('ALTER TABLE orders ADD COLUMN IF NOT EXISTS completion_ask_count INTEGER NOT NULL DEFAULT 0')


def downgrade():
    op.execute('ALTER TABLE orders DROP COLUMN IF EXISTS completion_ask_count')
    op.execute('ALTER TABLE orders DROP COLUMN IF EXISTS completion_asked_at')
