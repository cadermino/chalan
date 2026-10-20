"""Coordinates of the addresses of an order.

The order form already gets the place from Google, but it only kept the street,
postal code, country and map link, so an order could not be placed on a map
without parsing its address. `latitude` and `longitude` join the `city` and
`state` columns that already existed on `order_details` and were never filled.
Orders created before this have all four empty.

Revision ID: 029
Revises: 028
Create Date: 2026-10-20
"""
from alembic import op

revision = '029'
down_revision = '028'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE order_details ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION")
    op.execute("ALTER TABLE order_details ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION")


def downgrade():
    op.execute("ALTER TABLE order_details DROP COLUMN IF EXISTS longitude")
    op.execute("ALTER TABLE order_details DROP COLUMN IF EXISTS latitude")
