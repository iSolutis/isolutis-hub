from datetime import datetime

from sqlalchemy import Computed
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, ComAuditoria


class Usuario(ComAuditoria, Base):
    """Equipe/login. Membro do Hub = usuário ativo."""

    __tablename__ = "usuarios"

    email: Mapped[str] = mapped_column(CITEXT, unique=True)
    nome: Mapped[str]
    senha_hash: Mapped[str | None]
    versao_sessao: Mapped[int] = mapped_column(default=0, server_default="0")
    senha_definida: Mapped[bool] = mapped_column(Computed("senha_hash IS NOT NULL", persisted=True))
    ativo: Mapped[bool] = mapped_column(default=True)
    ultimo_acesso: Mapped[datetime | None]
    totp_secret: Mapped[str | None] = mapped_column(nullable=True)
    totp_ativo: Mapped[bool] = mapped_column(default=False, server_default="false")

    # Papel na empresa ativa: não é coluna; a listagem da equipe e a criação/atualização o preenchem para a resposta.
    papel = None
