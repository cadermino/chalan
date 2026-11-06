"""What each carrier charges, and the days it cannot work.

The first step toward quoting a move for a carrier that has not answered in 20
minutes. Both tables are per company for now (`vehicle_id` NULL); per vehicle
comes later as more rows in the same tables, so nothing has to move then.

- `carrier_rates`: one row per company. In Lima the price of a move follows
  what is carried, not the distance (367 quotations from production, November
  2026), so a move is priced as a base plus a price per m³, per loader and per
  floor without elevator; outside Lima the km are added. Amounts in soles, as
  numeric. `moves_per_day` says how many moves the company can do the same day,
  and `max_m3` / `max_km` how far a quote made for it may go. `auto_quote` is
  the company's consent to be quoted for, with who gave it and when.
- `carrier_availability`: available by default. A row with `weekday` (0 is
  Monday) blocks that day every week; a row with `day` overrides the week for
  that date, and with `blocked` NULL it opens a day the week blocks. `blocked`
  is the part of the day that is not available: `day`, `am` or `pm`. Days with a
  confirmed move are not stored here: they are read from the orders.

Revision ID: 047
Revises: 046
Create Date: 2026-11-06
"""
from alembic import op

revision = '047'
down_revision = '046'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS carrier_rates (
            id SERIAL PRIMARY KEY,
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id) ON DELETE CASCADE,
            vehicle_id INTEGER NULL REFERENCES vehicles(id) ON DELETE CASCADE,
            base_fee NUMERIC(10, 2) NULL,
            per_m3 NUMERIC(10, 2) NULL,
            per_loader NUMERIC(10, 2) NULL,
            per_floor NUMERIC(10, 2) NULL,
            minimum_fare NUMERIC(10, 2) NULL,
            per_km_outside_lima NUMERIC(10, 2) NULL,
            weekend_surcharge_percent NUMERIC(5, 2) NULL,
            max_m3 NUMERIC(6, 2) NULL,
            max_km INTEGER NULL,
            moves_per_day SMALLINT NOT NULL DEFAULT 1,
            auto_quote BOOLEAN NOT NULL DEFAULT false,
            auto_quote_authorized_at TIMESTAMP NULL,
            auto_quote_authorized_by INTEGER NULL REFERENCES admin_users(id) ON DELETE SET NULL,
            created_date TIMESTAMP DEFAULT now(),
            updated_date TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS carrier_rates_company_uq
        ON carrier_rates (carrier_company_id) WHERE vehicle_id IS NULL
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS carrier_rates_vehicle_uq
        ON carrier_rates (carrier_company_id, vehicle_id) WHERE vehicle_id IS NOT NULL
    """)
    op.execute('ALTER TABLE carrier_rates ENABLE ROW LEVEL SECURITY')

    op.execute("""
        CREATE TABLE IF NOT EXISTS carrier_availability (
            id SERIAL PRIMARY KEY,
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id) ON DELETE CASCADE,
            vehicle_id INTEGER NULL REFERENCES vehicles(id) ON DELETE CASCADE,
            weekday SMALLINT NULL CHECK (weekday BETWEEN 0 AND 6),
            day DATE NULL,
            blocked VARCHAR(3) NULL CHECK (blocked IN ('day', 'am', 'pm')),
            source VARCHAR(10) NOT NULL DEFAULT 'carrier',
            created_by INTEGER NULL REFERENCES admin_users(id) ON DELETE SET NULL,
            created_date TIMESTAMP DEFAULT now(),
            CHECK ((weekday IS NULL) <> (day IS NULL)),
            CHECK (weekday IS NULL OR blocked IS NOT NULL)
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS carrier_availability_weekday_uq
        ON carrier_availability (carrier_company_id, weekday)
        WHERE weekday IS NOT NULL AND vehicle_id IS NULL
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS carrier_availability_day_uq
        ON carrier_availability (carrier_company_id, day)
        WHERE day IS NOT NULL AND vehicle_id IS NULL
    """)
    op.execute('ALTER TABLE carrier_availability ENABLE ROW LEVEL SECURITY')


def downgrade():
    op.execute('DROP TABLE IF EXISTS carrier_availability')
    op.execute('DROP TABLE IF EXISTS carrier_rates')
