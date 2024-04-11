"""empty message

Revision ID: 24be01e6f27a
Revises: ecb0efa87e8a
Create Date: 2024-04-11 20:26:30.696263

"""
from alembic import op
from sqlalchemy.sql import table, column
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '24be01e6f27a'
down_revision = 'ecb0efa87e8a'
branch_labels = None
depends_on = None


def upgrade():
    lu_services_table = table('lu_services',
        column('service', sa.String),
        column('description', sa.String)
    )
    op.bulk_insert(
        lu_services_table,
        [
            {
                "service": "cargo",
                "description": "Cargo service required by customers",
            },
        ],
    )


def downgrade():
    op.execute('DELETE FROM lu_services WHERE lu_services.service = "cargo"')
