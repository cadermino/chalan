"""Add whatsapp_messages table

Revision ID: 009
Revises: 008
Create Date: 2026-06-10
"""
from alembic import op

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS whatsapp_messages (
            id SERIAL NOT NULL,
            message_sid VARCHAR(64),
            direction VARCHAR(10) NOT NULL,
            from_number VARCHAR(20) NOT NULL,
            to_number VARCHAR(20) NOT NULL,
            body TEXT,
            media_urls TEXT,
            profile_name VARCHAR(120),
            customer_id INTEGER REFERENCES customers(id),
            admin_user_id INTEGER REFERENCES admin_users(id),
            sent_by_admin_id INTEGER REFERENCES admin_users(id),
            status VARCHAR(20),
            error_code VARCHAR(20),
            error_message VARCHAR(255),
            created_at TIMESTAMP NOT NULL,
            PRIMARY KEY (id),
            UNIQUE (message_sid)
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_whatsapp_messages_from_number
        ON whatsapp_messages (from_number)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_whatsapp_messages_customer_id
        ON whatsapp_messages (customer_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_whatsapp_messages_admin_user_id
        ON whatsapp_messages (admin_user_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_whatsapp_messages_created_at
        ON whatsapp_messages (created_at)
    """)


def downgrade():
    op.execute('DROP INDEX IF EXISTS ix_whatsapp_messages_created_at')
    op.execute('DROP INDEX IF EXISTS ix_whatsapp_messages_admin_user_id')
    op.execute('DROP INDEX IF EXISTS ix_whatsapp_messages_customer_id')
    op.execute('DROP INDEX IF EXISTS ix_whatsapp_messages_from_number')
    op.execute('DROP TABLE IF EXISTS whatsapp_messages')
