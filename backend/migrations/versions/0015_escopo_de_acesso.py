"""Escopo de acesso: equipes, dono do cliente, participantes de projeto e RLS por escopo.

Revision ID: 0015
Revises: 0014
"""

from migrations.sql_runner import executar_sql

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    executar_sql("0015_escopo_de_acesso.sql")


def downgrade() -> None:
    executar_sql("0015_escopo_de_acesso_down.sql")
