"""Browser push notifications to customers (Web Push).

`customer_push_subscriptions`: one row per browser where a customer turned on
"Te avisamos aquí cuando llegue cada cotización" in step 3
(`app/api/customer_push.py`). Like `carrier_push_subscriptions`: `endpoint` is
the browser's inbox at its push service and is unique (the same phone signing
in as another customer moves the row), `vapid_public_key` keeps a copied
database from pushing to production phones, and a row is deleted when the push
service says it no longer exists or after several failures in a row.

Revision ID: 057
Revises: 056
Create Date: 2026-11-25
"""
from alembic import op

revision = '057'
down_revision = '056'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS customer_push_subscriptions (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
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
    op.execute('CREATE INDEX IF NOT EXISTS ix_customer_push_subscriptions_customer '
               'ON customer_push_subscriptions (customer_id)')
    op.execute('ALTER TABLE customer_push_subscriptions ENABLE ROW LEVEL SECURITY')


def downgrade():
    op.execute('DROP TABLE IF EXISTS customer_push_subscriptions')
