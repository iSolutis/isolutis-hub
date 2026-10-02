import uuid
from datetime import datetime

from sqlalchemy import Computed
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, ComAuditoria


class Usuario(ComAuditoria, Base):
    """Equipe/login. Membro do Hub = usuário ativo."""

    __tablename__ = "usuarios"

    email: Mapped[str] = mapped_column(CITEXT, unique=True)
    nome: Mapped[str]
    senha_hash: Mapped[str | None]
    senha_definida: Mapped[bool] = mapped_column(Computed("senha_hash IS NOT NULL", persisted=True))
    admin: Mapped[bool] = mapped_column(default=False)
    ativo: Mapped[bool] = mapped_column(default=True)
    ultimo_acesso: Mapped[datetime | None]


class CategoriaDespesa(ComAuditoria, Base):
    __tablename__ = "categorias_despesa"

    nome: Mapped[str] = mapped_column(CITEXT, unique=True)
    ordem: Mapped[int] = mapped_column(default=0)
    ativo: Mapped[bool] = mapped_column(default=True)


class Investidor(ComAuditoria, Base):
    __tablename__ = "investidores"

    nome: Mapped[str] = mapped_column(CITEXT, unique=True)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    ativo: Mapped[bool] = mapped_column(default=True)
