"""Service requests take the same statuses as orders.

`status` was draft | submitted | cancelled: it said whether the form was
finished, not how the job was going, so the backoffice could not filter the
ones in progress or done. It is now pending | in_progress | completed |
cancelled, as text, like lu_order_status:

- draft and submitted become pending. A draft is a pending one without
  `submitted_at` (the column was already set exactly on submit).
- in_progress: the selected quotation has its reservation paid, or the
  customer chose it without a reservation.
- completed: an admin recorded the carrier cash (032).

From here on the main API keeps it in step (`sync_status`).

Run this before deploying the main API, backoffice-api and services-web.

Revision ID: 033
Revises: 032
Create Date: 2026-10-22
"""
from alembic import op

revision = '033'
down_revision = '032'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE service_requests SET status = 'pending' WHERE status IN ('draft', 'submitted')")
    op.execute("""
        UPDATE service_requests r SET status = 'in_progress'
        FROM service_request_quotations q
        WHERE q.service_request_id = r.id AND q.status = 'selected' AND r.status = 'pending'
          AND (
            EXISTS (SELECT 1 FROM service_request_payments p
                    WHERE p.service_request_quotation_id = q.id AND p.concept = 'reservation'
                      AND p.status = 'paid')
            OR (q.selected_by_admin_id IS NULL
                AND NOT EXISTS (SELECT 1 FROM service_request_payments p
                                WHERE p.service_request_quotation_id = q.id AND p.concept = 'reservation'
                                  AND p.status <> 'cancelled'))
          )
    """)
    op.execute("""
        UPDATE service_requests r SET status = 'completed'
        FROM service_request_quotations q
        WHERE q.service_request_id = r.id AND q.status = 'selected' AND r.status <> 'cancelled'
          AND EXISTS (SELECT 1 FROM service_request_payments p
                      WHERE p.service_request_quotation_id = q.id AND p.concept = 'carrier_cash'
                        AND p.status = 'paid')
    """)
    op.execute("ALTER TABLE service_requests ALTER COLUMN status SET DEFAULT 'pending'")


def downgrade():
    op.execute("""
        UPDATE service_requests SET status = CASE WHEN submitted_at IS NULL THEN 'draft' ELSE 'submitted' END
        WHERE status IN ('pending', 'in_progress', 'completed')
    """)
    op.execute("ALTER TABLE service_requests ALTER COLUMN status SET DEFAULT 'draft'")
