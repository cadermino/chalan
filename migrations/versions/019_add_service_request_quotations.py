"""Add service_request_quotations: the prices carriers send for a service request.

Until now a carrier opened the carrier view of a packing request and sent their
price over WhatsApp to Chalán, who had to retype it. This table stores that price
instead, so the admin can compare them in the backoffice and pick one.

Why a table of its own and not `quotations`: `quotations.order_id` is mandatory and
points to `orders`, and service requests were kept apart from orders on purpose.

Notes on the shape:
- `amount` is the carrier's price exactly as typed; the platform fee is never
  written into it (same rule as `quotations.amount`). It is NUMERIC(10,2) because
  packing is priced in soles and cents, unlike the integer amount of a move.
- `platform_fee_rate` and `total_amount` are only filled when the admin picks the
  quotation, and freeze what was agreed with the customer: if PLATFORM_FEE changes
  later, an accepted price must not move. Before that the total is computed on
  the fly.
- At most one `selected` per request; the selection logic enforces it inside a
  transaction that locks the request, not the schema.
- One quotation per carrier per request: quoting again updates the same row.

Uniqueness is a named unique index, not an inline UNIQUE, and the table is created
with IF NOT EXISTS: backoffice-api runs db.create_all() on startup, so if it
restarts with the new mirror model before this migration runs it creates the table
itself, without the index (see the docstring of 018). Run this before deploying
backoffice-api.

Revision ID: 019
Revises: 018
Create Date: 2026-10-06
"""
from alembic import op

revision = '019'
down_revision = '018'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS service_request_quotations (
            id SERIAL PRIMARY KEY,
            service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id),
            amount NUMERIC(10,2) NOT NULL,
            note VARCHAR(500),
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            platform_fee_rate NUMERIC(6,4),
            total_amount NUMERIC(10,2),
            selected_at TIMESTAMP,
            selected_by_admin_id INTEGER,
            created_date TIMESTAMP DEFAULT now(),
            updated_date TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_service_request_quotations_request_carrier
        ON service_request_quotations(service_request_id, carrier_company_id)
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS service_request_quotations")
