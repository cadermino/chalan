"""Reviews of service requests, in the same `reviews` table as moves.

A service request has no customer account and no order, so a review of one
has neither: `order_id` and `customer_id` become nullable and the review
points to `service_request_id` instead (one review per request). Keeping one
table means a company's rating on its public page and on the move quotation
cards counts its services too. A check keeps every row tied to one or the
other.

Revision ID: 042
Revises: 041
Create Date: 2026-10-29
"""
from alembic import op

revision = '042'
down_revision = '041'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE reviews ALTER COLUMN order_id DROP NOT NULL')
    op.execute('ALTER TABLE reviews ALTER COLUMN customer_id DROP NOT NULL')
    op.execute('ALTER TABLE reviews ADD COLUMN IF NOT EXISTS service_request_id INTEGER '
               'REFERENCES service_requests(id) ON DELETE CASCADE')
    op.execute('CREATE UNIQUE INDEX IF NOT EXISTS ux_reviews_service_request_id '
               'ON reviews (service_request_id) WHERE service_request_id IS NOT NULL')
    op.execute('ALTER TABLE reviews DROP CONSTRAINT IF EXISTS ck_reviews_order_or_service_request')
    op.execute('ALTER TABLE reviews ADD CONSTRAINT ck_reviews_order_or_service_request '
               'CHECK (order_id IS NOT NULL OR service_request_id IS NOT NULL)')


def downgrade():
    op.execute('ALTER TABLE reviews DROP CONSTRAINT IF EXISTS ck_reviews_order_or_service_request')
    op.execute('DELETE FROM reviews WHERE service_request_id IS NOT NULL')
    op.execute('DROP INDEX IF EXISTS ux_reviews_service_request_id')
    op.execute('ALTER TABLE reviews DROP COLUMN IF EXISTS service_request_id')
    op.execute('ALTER TABLE reviews ALTER COLUMN customer_id SET NOT NULL')
    op.execute('ALTER TABLE reviews ALTER COLUMN order_id SET NOT NULL')
