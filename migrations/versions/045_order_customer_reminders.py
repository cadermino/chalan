"""When a customer was reminded to choose a quotation.

"Recordar a clientes" in the backoffice opens WhatsApp with the order's
quotations and its access link. These columns keep the same customer from
being written to twice in a row and say, later, whether those who were
reminded chose a quotation.

Revision ID: 045
Revises: 044
Create Date: 2026-11-03
"""
from alembic import op

revision = '045'
down_revision = '044'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_reminded_at TIMESTAMP NULL')
    op.execute('ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_reminder_count INTEGER NOT NULL DEFAULT 0')


def downgrade():
    op.execute('ALTER TABLE orders DROP COLUMN IF EXISTS customer_reminder_count')
    op.execute('ALTER TABLE orders DROP COLUMN IF EXISTS customer_reminded_at')
