"""Documents a carrier uploads to be validated: ID, driver's license, vehicle card.

Carriers who register from the landing used to be asked for these over
WhatsApp. They now upload them straight to S3 with a signed link
(`app/api/carrier_documents.py`). `doc_type` is `identity` (DNI or CE),
`driver_license` or `vehicle_card` (tarjeta de identificación vehicular); a
vehicle card points to the vehicle it belongs to, so the backoffice shows it
next to the card fields of that vehicle. The files are private: the backoffice
reads them through short-lived signed URLs: the bucket policy only makes
`orders/` and `service-requests/` public.

Revision ID: 031
Revises: 030
Create Date: 2026-10-22
"""
from alembic import op

revision = '031'
down_revision = '030'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS carrier_documents (
            id SERIAL PRIMARY KEY,
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id) ON DELETE CASCADE,
            vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
            doc_type VARCHAR(20) NOT NULL,
            storage_key VARCHAR(300) NOT NULL UNIQUE,
            content_type VARCHAR(60),
            size_bytes INTEGER,
            created_date TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_carrier_documents_company ON carrier_documents (carrier_company_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS carrier_documents")
