"""WhatsApps sent by hand for service requests, like 052 for moving orders.

- `service_request_carrier_whatsapp`: one row per request and company, stamped
  each time the request detail's "Avisar por WhatsApp" opens that company's
  chat. Editing a request tells nobody, so a stamp does not go stale.
- `service_requests.customer_reminded_at`, `customer_reminder_count` and
  `customer_reminded_quotation_id`: when and how many times the customer was
  told about their quotations by hand, and the newest one the message showed.
  A quotation with a higher id is new since then.

Revision ID: 053
Revises: 052
Create Date: 2026-11-16
"""
from alembic import op

revision = '053'
down_revision = '052'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS service_request_carrier_whatsapp (
            id SERIAL PRIMARY KEY,
            service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id) ON DELETE CASCADE,
            sent_at TIMESTAMP NOT NULL,
            sent_count INTEGER NOT NULL DEFAULT 1,
            admin_user_id INTEGER NULL,
            UNIQUE (service_request_id, carrier_company_id)
        )
    """)
    op.execute('ALTER TABLE service_request_carrier_whatsapp ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS customer_reminded_at TIMESTAMP NULL')
    op.execute('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS customer_reminder_count INTEGER NOT NULL DEFAULT 0')
    op.execute('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS customer_reminded_quotation_id INTEGER NULL')


def downgrade():
    op.execute('ALTER TABLE service_requests DROP COLUMN IF EXISTS customer_reminded_quotation_id')
    op.execute('ALTER TABLE service_requests DROP COLUMN IF EXISTS customer_reminder_count')
    op.execute('ALTER TABLE service_requests DROP COLUMN IF EXISTS customer_reminded_at')
    op.execute('DROP TABLE IF EXISTS service_request_carrier_whatsapp')
