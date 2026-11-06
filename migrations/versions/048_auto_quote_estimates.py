"""What each carrier would have quoted with its rates, computed without showing it.

Before quoting for carriers that do not answer, two weeks of quoting silently:
20 minutes after an order goes to carriers, the main API computes what each
company with rates would charge (`flask auto-quote`) and stores it here, next to
what the company then quotes for real. Nobody else sees it; the backoffice
compares both to decide which companies can be quoted for.

- `orders.estimated_volume_m3` / `volume_breakdown`: the m³ read from the item
  list (`app/api/order/volume.py`) and how, so it can be checked.
- `orders.auto_quote_checked_at`: the last time the job looked at the order. It
  looks again when the order is sent to carriers again (`carrier_notified_at`
  newer), which happens after the customer changes it.
- `orders.auto_quote_skip`: why nothing was computed for the order (outside
  Lima, cargo, no list...), NULL when it was.
- `auto_quote_estimates`: one row per company and notification. `amount` is the
  company's own price (no fee), or NULL with `skip_reason` when the company
  could not take it (day blocked or full, too big, too far, declined).

Revision ID: 048
Revises: 047
Create Date: 2026-11-06
"""
from alembic import op

revision = '048'
down_revision = '047'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_volume_m3 NUMERIC(6, 2) NULL')
    op.execute('ALTER TABLE orders ADD COLUMN IF NOT EXISTS volume_breakdown JSONB NULL')
    op.execute('ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_quote_checked_at TIMESTAMP NULL')
    op.execute('ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_quote_skip VARCHAR(20) NULL')
    op.execute("""
        CREATE TABLE IF NOT EXISTS auto_quote_estimates (
            id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id) ON DELETE CASCADE,
            notified_at TIMESTAMP NOT NULL,
            amount INTEGER NULL,
            skip_reason VARCHAR(20) NULL,
            inputs JSONB NULL,
            lines JSONB NULL,
            created_date TIMESTAMP DEFAULT now(),
            CHECK ((amount IS NULL) <> (skip_reason IS NULL))
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS auto_quote_estimates_uq
        ON auto_quote_estimates (order_id, carrier_company_id, notified_at)
    """)
    op.execute('ALTER TABLE auto_quote_estimates ENABLE ROW LEVEL SECURITY')


def downgrade():
    op.execute('DROP TABLE IF EXISTS auto_quote_estimates')
    op.execute('ALTER TABLE orders DROP COLUMN IF EXISTS auto_quote_skip')
    op.execute('ALTER TABLE orders DROP COLUMN IF EXISTS auto_quote_checked_at')
    op.execute('ALTER TABLE orders DROP COLUMN IF EXISTS volume_breakdown')
    op.execute('ALTER TABLE orders DROP COLUMN IF EXISTS estimated_volume_m3')
