"""add reviews table

Revision ID: 002
Revises: 001
Create Date: 2026-02-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001_initial_postgres'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'reviews',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=False),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.id'), nullable=False),
        sa.Column('carrier_company_id', sa.Integer(), sa.ForeignKey('carrier_company.id'), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('comment', sa.String(1000)),
        sa.Column('created_date', sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint('order_id', 'customer_id', name='uq_review_order_customer'),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='ck_review_rating'),
    )
    op.create_index('idx_reviews_carrier_company', 'reviews', ['carrier_company_id'])
    op.create_index('idx_reviews_customer', 'reviews', ['customer_id'])
    op.create_index('idx_reviews_rating', 'reviews', ['rating'])


def downgrade():
    op.drop_index('idx_reviews_rating')
    op.drop_index('idx_reviews_customer')
    op.drop_index('idx_reviews_carrier_company')
    op.drop_table('reviews')
