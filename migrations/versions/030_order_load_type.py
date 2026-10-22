"""What an order carries, and how much a cargo weighs.

A quarter of the orders that came in through the moving form were not moves:
200 sacks of rice, cement and bricks, 13.6 t of geomembrane, a pickup truck.
`load_type` is `moving`, `items`, `cargo` or `vehicle`; `cargo_weight_kg` is the
top of the weight range the customer picked, asked only for `cargo`. Orders
created before this have both empty and read as a move.

Revision ID: 030
Revises: 029
Create Date: 2026-10-22
"""
from alembic import op

revision = '030'
down_revision = '029'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS load_type VARCHAR(20)")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cargo_weight_kg INTEGER")


def downgrade():
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS cargo_weight_kg")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS load_type")
