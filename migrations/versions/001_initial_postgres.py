"""Initial PostgreSQL schema - baseline migration

This migration represents the initial PostgreSQL schema.
All tables are created via init.sql, this serves as a baseline
for future migrations.

Revision ID: 001_initial_postgres
Revises: 
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_initial_postgres'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Schema is created by init.sql
    # This migration serves as a baseline for tracking future changes
    pass


def downgrade():
    # Cannot downgrade initial schema
    pass
