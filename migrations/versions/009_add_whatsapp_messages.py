"""Add whatsapp_messages table

Revision ID: 009
Revises: 008
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'whatsapp_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('message_sid', sa.String(64), nullable=True),
        sa.Column('direction', sa.String(10), nullable=False),
        sa.Column('from_number', sa.String(20), nullable=False),
        sa.Column('to_number', sa.String(20), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('media_urls', sa.Text(), nullable=True),
        sa.Column('profile_name', sa.String(120), nullable=True),
        sa.Column('customer_id', sa.Integer(), nullable=True),
        sa.Column('admin_user_id', sa.Integer(), nullable=True),
        sa.Column('sent_by_admin_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), nullable=True),
        sa.Column('error_code', sa.String(20), nullable=True),
        sa.Column('error_message', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id']),
        sa.ForeignKeyConstraint(['admin_user_id'], ['admin_users.id']),
        sa.ForeignKeyConstraint(['sent_by_admin_id'], ['admin_users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('message_sid'),
    )
    op.create_index('ix_whatsapp_messages_from_number', 'whatsapp_messages', ['from_number'])
    op.create_index('ix_whatsapp_messages_customer_id', 'whatsapp_messages', ['customer_id'])
    op.create_index('ix_whatsapp_messages_admin_user_id', 'whatsapp_messages', ['admin_user_id'])
    op.create_index('ix_whatsapp_messages_created_at', 'whatsapp_messages', ['created_at'])


def downgrade():
    op.drop_index('ix_whatsapp_messages_created_at', 'whatsapp_messages')
    op.drop_index('ix_whatsapp_messages_admin_user_id', 'whatsapp_messages')
    op.drop_index('ix_whatsapp_messages_customer_id', 'whatsapp_messages')
    op.drop_index('ix_whatsapp_messages_from_number', 'whatsapp_messages')
    op.drop_table('whatsapp_messages')
