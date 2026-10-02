"""Login, troca de senha e gestão da equipe."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ErroApp, NaoAutenticado, RegraDeNegocio
from app.models import Usuario
from app.schemas.usuario import UsuarioAtualizar, UsuarioCriar
from app.security import gerar_hash, precisa_rehash, verificar_senha
from app.services.base import aplicar, conferir_versao, confirmar, obter

# Hash fictício para gastar o mesmo tempo quando o e-mail não existe (evita revelar quem é da equipe).
_HASH_FALSO = gerar_hash("senha-inexistente")
MSG_CREDENCIAIS = "E-mail ou senha incorretos. Confira e tente de novo."


async def autenticar(sessao: AsyncSession, email: str, senha: str) -> Usuario:
    usuario = await sessao.scalar(select(Usuario).where(Usuario.email == email))
    hash_ = usuario.senha_hash if usuario and usuario.senha_hash else _HASH_FALSO
    senha_ok = verificar_senha(senha, hash_)
    if not (usuario and usuario.ativo and usuario.senha_hash and senha_ok):
        raise NaoAutenticado(MSG_CREDENCIAIS)
    usuario.ultimo_acesso = datetime.now(UTC)
    if precisa_rehash(usuario.senha_hash):
        usuario.senha_hash = gerar_hash(senha)
    await confirmar(sessao)
    return usuario


async def trocar_senha(sessao: AsyncSession, usuario: Usuario, atual: str, nova: str) -> None:
    if not (usuario.senha_hash and verificar_senha(atual, usuario.senha_hash)):
        raise RegraDeNegocio("A senha atual não confere.")
    if verificar_senha(nova, usuario.senha_hash):
        raise RegraDeNegocio("Essa já é a sua senha atual. Escolha uma diferente.")
    usuario.senha_hash = gerar_hash(nova)
    await confirmar(sessao)


async def equipe(sessao: AsyncSession) -> list[Usuario]:
    return list((await sessao.scalars(select(Usuario).order_by(Usuario.nome))).all())


async def criar(sessao: AsyncSession, dados: UsuarioCriar) -> Usuario:
    existente = await sessao.scalar(select(Usuario).where(Usuario.email == dados.email))
    if existente:
        raise RegraDeNegocio("Já existe um usuário com este e-mail.")
    usuario = Usuario(
        email=str(dados.email).lower(), nome=dados.nome, admin=dados.admin, senha_hash=gerar_hash(dados.senha)
    )
    sessao.add(usuario)
    await _salvar(sessao)
    return usuario


async def atualizar(sessao: AsyncSession, quem: Usuario, id_: UUID, dados: UsuarioAtualizar) -> Usuario:
    usuario = await obter(sessao, Usuario, id_, "Usuário")
    conferir_versao(usuario, dados.versao)
    if usuario.id == quem.id and not (dados.admin and dados.ativo):
        raise RegraDeNegocio("Você não pode tirar o seu próprio acesso de administrador nem se desativar.")
    aplicar(usuario, {"nome": dados.nome, "admin": dados.admin, "ativo": dados.ativo})
    if dados.senha:
        usuario.senha_hash = gerar_hash(dados.senha)
    await _garantir_algum_admin(sessao)
    await _salvar(sessao)
    return usuario


async def desativar(sessao: AsyncSession, quem: Usuario, id_: UUID) -> None:
    """ "Remover da equipe": o histórico (quem criou/alterou) é preservado, por isso o usuário só é desativado."""
    usuario = await obter(sessao, Usuario, id_, "Usuário")
    if usuario.id == quem.id:
        raise RegraDeNegocio("Você não pode remover a si mesma.")
    usuario.ativo = False
    await _garantir_algum_admin(sessao)
    await confirmar(sessao)


async def _garantir_algum_admin(sessao: AsyncSession) -> None:
    await sessao.flush()
    total = await sessao.scalar(select(func.count()).select_from(Usuario).where(Usuario.admin, Usuario.ativo))
    if not total:
        await sessao.rollback()
        raise RegraDeNegocio("Precisa existir pelo menos um administrador ativo.")


async def _salvar(sessao: AsyncSession) -> None:
    try:
        await confirmar(sessao)
    except IntegrityError as e:  # corrida na criação do mesmo e-mail
        await sessao.rollback()
        raise ErroApp("Já existe um usuário com este e-mail.", status=422) from e
