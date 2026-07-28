"""Add platform_rating and platform_comment to reviews

Revision ID: 012
Revises: 011
Create Date: 2026-07-30
"""
from alembic import op

revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE reviews
        ADD COLUMN IF NOT EXISTS platform_rating INTEGER
    """)
    op.execute("""
        ALTER TABLE reviews
        ADD COLUMN IF NOT EXISTS platform_comment VARCHAR(1000)
    """)
    op.execute("""
        ALTER TABLE reviews
        ADD CONSTRAINT ck_review_platform_rating
        CHECK (platform_rating IS NULL OR (platform_rating >= 1 AND platform_rating <= 5))
    """)


def downgrade():
    op.execute("ALTER TABLE reviews DROP CONSTRAINT IF EXISTS ck_review_platform_rating")
    op.execute("ALTER TABLE reviews DROP COLUMN IF EXISTS platform_comment")
    op.execute("ALTER TABLE reviews DROP COLUMN IF EXISTS platform_rating")
