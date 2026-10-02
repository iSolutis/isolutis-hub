"""Hub de parceiros de negócio (cadastro único com papéis). Restrito a administradores."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from app.deps import Sessao, administrador, usuario_atual
from app.schemas.parceiro import PapelLeitura, ParceiroAtualizar, ParceiroEntrada, ParceiroLeitura
from app.services import parceiros as svc

router = APIRouter(prefix="/parceiros", tags=["Parceiros de negócio"], dependencies=[Depends(administrador)])
router_papeis = APIRouter(prefix="/parceiros", tags=["Parceiros de negócio"], dependencies=[Depends(usuario_atual)])


@router_papeis.get("/papeis", response_model=list[PapelLeitura])
async def papeis(sessao: Sessao):
    """Papéis que um parceiro pode assumir (qualquer pessoa logada pode consultar)."""
    return await svc.listar_papeis(sessao)


@router.get("", response_model=list[ParceiroLeitura])
async def listar(
    sessao: Sessao, papel: str | None = Query(None, max_length=40), busca: str | None = Query(None, max_length=100)
):
    return await svc.listar(sessao, await svc.empresa_atual(sessao), papel, busca)


def _campos(dados: ParceiroEntrada) -> dict:
    return dados.model_dump(exclude={"papeis", "versao"})


@router.post("", response_model=ParceiroLeitura, status_code=201)
async def criar(dados: ParceiroEntrada, sessao: Sessao):
    return await svc.criar(sessao, await svc.empresa_atual(sessao), _campos(dados), dados.papeis)


@router.put("/{id_}", response_model=ParceiroLeitura)
async def atualizar(id_: UUID, dados: ParceiroAtualizar, sessao: Sessao):
    return await svc.atualizar(sessao, await svc.empresa_atual(sessao), id_, _campos(dados), dados.versao, dados.papeis)


@router.delete("/{id_}", status_code=204)
async def excluir(id_: UUID, sessao: Sessao) -> Response:
    await svc.excluir(sessao, await svc.empresa_atual(sessao), id_)
    return Response(status_code=204)
