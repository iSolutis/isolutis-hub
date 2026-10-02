"""Dependências do FastAPI: sessão, usuário autenticado e permissão de administrador."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import definir_usuario_da_transacao, get_session
from app.errors import NaoAutenticado, SemPermissao
from app.models import Usuario
from app.security import ler_token

Sessao = Annotated[AsyncSession, Depends(get_session)]
_bearer = HTTPBearer(auto_error=False)


async def usuario_atual(
    sessao: Sessao, credenciais: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> Usuario:
    if credenciais is None:
        raise NaoAutenticado("Entre com seu e-mail e senha.")
    usuario_id = ler_token(credenciais.credentials)
    usuario = await sessao.get(Usuario, usuario_id) if usuario_id else None
    if usuario is None or not usuario.ativo:
        raise NaoAutenticado("Sua sessão expirou. Entre de novo no Hub.")
    # Contrato de auditoria com o banco: o trigger set_audit usa este usuário.
    await definir_usuario_da_transacao(sessao, usuario.id)
    return usuario


async def administrador(usuario: Annotated[Usuario, Depends(usuario_atual)]) -> Usuario:
    if not usuario.admin:
        raise SemPermissao("Só administradores podem gerenciar usuários.")
    return usuario


UsuarioLogado = Annotated[Usuario, Depends(usuario_atual)]
Administrador = Annotated[Usuario, Depends(administrador)]
