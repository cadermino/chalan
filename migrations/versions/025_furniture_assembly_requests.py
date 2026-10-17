"""Open furniture assembly to the request form.

`furniture_assembly` has been in the catalog since 022, as something a company
does. Now a customer can ask for it from /armado/cotizar, so it becomes
`requestable`.

Each item of an assembly request says what to do with that piece of
furniture, and whether to pack it too, so two columns join
service_request_items (NULL for packing requests, which have neither):

- `work`: `assemble`, `disassemble` or `both` (take it apart here and put it
  together at the destination). Validated by the main API.
- `pack`: the assembler also packs it. Its materials come from the packing
  catalog, through the same service_request_item_materials table.

The destination address of a `both` item lives in service_requests.details,
the column meant for what is specific to one service.

Run this before deploying the main API and backoffice-api, which read the
new columns.

Revision ID: 025
Revises: 024
Create Date: 2026-10-16
"""
from alembic import op

revision = '025'
down_revision = '024'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE service_request_items ADD COLUMN IF NOT EXISTS work VARCHAR(20)")
    op.execute("ALTER TABLE service_request_items ADD COLUMN IF NOT EXISTS pack BOOLEAN")
    op.execute("UPDATE lu_service_types SET requestable = 1 WHERE code = 'furniture_assembly'")


def downgrade():
    op.execute("UPDATE lu_service_types SET requestable = 0 WHERE code = 'furniture_assembly'")
    op.execute("ALTER TABLE service_request_items DROP COLUMN IF EXISTS pack")
    op.execute("ALTER TABLE service_request_items DROP COLUMN IF EXISTS work")
