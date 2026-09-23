"""Tie each payment row to the quotation it was created for.

checkout-cash had no idempotency: confirming, going back from the dashboard
and confirming again ran it a second time, sending both notification emails
again and — since 016 split payments per movement — adding a second pair of
rows, so summing an order returned double what the customer owes. The modal's
cashPaymentCreated flag guarded only within one mount, and going back remounts
the view.

Knowing which quotation a row belongs to is what makes the endpoint idempotent
without breaking the legitimate case: a customer who goes back and picks a
different carrier does need new rows and a new email, and the rows of the
carrier they dropped need cancelling so the order stops adding up to two
bookings.

Backfills rows created by 016 from the order's selected quotation. `order_total`
rows are left NULL on purpose: they predate the per-movement split and no single
quotation owns them.

Revision ID: 017
Revises: 016
Create Date: 2026-09-24
"""
from alembic import op

revision = '017'
down_revision = '016'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE payments ADD COLUMN IF NOT EXISTS quotation_id INTEGER")
    op.execute("""
        UPDATE payments p
        SET quotation_id = q.id
        FROM quotations q
        WHERE q.order_id = p.order_id
          AND q.quotation_status_id = 2
          AND p.quotation_id IS NULL
          AND p.concept IN ('carrier_cash', 'reservation')
    """)


def downgrade():
    op.execute("ALTER TABLE payments DROP COLUMN IF EXISTS quotation_id")
