"""empty message

Revision ID: a951a7d70017
Revises: 5edba93bb7e6
Create Date: 2024-07-03 17:54:30.422445

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a951a7d70017'
down_revision = '5edba93bb7e6'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('carrier_company', schema=None) as batch_op:
        batch_op.add_column(sa.Column('logo_image', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('homepage_url', sa.String(length=200), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('carrier_company', schema=None) as batch_op:
        batch_op.drop_column('homepage_url')
        batch_op.drop_column('logo_image')

    # ### end Alembic commands ###
