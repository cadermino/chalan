"""What each service request payment is.

026 only knew the reservation the customer yapes to Chalán. The rest, the
carrier's price, is paid in cash on the day of the service and left no trace,
so the backoffice could not tell a job in progress from a finished one.

- `concept`: `reservation` (customer to Chalán, Yape; every row so far) or
  `carrier_cash` (customer to the carrier on site). An admin records the cash
  one once the job is done, and that is what marks the request as completed.

Run this before deploying the main API and backoffice-api.

Revision ID: 032
Revises: 031
Create Date: 2026-10-22
"""
from alembic import op

revision = '032'
down_revision = '031'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE service_request_payments "
               "ADD COLUMN IF NOT EXISTS concept VARCHAR(20) NOT NULL DEFAULT 'reservation'")


def downgrade():
    op.execute("ALTER TABLE service_request_payments DROP COLUMN IF EXISTS concept")
