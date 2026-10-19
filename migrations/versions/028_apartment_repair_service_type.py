"""Apartment repair in the services catalog.

Chalán offers a whole-apartment repair service for landlords between tenants
(painting, plumbing, electrical, melamine, floors, cleaning), sold from
/reparacion-de-departamentos and quoted after a free technical visit. It
joins `lu_service_types` so admins can tick it for the companies that do it.

Not `requestable`: there is no request form for it, and the main API would
reject it anyway (it is not in SERVICE_TYPES).

Revision ID: 028
Revises: 027
Create Date: 2026-10-19
"""
from alembic import op

revision = '028'
down_revision = '027'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        INSERT INTO lu_service_types (code, name, requestable) VALUES
            ('apartment_repair', 'Reparación de departamentos', 0)
        ON CONFLICT (code) DO NOTHING
    """)


def downgrade():
    op.execute("""
        DELETE FROM carrier_company_service_types
        WHERE service_type_id IN (SELECT id FROM lu_service_types WHERE code = 'apartment_repair')
    """)
    op.execute("DELETE FROM lu_service_types WHERE code = 'apartment_repair'")
