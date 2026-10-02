from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.constantes import ETAPAS_ABERTAS
from app.errors import RegraDeNegocio
from app.models import Cliente, LancamentoReceita, Negocio, Orcamento
from app.schemas.cliente import ClienteAtualizar, ClienteEntrada, ClienteRelacionados
from app.services.base import aplicar, conferir_versao, confirmar, obter
from app.services.orcamentos import consulta as consulta_orcamentos


async def listar(sessao: AsyncSession) -> list[tuple[Cliente, int, object]]:
    """Clientes com negócios abertos e total recebido (para a tabela da lista)."""
    abertos = (
        select(Negocio.cliente_id, func.count().label("n"))
        .where(Negocio.etapa.in_([e.value for e in ETAPAS_ABERTAS]))
        .group_by(Negocio.cliente_id)
        .subquery()
    )
    recebido = (
        select(LancamentoReceita.cliente_id, func.sum(LancamentoReceita.valor).label("v"))
        .where(LancamentoReceita.status == "recebido")
        .group_by(LancamentoReceita.cliente_id)
        .subquery()
    )
    consulta = (
        select(Cliente, func.coalesce(abertos.c.n, 0), func.coalesce(recebido.c.v, 0))
        .outerjoin(abertos, abertos.c.cliente_id == Cliente.id)
        .outerjoin(recebido, recebido.c.cliente_id == Cliente.id)
        .order_by(Cliente.nome)
    )
    return [(c, int(n), v) for c, n, v in (await sessao.execute(consulta)).all()]


async def criar(sessao: AsyncSession, dados: ClienteEntrada) -> Cliente:
    cliente = Cliente(**dados.model_dump())
    sessao.add(cliente)
    await _salvar(sessao)
    return cliente


async def atualizar(sessao: AsyncSession, id_: UUID, dados: ClienteAtualizar) -> Cliente:
    cliente = await obter(sessao, Cliente, id_, "Cliente")
    conferir_versao(cliente, dados.versao)
    aplicar(cliente, dados.model_dump(), ignorar=("versao",))
    await _salvar(sessao)
    return cliente


async def excluir(sessao: AsyncSession, id_: UUID) -> None:
    cliente = await obter(sessao, Cliente, id_, "Cliente")
    await sessao.delete(cliente)
    try:
        await confirmar(sessao)
    except IntegrityError as e:
        await sessao.rollback()
        raise RegraDeNegocio(
            "Este cliente tem negócios, orçamentos, projetos ou faturamento. Exclua esses registros antes."
        ) from e


async def relacionados(sessao: AsyncSession, id_: UUID) -> ClienteRelacionados:
    await obter(sessao, Cliente, id_, "Cliente")
    negocios = (
        await sessao.scalars(select(Negocio).where(Negocio.cliente_id == id_).order_by(Negocio.criado_em))
    ).all()
    orcs = (
        await sessao.scalars(consulta_orcamentos().where(Orcamento.cliente_id == id_).order_by(Orcamento.numero.desc()))
    ).all()
    lanc = (
        await sessao.execute(
            select(
                func.count(),
                func.coalesce(
                    func.sum(case((LancamentoReceita.status == "recebido", LancamentoReceita.valor), else_=0)), 0
                ),
            ).where(LancamentoReceita.cliente_id == id_)
        )
    ).one()
    return ClienteRelacionados(
        negocios=negocios,  # type: ignore[arg-type]
        orcamentos=[
            {"id": o.id, "numero": o.numero, "status": o.status_exibido, "total_projeto": o.total_projeto} for o in orcs
        ],  # type: ignore[arg-type]
        lancamentos=int(lanc[0]),
        recebido=lanc[1],
    )


async def _salvar(sessao: AsyncSession) -> None:
    try:
        await confirmar(sessao)
    except IntegrityError as e:
        await sessao.rollback()
        raise RegraDeNegocio("Já existe um cliente com este CNPJ.") from e
