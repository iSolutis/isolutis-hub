"""Remove o módulo Despesas/Investimentos (passa a ser título).

Revision ID: 0013
Revises: 0012
"""

from migrations.sql_runner import executar_sql

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    executar_sql("0013_remove_modulo_despesas.sql")


def downgrade() -> None:
    executar_sql("0013_remove_modulo_despesas_down.sql")
