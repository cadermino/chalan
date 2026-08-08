"""Widen customers.email and customers.name — VARCHAR(45) was too short
for real emails/names and caused unhandled 500s on registration
(StringDataRightTruncation, not caught by the duplicate-email check).

Revision ID: 013
Revises: 012
Create Date: 2026-08-08
"""
from alembic import op

revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE customers ALTER COLUMN email TYPE VARCHAR(255)")
    op.execute("ALTER TABLE customers ALTER COLUMN name TYPE VARCHAR(255)")


def downgrade():
    op.execute("ALTER TABLE customers ALTER COLUMN name TYPE VARCHAR(45)")
    op.execute("ALTER TABLE customers ALTER COLUMN email TYPE VARCHAR(45)")
