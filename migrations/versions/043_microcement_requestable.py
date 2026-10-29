"""Open microcement application to the request form.

`microcement` has been in the catalog since 027 so admins could tick it for a
company, and its landing (/microcemento) quoted over WhatsApp. Customers can
now ask for it from /microcemento/cotizar, so it becomes `requestable`. The
name stays: what is asked for is the application, not the product.

Like painting and tiles, a request has no list of things: what to cover goes
in service_requests.details. No new columns.

Run this before deploying the main API and backoffice-api.

Revision ID: 043
Revises: 042
Create Date: 2026-10-29
"""
from alembic import op

revision = '043'
down_revision = '042'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE lu_service_types SET requestable = 1 WHERE code = 'microcement'")


def downgrade():
    op.execute("UPDATE lu_service_types SET requestable = 0 WHERE code = 'microcement'")
