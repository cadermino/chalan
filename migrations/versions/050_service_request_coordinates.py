"""Where a service request is, as coordinates.

Companies quoting a service see the street without the door number and an
approximate area on a map (a circle whose center is moved a fixed distance from
the house, like Airbnb), until the customer picks them. That needs the point:
service_requests only had Google's place link (`?cid=…`), which carries no
coordinates. The customer form now saves Google's location of the place, and
an admin's pasted map link gives them when it has them. A furniture assembly
destination keeps its own inside details.destination (JSON). Requests from
before stay without them, and without a map.

Revision ID: 050
Revises: 049
Create Date: 2026-11-14
"""
from alembic import op

revision = '050'
down_revision = '049'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION')
    op.execute('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION')


def downgrade():
    op.execute('ALTER TABLE service_requests DROP COLUMN IF EXISTS longitude')
    op.execute('ALTER TABLE service_requests DROP COLUMN IF EXISTS latitude')
