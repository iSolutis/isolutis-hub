from uuid import UUID

from fastapi import APIRouter, Depends, Response

from app.deps import Administrador, Sessao, UsuarioLogado, usuario_atual
from app.schemas.usuario import MembroEquipe, UsuarioAtualizar, UsuarioCriar, UsuarioLeitura
from app.services import usuarios as svc

router = APIRouter(tags=["Equipe"])


@router.get("/equipe", response_model=list[MembroEquipe], dependencies=[Depends(usuario_atual)])
async def equipe(sessao: Sessao) -> list[MembroEquipe]:
    """Pessoas da equipe (qualquer usuário logado): usado em responsáveis e na autoria dos registros."""
    return [MembroEquipe.model_validate(u) for u in await svc.equipe(sessao)]


@router.get("/usuarios", response_model=list[UsuarioLeitura], tags=["Administração"])
async def listar_usuarios(_: Administrador, sessao: Sessao) -> list[UsuarioLeitura]:
    return [UsuarioLeitura.model_validate(u) for u in await svc.equipe(sessao)]


@router.post("/usuarios", response_model=UsuarioLeitura, status_code=201, tags=["Administração"])
async def criar_usuario(dados: UsuarioCriar, _: Administrador, sessao: Sessao) -> UsuarioLeitura:
    return UsuarioLeitura.model_validate(await svc.criar(sessao, dados))


@router.put("/usuarios/{id_}", response_model=UsuarioLeitura, tags=["Administração"])
async def atualizar_usuario(id_: UUID, dados: UsuarioAtualizar, quem: Administrador, sessao: Sessao) -> UsuarioLeitura:
    return UsuarioLeitura.model_validate(await svc.atualizar(sessao, quem, id_, dados))


@router.delete("/usuarios/{id_}", status_code=204, tags=["Administração"])
async def remover_usuario(id_: UUID, quem: Administrador, sessao: Sessao) -> Response:
    await svc.desativar(sessao, quem, id_)
    return Response(status_code=204)


__all__ = ["router", "UsuarioLogado"]
