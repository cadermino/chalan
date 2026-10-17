"""Yape reservations for service requests.

When a packing or assembly customer picks a quotation on their page, they
yape Chalán's share (total minus the carrier's price) and report the
operation number, the same as a move. Yape personal has no webhook, so an
admin checks it in the backoffice: until then the carrier is not told.

One row per reservation, in its own table rather than `payments`: there
`quotation_id` points to the moving `quotations` table and every report
assumes the row belongs to an order. The carrier's share is paid on site
and has no row (service requests have no completion flow yet).

- `status`: `pending` (customer reported the number), `paid` (an admin found
  the yapeo) or `cancelled` (not found, or the selection changed).
- `reference`: the operation number. A live one cannot be reused by another
  request or order; the main API checks both tables.

Run this before deploying the main API and backoffice-api.

Revision ID: 026
Revises: 025
Create Date: 2026-10-16
"""
from alembic import op

revision = '026'
down_revision = '025'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS service_request_payments (
            id SERIAL PRIMARY KEY,
            service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
            service_request_quotation_id INTEGER NOT NULL
                REFERENCES service_request_quotations(id) ON DELETE CASCADE,
            amount NUMERIC(10, 2) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            reference VARCHAR(100),
            paid_at TIMESTAMP,
            confirmed_by_admin_id INTEGER,
            created_date TIMESTAMP DEFAULT now(),
            updated_date TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_service_request_payments_request "
               "ON service_request_payments (service_request_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_service_request_payments_reference "
               "ON service_request_payments (reference)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS service_request_payments")
