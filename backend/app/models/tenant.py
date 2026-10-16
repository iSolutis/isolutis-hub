"""Memberships, tags e seleção da empresa ativa."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, func, text
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class UsuarioEmpresa(Base):
    __tablename__ = "usuario_empresa"

    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresa.id"), primary_key=True)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id"), primary_key=True)
    papel: Mapped[str] = mapped_column(String(16))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class TagParceiro(Base):
    __tablename__ = "tag_parceiro"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresa.id"), server_default=text("app_empresa_id()"))
    nome: Mapped[str]
    ativo: Mapped[bool] = mapped_column(default=True)
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())


class ParceiroTag(Base):
    __tablename__ = "parceiro_tag"

    empresa_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("app_empresa_id()"))
    parceiro_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    tag_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)


class Convite(Base):
    """Convite por e-mail para ingressar na equipe de uma empresa."""

    __tablename__ = "convites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, server_default=text("gen_random_uuid()"))
    email: Mapped[str] = mapped_column(CITEXT, nullable=False)
    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresa.id"), nullable=False)
    papel: Mapped[str] = mapped_column(String(16), nullable=False)
    criado_por: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    expira_em: Mapped[datetime] = mapped_column(nullable=False)
    usado_em: Mapped[datetime | None] = mapped_column(nullable=True)
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)


class Equipe(Base):
    """Equipe da empresa: os líderes enxergam e administram os registros dos membros (e dos liderados deles)."""

    __tablename__ = "equipe"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresa.id"), server_default=text("app_empresa_id()"))
    nome: Mapped[str]
    criado_em: Mapped[datetime] = mapped_column(server_default=func.now())


class EquipeMembro(Base):
    __tablename__ = "equipe_membro"

    equipe_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("equipe.id"), primary_key=True)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id"), primary_key=True)
    empresa_id: Mapped[uuid.UUID] = mapped_column(server_default=text("app_empresa_id()"))


class EquipeLider(Base):
    __tablename__ = "equipe_lider"

    equipe_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("equipe.id"), primary_key=True)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id"), primary_key=True)
    empresa_id: Mapped[uuid.UUID] = mapped_column(server_default=text("app_empresa_id()"))


class ProjetoParticipante(Base):
    """Pessoa incluída no projeto: vê o projeto inteiro e só edita o que é dela."""

    __tablename__ = "projeto_participante"

    projeto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projetos.id"), primary_key=True)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id"), primary_key=True)
    empresa_id: Mapped[uuid.UUID] = mapped_column(server_default=text("app_empresa_id()"))
    incluido_em: Mapped[datetime] = mapped_column(server_default=func.now())


class TransferenciaDono(Base):
    """Registro de troca de dono (gravado pelo gatilho do banco; leitura só por administradores)."""

    __tablename__ = "transferencia_dono"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    empresa_id: Mapped[uuid.UUID] = mapped_column(server_default=text("app_empresa_id()"))
    entidade: Mapped[str]
    registro_id: Mapped[uuid.UUID]
    de: Mapped[uuid.UUID | None]
    para: Mapped[uuid.UUID | None]
    por: Mapped[uuid.UUID | None]
    em: Mapped[datetime] = mapped_column(server_default=func.now())
