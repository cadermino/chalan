"""Who Chalán talks to at a carrier company.

The account of a company is made with the legal representative's name, but the
WhatsApp conversations are with whoever coordinates the moves. An admin writes
that person's name in carrier_company.coordinator_name, and the reminder to
carriers greets them by their first name. Not shown to customers: that is
contact_name (migration 040), which replaces the company name for contacts
loaded from a service.

Revision ID: 049
Revises: 048
Create Date: 2026-11-11
"""
from alembic import op

revision = '049'
down_revision = '048'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE carrier_company ADD COLUMN IF NOT EXISTS coordinator_name VARCHAR(60)')


def downgrade():
    op.execute('ALTER TABLE carrier_company DROP COLUMN IF EXISTS coordinator_name')
