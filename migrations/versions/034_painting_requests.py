"""Open painting to the request form.

`painting` has been in the catalog since 027, so admins could tick it for a
company, and its landing quoted over WhatsApp. Customers can now ask for it
from /pintura/cotizar, so it becomes `requestable`.

A painting request has no list of things: what to paint goes in
service_requests.details (a description and a few optional answers), or in a
video where the customer explains it. No new columns.

Run this before deploying the main API and backoffice-api.

Revision ID: 034
Revises: 033
Create Date: 2026-10-22
"""
from alembic import op

revision = '034'
down_revision = '033'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE lu_service_types SET requestable = 1 WHERE code = 'painting'")


def downgrade():
    op.execute("UPDATE lu_service_types SET requestable = 0 WHERE code = 'painting'")
