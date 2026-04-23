"""add referred_orders table

Revision ID: 004
Revises: 003
Create Date: 2026-04-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS referred_orders (
            id SERIAL PRIMARY KEY,
            admin_user_id INTEGER NOT NULL REFERENCES admin_users(id),
            order_id INTEGER NOT NULL REFERENCES orders(id),
            created_date TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_referred_orders_admin_user_id
        ON referred_orders (admin_user_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_referred_orders_order_id
        ON referred_orders (order_id)
    """)


def downgrade():
    op.drop_index('idx_referred_orders_order_id')
    op.drop_index('idx_referred_orders_admin_user_id')
    op.drop_table('referred_orders')
