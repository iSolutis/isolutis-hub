"""Modelos ORM do módulo financeiro (schema: migrações/sql/0002_modulo_financeiro.sql)."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.parceiro import Parceiro


class Carimbos:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime | None]


class InstituicaoFinanceira(Carimbos, Base):
    __tablename__ = "instituicao_financeira"

    codigo: Mapped[str]
    nome: Mapped[str]


class PlanoConta(Carimbos, Base):
    __tablename__ = "plano_contas"

    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresa.id"))
    plano_pai_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("plano_contas.id"))
    codigo: Mapped[str]
    nome: Mapped[str]
    tipo_conta: Mapped[str]
    natureza: Mapped[str]
    nivel: Mapped[int] = mapped_column(default=1)
    aporte_socio: Mapped[bool] = mapped_column(default=False, server_default=text("false"))


class ContaBancaria(Carimbos, Base):
    __tablename__ = "conta_bancaria"

    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresa.id"))
    instituicao_financeira_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("instituicao_financeira.id"))
    nome: Mapped[str]
    saldo_inicial: Mapped[Decimal] = mapped_column(default=Decimal("0.00"))

    instituicao: Mapped[InstituicaoFinanceira] = relationship(lazy="raise")


class RecorrenciaTitulo(Carimbos, Base):
    """Modelo de uma despesa (P) ou receita (R) que se repete; os títulos reais ficam em `titulo_financeiro`."""

    __tablename__ = "recorrencia_titulo"

    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresa.id"))
    tipo_conta: Mapped[str]
    conta_bancaria_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conta_bancaria.id"))
    plano_conta_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plano_contas.id"))
    parceiro_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parceiro_negocio.id"))
    valor_titulo: Mapped[Decimal]
    anotacao: Mapped[str | None]
    frequencia: Mapped[str]
    data_inicio: Mapped[date]
    termino: Mapped[str]
    data_fim: Mapped[date | None]
    quantidade: Mapped[int | None]
    ativa: Mapped[bool] = mapped_column(default=True)
    gerado_ate: Mapped[date | None]
    encerrada_em: Mapped[datetime | None]

    conta_bancaria: Mapped[ContaBancaria] = relationship(lazy="raise")
    plano_conta: Mapped[PlanoConta] = relationship(lazy="raise")
    parceiro: Mapped[Parceiro] = relationship(lazy="raise")


class TituloFinanceiro(Carimbos, Base):
    __tablename__ = "titulo_financeiro"

    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresa.id"))
    conta_bancaria_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conta_bancaria.id"))
    plano_conta_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plano_contas.id"))
    parceiro_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parceiro_negocio.id"))
    tipo_conta: Mapped[str]
    data_emissao: Mapped[date | None]
    data_vencimento: Mapped[date]
    valor_titulo: Mapped[Decimal] = mapped_column(default=Decimal("0.00"))
    valor_desconto: Mapped[Decimal] = mapped_column(default=Decimal("0.00"))
    valor_multa: Mapped[Decimal] = mapped_column(default=Decimal("0.00"))
    valor_juros: Mapped[Decimal] = mapped_column(default=Decimal("0.00"))
    status: Mapped[str] = mapped_column(default="A")
    data_pagamento: Mapped[date | None]
    valor_quitacao: Mapped[Decimal] = mapped_column(default=Decimal("0.00"))
    anotacao: Mapped[str | None]
    recorrencia_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("recorrencia_titulo.id"))

    conta_bancaria: Mapped[ContaBancaria] = relationship(lazy="raise")
    plano_conta: Mapped[PlanoConta] = relationship(lazy="raise")
    parceiro: Mapped[Parceiro] = relationship(lazy="raise")
