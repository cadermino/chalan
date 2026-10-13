"""Make moving a service type, and add furniture assembly.

Until now moving was implicit: every active carrier with a country got every
new order, and `lu_service_types` only listed what is asked for outside a move
(packing). With packing-only teams and furniture assemblers joining, "does
moves" has to be something a company can have or not, configured in the same
place as the rest of what it does.

- `moving` joins the catalog. Moving orders keep their own flow (`orders`,
  quotations, payments); only the capability moves here. New-order
  notifications go to companies that have it.
- `furniture_assembly` (armado y desarmado de muebles) joins too, so a company
  can be marked as an assembler before its request form exists. Its code is not
  `assembly` on purpose: `lu_services` already has `assembly`/`disassembly` as
  extras of a moving order, a different thing.
- `requestable` says which types can be asked for through a request form
  (services-web and the backoffice "new request" screen). Only packing for now.
  Moving never is; assembly will be when its form ships. The main API also
  requires the code to be in SERVICE_TYPES, which validates its details.
- Every existing company gets `moving`, so nothing changes for anyone on
  deploy: today all of them receive moves. Packing-only or assembly-only
  companies are unchecked afterwards from the backoffice.

Run this before deploying the main API and backoffice-api, which read the
new column.

Revision ID: 022
Revises: 021
Create Date: 2026-10-13
"""
from alembic import op

revision = '022'
down_revision = '021'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE lu_service_types
        ADD COLUMN IF NOT EXISTS requestable SMALLINT NOT NULL DEFAULT 0
    """)
    op.execute("UPDATE lu_service_types SET requestable = 1 WHERE code = 'packing'")
    op.execute("""
        INSERT INTO lu_service_types (code, name, requestable) VALUES
            ('moving', 'Mudanzas y fletes', 0),
            ('furniture_assembly', 'Armado y desarmado de muebles', 0)
        ON CONFLICT (code) DO NOTHING
    """)
    op.execute("""
        INSERT INTO carrier_company_service_types (carrier_company_id, service_type_id)
        SELECT c.id, st.id
        FROM carrier_company c
        JOIN lu_service_types st ON st.code = 'moving'
        ON CONFLICT DO NOTHING
    """)


def downgrade():
    op.execute("""
        DELETE FROM carrier_company_service_types
        WHERE service_type_id IN (
            SELECT id FROM lu_service_types WHERE code IN ('moving', 'furniture_assembly')
        )
    """)
    op.execute("DELETE FROM lu_service_types WHERE code IN ('moving', 'furniture_assembly')")
    op.execute("ALTER TABLE lu_service_types DROP COLUMN IF EXISTS requestable")
