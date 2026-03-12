"""add order_images table

Revision ID: 003
Revises: 002
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'order_images',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=False),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('storage_key', sa.String(300), nullable=False),
        sa.Column('created_date', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('idx_order_images_order_id', 'order_images', ['order_id'])


def downgrade():
    op.drop_index('idx_order_images_order_id')
    op.drop_table('order_images')
