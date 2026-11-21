"""Formal quotations (PDF with RUC) for company customers.

`formal_quotations`: one row per PDF issued, from the customer's step 3 or the
backoffice. `document` keeps everything printed, so downloading it again gives
the same PDF after the order changes. RUC and business name live here, not in
`customers`: the next one is prefilled from the customer's latest row.

Revision ID: 054
Revises: 053
Create Date: 2026-11-21
"""
from alembic import op

revision = '054'
down_revision = '053'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS formal_quotations (
            id SERIAL PRIMARY KEY,
            order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
            customer_id INTEGER NULL REFERENCES customers(id) ON DELETE SET NULL,
            ruc VARCHAR(11) NOT NULL,
            business_name VARCHAR(200) NOT NULL,
            contact_name VARCHAR(120) NULL,
            contact_email VARCHAR(255) NULL,
            prices_include_igv BOOLEAN NOT NULL DEFAULT FALSE,
            subtotal NUMERIC(10, 2) NOT NULL,
            igv NUMERIC(10, 2) NOT NULL,
            total NUMERIC(10, 2) NOT NULL,
            valid_until DATE NOT NULL,
            document JSON NOT NULL,
            created_by_admin_id INTEGER NULL,
            created_date TIMESTAMP NOT NULL DEFAULT now()
        )
    """)
    op.execute('CREATE INDEX IF NOT EXISTS ix_formal_quotations_order_id ON formal_quotations (order_id)')
    op.execute('CREATE INDEX IF NOT EXISTS ix_formal_quotations_customer_id ON formal_quotations (customer_id)')
    op.execute('ALTER TABLE formal_quotations ENABLE ROW LEVEL SECURITY')


def downgrade():
    op.execute('DROP TABLE IF EXISTS formal_quotations')
