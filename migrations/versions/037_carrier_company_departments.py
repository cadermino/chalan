"""Where each carrier company works, by department.

Every carrier on the platform is in Lima, and every new order goes to all of
them. Once companies from other cities join (Arequipa, Trujillo), an order
should only reach the ones that work where it is. This table records that,
one row per company and department, like `carrier_company_service_types`.

- `department_code` is the two-digit ubigeo code, the same one the postal code
  starts with and that `locate()` (backoffice-api `carrier_prospects.py`)
  reads from an order's address. Lima and Callao are one market and are
  stored as Lima (`15`); `07` is never written.
- Every existing company gets Lima: today all of them are there.
- Nothing reads it to route orders yet; the backoffice shows and filters it.

Revision ID: 037
Revises: 036
Create Date: 2026-10-23
"""
from alembic import op

revision = '037'
down_revision = '036'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS carrier_company_departments (
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id) ON DELETE CASCADE,
            department_code VARCHAR(2) NOT NULL,
            created_date TIMESTAMP DEFAULT now(),
            PRIMARY KEY (carrier_company_id, department_code)
        )
    """)
    op.execute("""
        INSERT INTO carrier_company_departments (carrier_company_id, department_code)
        SELECT id, '15' FROM carrier_company
        ON CONFLICT DO NOTHING
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS carrier_company_departments")
