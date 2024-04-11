"""empty message

Revision ID: 162f7f90aa2c
Revises: 60bbe1561187
Create Date: 2024-04-10 14:54:55.305800

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '162f7f90aa2c'
down_revision = '60bbe1561187'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('order_details', schema=None) as batch_op:
        batch_op.add_column(sa.Column('approximate_distance_from_parking', sa.Integer(), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('order_details', schema=None) as batch_op:
        batch_op.drop_column('approximate_distance_from_parking')

    # ### end Alembic commands ###