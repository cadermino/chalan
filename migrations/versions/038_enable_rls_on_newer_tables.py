"""Enable row level security on the tables created since migration 018.

Production runs on Supabase, which exposes the `public` schema through its
Data API (PostgREST) to the `anon` and `authenticated` roles. Row level
security was turned on by hand for every table that existed back then, but
not for the ones the later migrations created, and Supabase's linter flags
each of them (`rls_disabled_in_public`): with the project's anon key, anyone
could read and write service requests, payments, carrier documents...

RLS without policies closes the Data API and changes nothing for the apps:
both connect as `postgres`, which owns the tables, and an owner is not subject
to RLS (no FORCE). The tables created before 018 already work that way. Locally
no table has RLS and this makes no difference either.

Every new table has to enable it in its own migration.

Revision ID: 038
Revises: 037
Create Date: 2026-10-27
"""
from alembic import op

revision = '038'
down_revision = '037'
branch_labels = None
depends_on = None

TABLES = [
    'service_requests',
    'service_request_items',
    'service_request_item_materials',
    'service_request_media',
    'service_request_notifications',
    'service_request_quotations',
    'service_request_payments',
    'service_request_carrier_declines',
    'order_carrier_declines',
    'order_videos',
    'lu_service_types',
    'lu_service_materials',
    'carrier_company_service_types',
    'carrier_company_departments',
    'carrier_documents',
]


def upgrade():
    for table in TABLES:
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')


def downgrade():
    for table in TABLES:
        op.execute(f'ALTER TABLE {table} DISABLE ROW LEVEL SECURITY')
