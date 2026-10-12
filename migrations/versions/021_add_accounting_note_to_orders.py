"""Add orders.accounting_note: an order whose money is reconciled by hand.

Some deals are closed outside the standard model. The first was order 144:
Chalán invoiced the whole move with IGV charged to the customer, collected
everything itself and paid the carrier, while the platform assumes Chalán only
sells its fee with IGV inside it and the carrier collects its part in cash. The
backoffice breakdown, payments and dashboard keep showing the standard numbers
for those orders.

They are rare, and the accountant may change the invoicing model for every
order anyway, so instead of encoding a second fiscal model this marks the order
for manual reconciliation. A non-empty note means "reconcile in accounting" and
says how; NULL means the order follows the standard model. One column, not a
flag plus a note: a flag nobody explained is useless three months later.

Run this before deploying backoffice-api, whose model reads the column.

Revision ID: 021
Revises: 020
Create Date: 2026-10-12
"""
from alembic import op

revision = '021'
down_revision = '020'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS accounting_note TEXT")


def downgrade():
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS accounting_note")
