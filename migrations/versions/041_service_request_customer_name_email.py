"""The customer's name (required on submit) and email (optional) on service requests.

Service requests had only the customer's WhatsApp: the backoffice showed a
number, the chosen company did not know whom it was writing to, and a review
would have no author. The form now asks for a first name next to the WhatsApp,
and an email that is optional for now (the plan is to send what is not "you
have a quotation" by email instead of WhatsApp). Requests from before keep
both empty.

Revision ID: 041
Revises: 040
Create Date: 2026-10-29
"""
from alembic import op

revision = '041'
down_revision = '040'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS customer_name VARCHAR(60)')
    op.execute('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255)')


def downgrade():
    op.execute('ALTER TABLE service_requests DROP COLUMN IF EXISTS customer_email')
    op.execute('ALTER TABLE service_requests DROP COLUMN IF EXISTS customer_name')
