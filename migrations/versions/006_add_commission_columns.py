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
    op.add_column('admin_users', sa.Column('commission_rate', sa.Float(), server_default='0.05', nullable=False))
    op.add_column('referred_orders', sa.Column('commission', sa.Float(), server_default='0', nullable=False))


def downgrade():
    op.drop_column('referred_orders', 'commission')
    op.drop_column('admin_users', 'commission_rate')
