"""Open tile installation (porcelanato y cerámica) to the request form.

`masonry` has been in the catalog since 027, named "Albañilería", so admins
could tick it for a company, and its landing (/instalacion-de-porcelanato)
quoted over WhatsApp. Customers can now ask for it from /porcelanato/cotizar,
so it becomes `requestable`, and it takes the name customers see in the form,
the emails and their quotations page: what is asked for is porcelain and
ceramic tiles, not masonry work in general. The code stays, so the companies
that already have it ticked keep it.

Like painting, a request has no list of things: what to install goes in
service_requests.details. No new columns.

Run this before deploying the main API and backoffice-api.

Revision ID: 039
Revises: 038
Create Date: 2026-10-28
"""
from alembic import op

revision = '039'
down_revision = '038'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "UPDATE lu_service_types SET requestable = 1, name = 'Instalación de porcelanato y cerámica' "
        "WHERE code = 'masonry'"
    )


def downgrade():
    op.execute("UPDATE lu_service_types SET requestable = 0, name = 'Albañilería' WHERE code = 'masonry'")
