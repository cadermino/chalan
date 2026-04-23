"""remove confirmed order status and re-align IDs

Revision ID: 007
Revises: 006
Create Date: 2026-04-23

Result: 1=pending, 2=in_progress, 3=completed, 4=cancelled
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    # Shift orders that reference statuses 3,4,5 down by one
    # 3 (in_progress) -> 2, 4 (completed) -> 3, 5 (cancelled) -> 4
    # Process from lowest to highest to avoid FK conflicts
    op.execute("UPDATE orders SET order_status_id = 2 WHERE order_status_id = 3")
    op.execute("UPDATE orders SET order_status_id = 3 WHERE order_status_id = 4")
    op.execute("UPDATE orders SET order_status_id = 4 WHERE order_status_id = 5")

    # Now update lu_order_status to match
    op.execute("UPDATE lu_order_status SET status = 'in_progress' WHERE id = 2")
    op.execute("DELETE FROM lu_order_status WHERE id = 3")
    op.execute("UPDATE lu_order_status SET id = 3, status = 'completed' WHERE id = 4")
    op.execute("UPDATE lu_order_status SET id = 4, status = 'cancelled' WHERE id = 5")


def downgrade():
    # Re-insert confirmed and shift back
    op.execute("UPDATE lu_order_status SET id = 5, status = 'cancelled' WHERE id = 4")
    op.execute("UPDATE lu_order_status SET id = 4, status = 'completed' WHERE id = 3")
    op.execute("INSERT INTO lu_order_status (id, status) VALUES (3, 'in_progress')")
    op.execute("UPDATE lu_order_status SET status = 'confirmed' WHERE id = 2")

    op.execute("UPDATE orders SET order_status_id = 5 WHERE order_status_id = 4")
    op.execute("UPDATE orders SET order_status_id = 4 WHERE order_status_id = 3")
    op.execute("UPDATE orders SET order_status_id = 3 WHERE order_status_id = 2 AND order_status_id != 1")
