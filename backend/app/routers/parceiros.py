"""Hub de parceiros de negócio (cadastro único com papéis). Exige a permissão `financeiro`."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from app.deps import EmpresaAtual, Sessao, requer_base, requer_financeiro
from app.domain.papeis import papeis_de_parceiro_visiveis
from app.models import Parceiro
from app.schemas.parceiro import PapelLeitura, ParceiroAtualizar, ParceiroEntrada, ParceiroLeitura
from app.schemas.tag import TagEntrada, TagLeitura, TagsParceiroEntrada
from app.services import parceiros as svc
from app.services import tags as svc_tags


def _visiveis(sessao: Sessao) -> frozenset[str] | None:
    """Papéis de parceiro que o papel do usuário na empresa ativa enxerga (`None` = todos)."""
    return papeis_de_parceiro_visiveis(sessao.info.get("papel"))


def _leitura(parceiro: Parceiro, visiveis: frozenset[str] | None) -> ParceiroLeitura:
    """Esconde da resposta o que o usuário não gerencia: papéis fora da sua visão e a participação do sócio."""
    dados = ParceiroLeitura.model_validate(parceiro)
    if visiveis is not None:
        dados.papeis = [c for c in dados.papeis if c in visiveis]
        if svc.PAPEL_SOCIO not in visiveis:
            dados.participacao_percentual = None
    return dados


router = APIRouter(prefix="/parceiros", tags=["Parceiros de negócio"], dependencies=[Depends(requer_financeiro)])
router_papeis = APIRouter(prefix="/parceiros", tags=["Parceiros de negócio"], dependencies=[Depends(requer_base)])


@router.get("/tags", response_model=list[TagLeitura])
async def listar_tags(sessao: Sessao, empresa: EmpresaAtual):
    return await svc_tags.listar(sessao, empresa)


@router.post("/tags", response_model=TagLeitura, status_code=201)
async def criar_tag(dados: TagEntrada, sessao: Sessao, empresa: EmpresaAtual):
    return await svc_tags.criar(sessao, empresa, dados.nome)


@router.put("/tags/{tag_id}", response_model=TagLeitura)
async def atualizar_tag(tag_id: UUID, dados: TagEntrada, sessao: Sessao, empresa: EmpresaAtual):
    return await svc_tags.atualizar(sessao, empresa, tag_id, dados.nome)


@router.delete("/tags/{tag_id}", response_model=TagLeitura)
async def arquivar_tag(tag_id: UUID, sessao: Sessao, empresa: EmpresaAtual):
    return await svc_tags.arquivar(sessao, empresa, tag_id)


@router.put("/{id_}/tags", status_code=204)
async def atribuir_tags(id_: UUID, dados: TagsParceiroEntrada, sessao: Sessao, empresa: EmpresaAtual):
    await svc.obter_completo(sessao, empresa, id_, visiveis=_visiveis(sessao))  # 404 para quem não enxerga o parceiro
    await svc_tags.atribuir(sessao, empresa, id_, dados.tag_ids)
    return Response(status_code=204)


@router_papeis.get("/papeis", response_model=list[PapelLeitura])
async def papeis(sessao: Sessao):
    """Papéis que o usuário pode atribuir a um parceiro (qualquer pessoa logada pode consultar)."""
    return await svc.listar_papeis(sessao, _visiveis(sessao))


@router.get("", response_model=list[ParceiroLeitura])
async def listar(
    sessao: Sessao, papel: str | None = Query(None, max_length=40), busca: str | None = Query(None, max_length=100),
    tag_ids: list[UUID] = Query(default=[], max_length=50),
):
    visiveis = _visiveis(sessao)
    parceiros = await svc.listar(sessao, await svc.empresa_atual(sessao), papel, busca, tag_ids, visiveis)
    return [_leitura(p, visiveis) for p in parceiros]


def _campos(dados: ParceiroEntrada) -> dict:
    return dados.campos_para_gravar("papeis", "versao", "participacao_percentual")


@router.post("", response_model=ParceiroLeitura, status_code=201)
async def criar(dados: ParceiroEntrada, sessao: Sessao):
    visiveis = _visiveis(sessao)
    parceiro = await svc.criar(
        sessao, await svc.empresa_atual(sessao), _campos(dados), dados.papeis, dados.participacao_percentual, visiveis
    )
    return _leitura(parceiro, visiveis)


@router.put("/{id_}", response_model=ParceiroLeitura)
async def atualizar(id_: UUID, dados: ParceiroAtualizar, sessao: Sessao):
    visiveis = _visiveis(sessao)
    parceiro = await svc.atualizar(
        sessao, await svc.empresa_atual(sessao), id_, _campos(dados), dados.versao, dados.papeis,
        dados.participacao_percentual, visiveis,
    )
    return _leitura(parceiro, visiveis)


@router.delete("/{id_}", status_code=204)
async def excluir(id_: UUID, sessao: Sessao) -> Response:
    await svc.excluir(sessao, await svc.empresa_atual(sessao), id_, visiveis=_visiveis(sessao))
    return Response(status_code=204)
