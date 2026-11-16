"""WhatsApps that an admin sends by hand, from Chalán's own WhatsApp.

The Twilio notices cost too much, so the backoffice opens the admin's WhatsApp
with the message written instead, and keeps track of who got one.

- `order_carrier_whatsapp`: one row per order and carrier company, stamped each
  time the order detail's "Avisar por WhatsApp" opens that carrier's chat. A
  stamp older than the order's last notice to carriers (`carrier_notified_at`)
  is from before the order changed, so that carrier is due again.
- `orders.customer_reminded_quotation_id`: the newest quotation the customer
  was told about by hand. A visible quotation with a higher id arrived after
  the last reminder, and "Recordar a clientes" tags it as new. Ids and not
  times because `quotations.created_date` comes from the database clock and
  `customer_reminded_at` from Python's UTC. Filled for the orders reminded
  before this with the quotations made up to that reminder (both UTC in
  production).

Revision ID: 052
Revises: 051
Create Date: 2026-11-16
"""
from alembic import op

revision = '052'
down_revision = '051'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS order_carrier_whatsapp (
            id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id) ON DELETE CASCADE,
            sent_at TIMESTAMP NOT NULL,
            sent_count INTEGER NOT NULL DEFAULT 1,
            admin_user_id INTEGER NULL,
            UNIQUE (order_id, carrier_company_id)
        )
    """)
    op.execute('ALTER TABLE order_carrier_whatsapp ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_reminded_quotation_id INTEGER NULL')
    op.execute("""
        UPDATE orders o SET customer_reminded_quotation_id = (
            SELECT max(q.id) FROM quotations q
            WHERE q.order_id = o.id AND q.created_date <= o.customer_reminded_at
        )
        WHERE o.customer_reminded_at IS NOT NULL AND o.customer_reminded_quotation_id IS NULL
    """)


def downgrade():
    op.execute('ALTER TABLE orders DROP COLUMN IF EXISTS customer_reminded_quotation_id')
    op.execute('DROP TABLE IF EXISTS order_carrier_whatsapp')
