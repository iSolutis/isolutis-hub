"""Sócios como parceiros, conta de aporte e recorrência de títulos.

Revision ID: 0012
Revises: 0011
"""

from migrations.sql_runner import executar_sql

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    executar_sql("0012_socios_e_recorrencia.sql")


def downgrade() -> None:
    executar_sql("0012_socios_e_recorrencia_down.sql")
