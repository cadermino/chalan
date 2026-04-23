"""add referral_code column to admin_users

Revision ID: 005
Revises: 004
Create Date: 2026-04-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('admin_users', sa.Column('referral_code', sa.String(10), nullable=True))
    op.create_unique_constraint('uq_admin_users_referral_code', 'admin_users', ['referral_code'])


def downgrade():
    op.drop_constraint('uq_admin_users_referral_code', 'admin_users', type_='unique')
    op.drop_column('admin_users', 'referral_code')
