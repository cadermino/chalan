"""Turn payments into a per-movement ledger.

Until now a booking produced a single payments row holding the gross the
customer pays. That worked while there was only one movement of money: the
customer handed everything to the carrier in cash. With the Yape reservation
there are two, with different recipients, timing and verification — the
commission (plus the referring agent's cut) goes to Chalán up front, the rest
goes to the carrier on moving day.

`concept` says what each row represents so a sum over an order adds up to the
total again. Existing rows are stamped `order_total`: they hold the old
one-row-per-order meaning and must not be mixed into per-movement reporting.
Note those rows already span three eras of `amount` (Stripe, cash before
2026-09-09 with the raw carrier price, cash after with the gross) separable
only by created_date — `order_total` keeps all of them out of the new maths.

`paid_at` / `confirmed_by_admin_id` exist because the Yape reservation has no
webhook: an admin confirms it by hand from the backoffice, and we want to know
who and when. No FK on confirmed_by_admin_id — admin_users belongs to the other
Flask app and nothing else in the shared schema declares one either.

Revision ID: 016
Revises: 015
Create Date: 2026-09-23
"""
from alembic import op

revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        INSERT INTO lu_payment_type (type)
        SELECT 'yape'
        WHERE NOT EXISTS (SELECT 1 FROM lu_payment_type WHERE type = 'yape')
    """)
    op.execute("ALTER TABLE payments ADD COLUMN IF NOT EXISTS concept VARCHAR(20)")
    op.execute("ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP")
    op.execute("ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmed_by_admin_id INTEGER")
    op.execute("UPDATE payments SET concept = 'order_total' WHERE concept IS NULL")


def downgrade():
    op.execute("ALTER TABLE payments DROP COLUMN IF EXISTS confirmed_by_admin_id")
    op.execute("ALTER TABLE payments DROP COLUMN IF EXISTS paid_at")
    op.execute("ALTER TABLE payments DROP COLUMN IF EXISTS concept")
    # La fila de lu_payment_type no se borra: si quedaron pagos apuntando a
    # 'yape', quitarla rompería la FK.
