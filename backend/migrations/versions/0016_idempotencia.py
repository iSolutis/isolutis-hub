"""Idempotência de gravações (chave por empresa e pessoa).

Revision ID: 0016
Revises: 0015
"""

from migrations.sql_runner import executar_sql

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    executar_sql("0016_idempotencia.sql")


def downgrade() -> None:
    executar_sql("0016_idempotencia_down.sql")
