"""Idempotência de gravações (chave por empresa e pessoa).

Revision ID: 0014
Revises: 0013
"""

from migrations.sql_runner import executar_sql

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    executar_sql("0014_idempotencia.sql")


def downgrade() -> None:
    executar_sql("0014_idempotencia_down.sql")
