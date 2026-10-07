"""Add carrier declines: a carrier saying "I can't do this one", with a reason.

Until now a carrier who could not take an order or a service request simply
never answered, and Chalán could not tell "didn't see it" from "can't do it".
Now the link (and the backoffice, for orders) has a decline button that
records why.

Why tables of their own and not a "declined" status in `quotations`:
`quotations.amount` is NOT NULL, and every query that reads quotations treats a
non-cancelled row as a real offer (the customer's list, the carrier's
`has_quotation`, the admin counts). A declined row there would show up as a
S/ 0 offer somewhere. These tables are read by nothing that existed before.

Two tables, one per parent, for the same reason service requests have their own
quotations table: orders and service requests are kept apart on purpose.

Notes on the shape:
- One row per carrier per order/request. Declining again updates the reason;
  undoing, or quoting afterwards, deletes the row.
- `reason` is a short code (date_unavailable, zone, vehicle, budget, other); the
  main API validates it, the schema does not, so adding one is not a migration.

Uniqueness is a named unique index and the tables are created with IF NOT
EXISTS, as in 018 and 019: backoffice-api runs db.create_all() on startup and
may create them first, without the index. Run this before deploying
backoffice-api.

Revision ID: 020
Revises: 019
Create Date: 2026-10-07
"""
from alembic import op

revision = '020'
down_revision = '019'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS order_carrier_declines (
            id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id),
            reason VARCHAR(30) NOT NULL,
            note VARCHAR(500),
            created_date TIMESTAMP DEFAULT now(),
            updated_date TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_order_carrier_declines_order_carrier
        ON order_carrier_declines(order_id, carrier_company_id)
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS service_request_carrier_declines (
            id SERIAL PRIMARY KEY,
            service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id),
            reason VARCHAR(30) NOT NULL,
            note VARCHAR(500),
            created_date TIMESTAMP DEFAULT now(),
            updated_date TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_service_request_carrier_declines_request_carrier
        ON service_request_carrier_declines(service_request_id, carrier_company_id)
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS service_request_carrier_declines")
    op.execute("DROP TABLE IF EXISTS order_carrier_declines")
