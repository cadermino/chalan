"""A carrier's note on a moving quotation.

The price alone did not say what it covers: "voy con 2 cargadores", "se hace
en 2 viajes". The carrier writes it with the price on the quotation link and
the customer reads it next to that quotation. Optional, up to 500 characters,
like `service_request_quotations.note`.

Revision ID: 036
Revises: 035
Create Date: 2026-10-23
"""
from alembic import op

revision = '036'
down_revision = '035'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE quotations ADD COLUMN IF NOT EXISTS note VARCHAR(500)")


def downgrade():
    op.execute("ALTER TABLE quotations DROP COLUMN IF EXISTS note")
