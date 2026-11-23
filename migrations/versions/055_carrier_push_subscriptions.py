"""Browser push notifications to carriers (Web Push).

`carrier_push_subscriptions`: one row per browser that turned on the notices
from the quotation link (`app/api/carrier_push.py`). `endpoint` is the browser's
inbox at its push service (Google, Apple, Mozilla, Microsoft) and is unique: the
same phone opening another company's link moves the row. `vapid_public_key` is
the key it subscribed with, so a database copied to another environment (with
its own keys) never pushes to production phones. A row is deleted when the push
service answers it no longer exists, or after several failures in a row.

Revision ID: 055
Revises: 054
Create Date: 2026-11-22
"""
from alembic import op

revision = '055'
down_revision = '054'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS carrier_push_subscriptions (
            id SERIAL PRIMARY KEY,
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id) ON DELETE CASCADE,
            endpoint TEXT NOT NULL UNIQUE,
            p256dh VARCHAR(200) NOT NULL,
            auth VARCHAR(100) NOT NULL,
            vapid_public_key VARCHAR(120) NOT NULL,
            user_agent VARCHAR(300) NULL,
            created_date TIMESTAMP NOT NULL DEFAULT now(),
            updated_date TIMESTAMP NOT NULL DEFAULT now(),
            last_sent_at TIMESTAMP NULL,
            last_error VARCHAR(200) NULL,
            failure_count INTEGER NOT NULL DEFAULT 0
        )
    """)
    op.execute('CREATE INDEX IF NOT EXISTS ix_carrier_push_subscriptions_company '
               'ON carrier_push_subscriptions (carrier_company_id)')
    op.execute('ALTER TABLE carrier_push_subscriptions ENABLE ROW LEVEL SECURITY')


def downgrade():
    op.execute('DROP TABLE IF EXISTS carrier_push_subscriptions')
