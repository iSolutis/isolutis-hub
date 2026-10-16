"""Escopo de acesso: equipes (administração), pessoas atribuíveis e transferência de dono."""

from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text

from app.deps import Administrador, EmpresaAtual, Sessao, requer_base
from app.schemas.escopo import EquipeEntrada, EquipeLeitura, PessoaReferencia, TransferenciaEntrada
from app.services import equipes as svc
from app.services import escopo

router = APIRouter(tags=["Escopo de acesso"])


@router.get("/equipes", response_model=list[EquipeLeitura])
async def listar_equipes(empresa: EmpresaAtual, _: Administrador, sessao: Sessao):
    return await svc.listar(sessao, empresa.id)


@router.post("/equipes", response_model=EquipeLeitura, status_code=201)
async def criar_equipe(dados: EquipeEntrada, empresa: EmpresaAtual, _: Administrador, sessao: Sessao):
    return await svc.criar(sessao, empresa.id, dados)


@router.put("/equipes/{id_}", response_model=EquipeLeitura)
async def atualizar_equipe(id_: UUID, dados: EquipeEntrada, empresa: EmpresaAtual, _: Administrador, sessao: Sessao):
    return await svc.atualizar(sessao, empresa.id, id_, dados)


@router.delete("/equipes/{id_}", status_code=204)
async def excluir_equipe(id_: UUID, _: Administrador, sessao: Sessao) -> Response:
    await svc.excluir(sessao, id_)
    return Response(status_code=204)


@router.get("/escopo/pessoas", response_model=list[PessoaReferencia], dependencies=[Depends(requer_base)])
async def pessoas_atribuiveis(empresa: EmpresaAtual, sessao: Sessao):
    """Quem a pessoa pode pôr como dono: todos (admin), ela e os liderados (líder) ou só ela."""
    return [PessoaReferencia(id=i, nome=n) for i, n in await escopo.pessoas_atribuiveis(sessao, empresa.id)]


@router.get("/escopo/eu", dependencies=[Depends(requer_base)])
async def meu_escopo(sessao: Sessao) -> dict[str, object]:
    """Para a interface: se a pessoa é admin, se lidera alguém e quantas equipes a empresa tem."""
    e = await escopo.atual(sessao)
    equipes = await sessao.scalar(text("select count(*) from equipe where empresa_id = app_empresa_id()"))
    return {"ve_tudo": e.ve_tudo, "lider": e.lider, "liderados": len(e.visiveis - {e.usuario_id}), "equipes": equipes}


@router.post("/escopo/transferir", status_code=204, dependencies=[Depends(requer_base)])
async def transferir(dados: TransferenciaEntrada, sessao: Sessao) -> Response:
    await svc.transferir(sessao, dados)
    return Response(status_code=204)
