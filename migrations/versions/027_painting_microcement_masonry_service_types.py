"""Painting, microcement and masonry in the services catalog.

Chalán starts offering three more at-home services, sold from their own
landings (/pintores-a-domicilio, /microcemento, /instalacion-de-porcelanato)
and quoted over WhatsApp for now. They join `lu_service_types` so admins can
tick them for the companies that do them, the same as furniture assembly
before it had a form.

None is `requestable`: there is no request form for them yet, and the main
API would reject them anyway (they are not in SERVICE_TYPES). Microcement
means applying it, not selling the product.

Revision ID: 027
Revises: 026
Create Date: 2026-10-16
"""
from alembic import op

revision = '027'
down_revision = '026'
branch_labels = None
depends_on = None

CODES = ('painting', 'microcement', 'masonry')


def upgrade():
    op.execute("""
        INSERT INTO lu_service_types (code, name, requestable) VALUES
            ('painting', 'Pintura', 0),
            ('microcement', 'Aplicación de microcemento', 0),
            ('masonry', 'Albañilería', 0)
        ON CONFLICT (code) DO NOTHING
    """)


def downgrade():
    codes = ', '.join(f"'{c}'" for c in CODES)
    op.execute(f"""
        DELETE FROM carrier_company_service_types
        WHERE service_type_id IN (SELECT id FROM lu_service_types WHERE code IN ({codes}))
    """)
    op.execute(f"DELETE FROM lu_service_types WHERE code IN ({codes})")
