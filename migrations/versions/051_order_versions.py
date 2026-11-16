"""Every version of a moving order once it has gone to carriers.

The customer could change the day, the things or the addresses after the order
was sent, and the PUT wrote over what was there: the carrier got "La orden
cambió, vuelve a cotizar" and had to guess what changed. Now each change leaves
a row here with what a carrier reads of the order (`app/api/order/versions.py`),
so the backoffice can show a diff between any two versions.

- `order_versions`: one row per change from the first notice to carriers on
  (before that it is a draft nobody saw). `snapshot` is the whole order as the
  carrier reads it, not a per-field log. `author` is `customer` or `admin`
  (with `admin_user_id` when known), and `notified_at` marks a version that was
  sent to carriers.
- `quotations.order_version_id`: the version a carrier quoted on, set when it
  quotes and when it quotes again.

Revision ID: 051
Revises: 050
Create Date: 2026-11-15
"""
from alembic import op

revision = '051'
down_revision = '050'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS order_versions (
            id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            number INTEGER NOT NULL,
            author VARCHAR(20) NOT NULL,
            admin_user_id INTEGER NULL,
            snapshot JSONB NOT NULL,
            notified_at TIMESTAMP NULL,
            created_date TIMESTAMP NOT NULL DEFAULT now(),
            UNIQUE (order_id, number)
        )
    """)
    op.execute('ALTER TABLE order_versions ENABLE ROW LEVEL SECURITY')
    op.execute("""
        ALTER TABLE quotations ADD COLUMN IF NOT EXISTS order_version_id INTEGER NULL
            REFERENCES order_versions(id) ON DELETE SET NULL
    """)


def downgrade():
    op.execute('ALTER TABLE quotations DROP COLUMN IF EXISTS order_version_id')
    op.execute('DROP TABLE IF EXISTS order_versions')
