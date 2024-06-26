"""empty message

Revision ID: 5edba93bb7e6
Revises: 24be01e6f27a
Create Date: 2024-04-29 22:08:48.297276

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5edba93bb7e6'
down_revision = '24be01e6f27a'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('total_amount', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('approximate_budget', sa.Float(), nullable=True))

    with op.batch_alter_table('quotations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('created_date', sa.DateTime(), server_default=sa.text('now()'), nullable=True))
        batch_op.add_column(sa.Column('updated_date', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('quotations', schema=None) as batch_op:
        batch_op.drop_column('updated_date')
        batch_op.drop_column('created_date')

    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_column('approximate_budget')
        batch_op.drop_column('total_amount')

    # ### end Alembic commands ###
