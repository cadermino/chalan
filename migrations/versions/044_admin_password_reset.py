"""Password reset for the backoffice.

The backoffice had no "forgot my password": carriers who forgot theirs were
stuck at the login (and only a superadmin could set one, then knew it). The
reset link is signed and single-use by itself (it carries a fingerprint of the
current password), so no token table is needed. This column only limits the
reset emails to one every 2 minutes per user.

Run this before deploying the backoffice-api.

Revision ID: 044
Revises: 043
Create Date: 2026-11-02
"""
from alembic import op

revision = '044'
down_revision = '043'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMP NULL')


def downgrade():
    op.execute('ALTER TABLE admin_users DROP COLUMN IF EXISTS password_reset_requested_at')
