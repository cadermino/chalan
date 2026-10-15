"""Add vehicles.cargo_cover: how the load actually travels.

Migration 023 took the body type (carrocería) from the SUNARP card and the
quotation card told customers "Furgón (carga cerrada)". The first vehicle
filled in proved that wrong: registered as a furgón, it now has open
slatted sides and no roof. The card says what the vehicle was registered
as, not what it is today, and rebodied trucks are common.

What a customer needs is whether their furniture can get rained on, so
this is set from photos of the truck, not from the card:

- `cerrada`: rigid box with roof and doors.
- `toldo`: tarp over the sides; half protected.
- `abierta`: slatted sides or flatbed, no roof.

Values are validated by backoffice-api. `body_type` stays as the card's
value for checking against SUNARP and is no longer shown to customers.
No cold chain value: Chalán moves furniture, an insulated van is `cerrada`.

Run this before deploying the main API and backoffice-api, which read the
new column.

Revision ID: 024
Revises: 023
Create Date: 2026-10-15
"""
from alembic import op

revision = '024'
down_revision = '023'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cargo_cover VARCHAR(10)")


def downgrade():
    op.execute("ALTER TABLE vehicles DROP COLUMN IF EXISTS cargo_cover")
