"""Videos of what an order carries, uploaded from the backoffice.

Customers send videos of their things over WhatsApp, and carriers quote
better from a walk-through than from photos. An admin uploads them in the
order's create/edit form, straight to S3 with a presigned POST
(`app/api/order_videos.py`), and the carrier sees them on the quotation link.
A separate table from `order_images`: every reader of that one draws an <img>,
and the AI item recognition runs on its rows. They live under `orders/`,
which the bucket policy already makes public, like the photos.

Revision ID: 035
Revises: 034
Create Date: 2026-10-23
"""
from alembic import op

revision = '035'
down_revision = '034'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS order_videos (
            id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            url VARCHAR(500) NOT NULL,
            storage_key VARCHAR(300) NOT NULL UNIQUE,
            content_type VARCHAR(60),
            size_bytes INTEGER,
            created_date TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_order_videos_order ON order_videos (order_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS order_videos")
