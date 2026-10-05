"""Add service requests: standalone requests for services that are not a move.

Packing used to be quoted by hand over WhatsApp: the admin collected the
details and forwarded them to the carriers one by one. A move is an `orders`
row with a two-address flow, prices and payments; a packing request has one
address, a list of things to pack and no price on the platform yet. Forcing it
into `orders` would have meant nullable columns everywhere and a status flow
that does not apply, so it gets its own tables, and they are generic on
purpose: `lu_service_types` is the catalog of services and `details` (JSON)
holds whatever is specific to one of them, so a second service is a new row
and a validator, not a migration.

Notes on the shape:
- `public_id` is the only id the browser ever sees. `orders` ids are
  sequential and that already opened a hole (see update_order); the form is
  public and anonymous, so it addresses a request by an unguessable id.
- `lu_service_materials` is a catalog (packing materials today). Items point to
  it through `service_request_item_materials` so adding a material is an
  INSERT; materials are deactivated, never deleted, because old requests
  reference them.
- `carrier_company_service_types` is a bridge table rather than a boolean on
  `carrier_company`: a new service does not need a new column, and the
  relation can later carry data of its own (covered districts, minimum price).
  It is not `lu_services`/`orders_services`: those are the extras of a move.
- `service_request_notifications` records which carrier was told about which
  request, so sending is idempotent (double click, resend from the backoffice).

Raw SQL with IF NOT EXISTS, as in the rest of the migrations: the tables may
already exist if they were created by hand. In particular backoffice-api runs
db.create_all() on startup, so if it restarts with the new mirror models before
this migration runs, it creates these tables itself, without the UNIQUE rules
or ON DELETE CASCADE. That is why uniqueness is declared as named unique
indexes (IF NOT EXISTS, and what ON CONFLICT below infers from) instead of
inline constraints. Run this migration before deploying backoffice-api.

Revision ID: 018
Revises: 017
Create Date: 2026-10-05
"""
from alembic import op

revision = '018'
down_revision = '017'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS lu_service_types (
            id SERIAL PRIMARY KEY,
            code VARCHAR(30) NOT NULL,
            name VARCHAR(60) NOT NULL,
            active SMALLINT NOT NULL DEFAULT 1
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_lu_service_types_code ON lu_service_types(code)")
    op.execute("""
        INSERT INTO lu_service_types (code, name) VALUES ('packing', 'Embalaje')
        ON CONFLICT (code) DO NOTHING
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS service_requests (
            id SERIAL PRIMARY KEY,
            public_id VARCHAR(32) NOT NULL,
            service_type_id INTEGER NOT NULL REFERENCES lu_service_types(id),
            country_id INTEGER REFERENCES lu_country(id),
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            whatsapp VARCHAR(20),
            preferred_date DATE,
            street VARCHAR(200),
            interior VARCHAR(100),
            neighborhood VARCHAR(100),
            city VARCHAR(100),
            state VARCHAR(100),
            country VARCHAR(20),
            map_url VARCHAR(400),
            details JSON,
            submitted_at TIMESTAMP,
            created_date TIMESTAMP DEFAULT now(),
            updated_date TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_service_requests_public_id ON service_requests(public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS service_request_items (
            id SERIAL PRIMARY KEY,
            service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
            description VARCHAR(200) NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            position INTEGER NOT NULL DEFAULT 0
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_service_request_items_request
        ON service_request_items(service_request_id)
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS lu_service_materials (
            id SERIAL PRIMARY KEY,
            service_type_id INTEGER NOT NULL REFERENCES lu_service_types(id),
            code VARCHAR(30) NOT NULL,
            name VARCHAR(60) NOT NULL,
            description VARCHAR(200),
            position INTEGER NOT NULL DEFAULT 0,
            active SMALLINT NOT NULL DEFAULT 1
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_lu_service_materials_type_code
        ON lu_service_materials(service_type_id, code)
    """)
    op.execute("""
        INSERT INTO lu_service_materials (service_type_id, code, name, description, position)
        SELECT st.id, m.code, m.name, m.description, m.position
        FROM lu_service_types st,
            (VALUES
                ('cardboard_sheet', 'Cartón',         'Planchas para proteger superficies y esquinas', 1),
                ('stretch_film',    'Film',           'Film stretch para envolver muebles',            2),
                ('carpet',          'Alfombra',       'Para proteger muebles durante el traslado',     3),
                ('cardboard_box',   'Caja de cartón', 'Para objetos sueltos, ropa, libros, vajilla',   4),
                ('wooden_crate',    'Caja de madera', 'Para objetos muy frágiles o de valor',          5)
            ) AS m(code, name, description, position)
        WHERE st.code = 'packing'
        ON CONFLICT (service_type_id, code) DO NOTHING
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS service_request_item_materials (
            item_id INTEGER NOT NULL REFERENCES service_request_items(id) ON DELETE CASCADE,
            material_id INTEGER NOT NULL REFERENCES lu_service_materials(id),
            PRIMARY KEY (item_id, material_id)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS service_request_media (
            id SERIAL PRIMARY KEY,
            service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
            url VARCHAR(500) NOT NULL,
            storage_key VARCHAR(300) NOT NULL,
            media_type VARCHAR(10) NOT NULL,
            content_type VARCHAR(60),
            size_bytes INTEGER,
            created_date TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_service_request_media_request
        ON service_request_media(service_request_id)
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS carrier_company_service_types (
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id) ON DELETE CASCADE,
            service_type_id INTEGER NOT NULL REFERENCES lu_service_types(id) ON DELETE CASCADE,
            created_date TIMESTAMP DEFAULT now(),
            PRIMARY KEY (carrier_company_id, service_type_id)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS service_request_notifications (
            id SERIAL PRIMARY KEY,
            service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
            carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id),
            sent_at TIMESTAMP DEFAULT now()
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_service_request_notifications_request_carrier
        ON service_request_notifications(service_request_id, carrier_company_id)
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS service_request_notifications")
    op.execute("DROP TABLE IF EXISTS carrier_company_service_types")
    op.execute("DROP TABLE IF EXISTS service_request_media")
    op.execute("DROP TABLE IF EXISTS service_request_item_materials")
    op.execute("DROP TABLE IF EXISTS lu_service_materials")
    op.execute("DROP TABLE IF EXISTS service_request_items")
    op.execute("DROP TABLE IF EXISTS service_requests")
    op.execute("DROP TABLE IF EXISTS lu_service_types")
