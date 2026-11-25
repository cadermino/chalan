"""What the carrier's own rates gave when it quoted, as the quotation link showed it.

`quotations.rates_estimate`: the price "Con tus tarifas" the link showed above the
price field when the carrier sent this quotation (computed by the API, never
taken from the browser), NULL when the link showed none. `rates_estimate_used`:
whether it tapped "Usar S/ N" to put it in the field (NULL when none was shown).
Both are rewritten on every re-quote. To measure whether showing the price
moves what carriers quote and how often they are chosen.

Revision ID: 056
Revises: 055
Create Date: 2026-11-24
"""
from alembic import op

revision = '056'
down_revision = '055'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE quotations ADD COLUMN IF NOT EXISTS rates_estimate INTEGER")
    op.execute("ALTER TABLE quotations ADD COLUMN IF NOT EXISTS rates_estimate_used BOOLEAN")


def downgrade():
    op.execute("ALTER TABLE quotations DROP COLUMN IF EXISTS rates_estimate_used")
    op.execute("ALTER TABLE quotations DROP COLUMN IF EXISTS rates_estimate")
