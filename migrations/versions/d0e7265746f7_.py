"""empty message

Revision ID: d0e7265746f7
Revises: 7b22ba18f160
Create Date: 2023-12-06 11:33:09.185288

"""
import os
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'd0e7265746f7'
down_revision = '7b22ba18f160'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('carrier_company', schema=None) as batch_op:
        batch_op.alter_column('description',
               existing_type=mysql.VARCHAR(length=200),
               type_=sa.String(length=2000),
               nullable=True)

    if os.getenv('FLASK_ENV') == 'development':
        carrier_company_table = sa.table('carrier_company',
                                         sa.Column('id'),
                                         sa.Column('name'),
                                         sa.Column('rfc'),
                                         sa.Column('email'),
                                         sa.Column('address'),
                                         sa.Column('active'),
                                         sa.Column('country_id'),
                                         sa.Column('description'),
                                         sa.Column('phone'),
                                         sa.Column('youtube'),
                                         sa.Column('facebook'),
                                         sa.Column('cover_image'))
        op.bulk_insert(
            carrier_company_table,
            [
                {
                    'id': 1,
                    'name': 'José Pablo Salgado Hernandez',
                    'rfc': 'test',
                    'email': 'salgadohernandezjosepablo482@gmail.com',
                    'address': 'Calle Lago Texcoco Manzana 7 Lote 379 Colonia Ejido de Guadalupe 54745 Cuautitlan Izcalli México',
                    'active': 1,
                    'country_id': 1,
                    'description': 'Entendemos que mudarse de casa o departamento puede ser un momento emocionante, pero también puede resultar abrumador. Es por eso que nos enorgullece ofrecer servicios de mudanzas excepcionales para hacer que tu experiencia de traslado sea suave y sin complicaciones.',
                    'phone': '+51987654321',
                    'youtube': 'https://youtube.com',
                    'facebook': 'https://facebook.com',
                    'cover_image': 'https://chalan-public.s3.amazonaws.com/11.jpeg',
                },
                {
                    'id': 2,
                    'name': 'Carlos Calderón',
                    'rfc': 'test',
                    'email': 'cadermino@gmail.com',
                    'address': 'Los arenales 285 piopata el tambo huancayo',
                    'active': 1,
                    'country_id': 2,
                    'description': 'Entendemos que mudarse de casa o departamento puede ser un momento emocionante, pero también puede resultar abrumador. Es por eso que nos enorgullece ofrecer servicios de mudanzas excepcionales para hacer que tu experiencia de traslado sea suave y sin complicaciones.',
                    'phone': '+51987654321',
                    'youtube': 'https://youtube.com',
                    'facebook': 'https://facebook.com',
                    'cover_image': 'https://chalan-public.s3.amazonaws.com/11.jpeg',
                },
            ],
        )

        lu_order_status_table = sa.table('lu_order_status', sa.Column('id'), sa.Column('status'))
        op.bulk_insert(
            lu_order_status_table,
            [
                {
                    'id': 1,
                    'status': 'pending',
                },
                {
                    'id': 2,
                    'status': 'in progress',
                },
                {
                    'id': 3,
                    'status': 'completed',
                },
                {
                    'id': 4,
                    'status': 'cancelled',
                }
            ]
        )

        lu_payment_type_table = sa.table('lu_payment_type', sa.Column('id'), sa.Column('type'))
        op.bulk_insert(
            lu_payment_type_table,
            [
                {
                    'id': 1,
                    'type': 'card',
                },
                {
                    'id': 2,
                    'type': 'cash',
                },
            ]
        )

        vehicles_table = sa.table('vehicles',
                                  sa.Column('id'),
                                  sa.Column('charge_per_kilometer'),
                                  sa.Column('charge_per_floor'),
                                  sa.Column('driver_fee'),
                                  sa.Column('loader_fee'),
                                  sa.Column('loaders_quantity'),
                                  sa.Column('size'),
                                  sa.Column('weight'),
                                  sa.Column('width'),
                                  sa.Column('height'),
                                  sa.Column('length'),
                                  sa.Column('brand'),
                                  sa.Column('model'),
                                  sa.Column('carrier_company_id'),
                                  sa.Column('description'),
                                  sa.Column('picture'),
                                  sa.Column('plates'),
                                  sa.Column('base_address'),
                                  sa.Column('active'))
        op.bulk_insert(
            vehicles_table,
            [
                {
                    'id': 1,
                    'charge_per_kilometer': 25,
                    'charge_per_floor': 100,
                    'driver_fee': 400,
                    'loader_fee': 300,
                    'loaders_quantity': 2,
                    'size': 'small',
                    'weight': '0–2,722',
                    'brand': 'Chevrolet',
                    'model': 'Colorado/GMC Canyon',
                    'carrier_company_id': 1,
                    'description': 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB',
                    'picture': 'Chevrolet_Colorado.jpg',
                    'plates': '464gfg',
                    'base_address': 'Ejido de Guadalupe 54745 Cuautitlan Izcalli México',
                    'active': 1,
                },
                {
                    'id': 2,
                    'charge_per_kilometer': 25,
                    'charge_per_floor': 100,
                    'driver_fee': 400,
                    'loader_fee': 300,
                    'loaders_quantity': 2,
                    'size': 'small',
                    'weight': '0–2,722',
                    'brand': 'Ford',
                    'model': 'Ranger',
                    'carrier_company_id': 2,
                    'description': 'I\'m baby drinking vinegar vape pok pok sriracha. Franzen kale chips trust fund vexillologist, activated charcoal snackwave sriracha keytar. Mixtape hella lumbersexual, flexitarian literally freegan PB',
                    'picture': 'ford-ranger.webp',
                    'plates': '464gfg',
                    'base_address': 'Ejido de Guadalupe 54745 Cuautitlan Izcalli México',
                    'active': 1,
                },
            ]
        )

def downgrade():
    if os.getenv('FLASK_ENV') == 'development':
        op.execute('DELETE FROM vehicles WHERE vehicles.id in (1,2)')
        op.execute('DELETE FROM carrier_company WHERE carrier_company.id in (1,2)')
        op.execute('DELETE FROM lu_order_status WHERE lu_order_status.id in (1,2,3,4)')
        op.execute('DELETE FROM lu_payment_type WHERE lu_payment_type.id in (1,2)')

    with op.batch_alter_table('carrier_company', schema=None) as batch_op:
        batch_op.alter_column('description',
               existing_type=mysql.VARCHAR(length=2000),
               type_=sa.String(length=200),
               nullable=True)
    # ### end Alembic commands ###
