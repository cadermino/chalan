"""empty message

Revision ID: 60bbe1561187
Revises: 9bcb5785bbda
Create Date: 2024-04-10 12:55:45.284637

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '60bbe1561187'
down_revision = '9bcb5785bbda'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('order_details', schema=None) as batch_op:
        batch_op.add_column(sa.Column('has_elevator', sa.Integer(), server_default=sa.text("'0'"), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('order_details', schema=None) as batch_op:
        batch_op.drop_column('has_elevator')

    # ### end Alembic commands ###
