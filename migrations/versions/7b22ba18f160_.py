"""empty message

Revision ID: 7b22ba18f160
Revises: 6426a3f70902
Create Date: 2023-12-05 12:58:07.277438

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '7b22ba18f160'
down_revision = '6426a3f70902'
branch_labels = None
depends_on = None


def upgrade():
    ### commands auto generated by Alembic - please adjust! ###
    lu_country_table = op.create_table('lu_country',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('country', sa.String(length=40), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.bulk_insert(
        lu_country_table,
        [
            {
                "country": "México",
            },
            {
                "country": "Perú",
            },
        ],
    )
    with op.batch_alter_table('quotations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('carrier_company_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_quotations_carrier_company', 'carrier_company', ['carrier_company_id'], ['id'])
        batch_op.drop_constraint('quotations_ibfk_2', type_='foreignkey')
        batch_op.drop_column('vehicle_id')

    with op.batch_alter_table('carrier_company', schema=None) as batch_op:
        batch_op.add_column(sa.Column('country_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('description', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('phone', sa.String(length=45), nullable=True))
        batch_op.add_column(sa.Column('youtube', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('facebook', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('cover_image', sa.String(length=200), nullable=True))
        batch_op.create_foreign_key('fk_country_carrier_company', 'lu_country', ['country_id'], ['id'])

    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('country_id', sa.Integer(), nullable=True))
        batch_op.drop_constraint('fk_products1', type_='foreignkey')
        batch_op.create_foreign_key('fk_country_orders', 'lu_country', ['country_id'], ['id'])
        batch_op.drop_column('product_id')

    op.drop_table('products')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('quotations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('vehicle_id', mysql.INTEGER(display_width=11), autoincrement=False, nullable=True))
        batch_op.create_foreign_key('quotations_ibfk_2', 'vehicles', ['vehicle_id'], ['id'])
        batch_op.drop_constraint('fk_quotations_carrier_company', type_='foreignkey')
        batch_op.drop_column('carrier_company_id')
    op.create_table('products',
    sa.Column('id', mysql.INTEGER(display_width=11), autoincrement=True, nullable=False),
    sa.Column('vehicle_id', mysql.INTEGER(display_width=11), autoincrement=False, nullable=False),
    sa.Column('price', mysql.FLOAT(), nullable=True),
    sa.Column('total_kilometers', mysql.INTEGER(display_width=20), autoincrement=False, nullable=True),
    sa.Column('description', mysql.VARCHAR(length=500), nullable=True),
    sa.Column('active', mysql.INTEGER(display_width=11), autoincrement=False, nullable=False),
    sa.Column('updated_date', mysql.DATETIME(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
    sa.Column('created_date', mysql.DATETIME(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name='fk_vehicle1'),
    sa.PrimaryKeyConstraint('id'),
    mysql_default_charset='utf8',
    mysql_engine='InnoDB'
    )
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('product_id', mysql.INTEGER(display_width=11), autoincrement=False, nullable=True))
        batch_op.drop_constraint('fk_country_orders', type_='foreignkey')
        batch_op.create_foreign_key('fk_products1', 'products', ['product_id'], ['id'])
        batch_op.drop_column('country_id')

    with op.batch_alter_table('carrier_company', schema=None) as batch_op:
        batch_op.drop_constraint('fk_country_carrier_company', type_='foreignkey')
        batch_op.drop_column('youtube')
        batch_op.drop_column('facebook')
        batch_op.drop_column('cover_image')
        batch_op.drop_column('phone')
        batch_op.drop_column('description')
        batch_op.drop_column('country_id')
    op.drop_table('lu_country')
    # ### end Alembic commands ###