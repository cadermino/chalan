"""add commission_rate to admin_users, commission to referred_orders

Revision ID: 006
Revises: 005
Create Date: 2026-04-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS commission_rate FLOAT DEFAULT 0.05 NOT NULL
    """)
    op.execute("""
        ALTER TABLE referred_orders ADD COLUMN IF NOT EXISTS commission FLOAT DEFAULT 0 NOT NULL
    """)


def downgrade():
    op.drop_column('referred_orders', 'commission')
    op.drop_column('admin_users', 'commission_rate')
