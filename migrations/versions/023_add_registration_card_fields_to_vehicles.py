"""Add the vehicle data printed on the SUNARP registration card.

Vehicles only had free-text `weight`, `width`, `height` and `length`, and
production shows they never meant one thing: `weight` holds "2", "2TN",
"2 ton", "3.4" and "3.7" (tons, sometimes the commercial capacity, sometimes
what looks like the gross weight), and the dimensions mix the cargo box
(3.18 m) with the whole vehicle (6.15 m) in CM, mt or no unit at all. The
manufacture year ended up inside `model`.

The new columns follow the "Datos del Vehículo" block of the Tarjeta de
Identificación Vehicular, so they are filled by copying the card:

- Weights in tons with three decimals, exactly as the card prints them
  (P. Bruto 3.490, P. Neto 2.390, Carga Útil 1.100). Asking for kg would get
  "1.100" typed by someone reading the card. Payload is the one that matters:
  it is what fits in the truck.
- Vehicle dimensions in meters (Longitud, Ancho, Altura) are the outside of
  the vehicle. The cargo box, which is what a move cares about, is not on the
  card; the carrier gives it, so it gets its own columns.
- Body type (carrocería) is a short code validated by backoffice-api
  (furgon, baranda, plataforma, ...): a closed van and an open truck are not
  the same move.
- Category (N1/N2/N3), serial number and registry entry (partida registral)
  are for checking the vehicle against SUNARP, not for customers.

Nothing is copied from the old columns: they cannot be read reliably, and
there are only a handful of active vehicles, to be filled from each carrier's
card. The old columns stay until then and are dropped in a later migration.

Run this before deploying the main API and backoffice-api, which read the
new columns.

Revision ID: 023
Revises: 022
Create Date: 2026-10-15
"""
from alembic import op

revision = '023'
down_revision = '022'
branch_labels = None
depends_on = None

COLUMNS = [
    ('category', 'VARCHAR(10)'),
    ('body_type', 'VARCHAR(20)'),
    ('manufacture_year', 'SMALLINT'),
    ('color', 'VARCHAR(30)'),
    ('passengers', 'SMALLINT'),
    ('serial_number', 'VARCHAR(30)'),
    ('registry_entry', 'VARCHAR(20)'),
    ('gross_weight_tons', 'NUMERIC(6,3)'),
    ('net_weight_tons', 'NUMERIC(6,3)'),
    ('payload_tons', 'NUMERIC(6,3)'),
    ('vehicle_length_m', 'NUMERIC(5,2)'),
    ('vehicle_width_m', 'NUMERIC(5,2)'),
    ('vehicle_height_m', 'NUMERIC(5,2)'),
    ('box_length_m', 'NUMERIC(5,2)'),
    ('box_width_m', 'NUMERIC(5,2)'),
    ('box_height_m', 'NUMERIC(5,2)'),
]


def upgrade():
    for name, sql_type in COLUMNS:
        op.execute(f"ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS {name} {sql_type}")


def downgrade():
    for name, _ in reversed(COLUMNS):
        op.execute(f"ALTER TABLE vehicles DROP COLUMN IF EXISTS {name}")
