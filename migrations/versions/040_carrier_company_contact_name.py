"""The name a customer sees for a contact loaded by the admin.

Contacts from Google Maps that quote a service over WhatsApp become inactive
companies (backoffice-api contact-quotations). Their business name let the
customer look them up and hire them outside Chalán, so the customer now sees
the name of the person who answers instead: carrier_company.contact_name, used
on the customer's quotations page and contact card when set. Registered
companies keep it empty and are shown by their name, as before.

Revision ID: 040
Revises: 039
Create Date: 2026-10-29
"""
from alembic import op

revision = '040'
down_revision = '039'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE carrier_company ADD COLUMN IF NOT EXISTS contact_name VARCHAR(60)')


def downgrade():
    op.execute('ALTER TABLE carrier_company DROP COLUMN IF EXISTS contact_name')
