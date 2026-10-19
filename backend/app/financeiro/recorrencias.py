"""Recorrências de títulos: modelo de uma despesa/receita que se repete e a geração dos títulos reais.

Os títulos gerados são linhas comuns de `titulo_financeiro` (com `recorrencia_id`), então fluxo de caixa,
quitação e relatórios não precisam saber de recorrência. Regras:
- término por data ou por quantidade gera todas as ocorrências na hora; `sem_fim` mantém um horizonte móvel
  (renovado por `renovar_horizonte`, chamado pelo scheduler);
- `gerado_ate` guarda o último vencimento criado: a renovação só cria os seguintes, então um título apagado à
  mão não reaparece;
- editar, pausar ou encerrar só mexe em títulos futuros ainda abertos; quitados e cancelados nunca são tocados.
"""

import logging
from collections.abc import Callable
from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.db import definir_empresa_da_transacao
from app.domain.datas import hoje
from app.errors import NaoEncontrado, RegraDeNegocio
from app.financeiro import regras
from app.financeiro import servicos as titulos
from app.financeiro.models import RecorrenciaTitulo, TituloFinanceiro
from app.financeiro.schemas import RecorrenciaAtualizar, RecorrenciaEntrada, TituloEntrada
from app.models import Empresa
from app.services.base import confirmar

logger = logging.getLogger(__name__)

MENSAGEM_ENCERRADA = "Esta recorrência já foi encerrada."


# ----------------------------------------------------------------------------- consulta
def _consulta(empresa: Empresa):  # noqa: ANN202
    return (
        select(RecorrenciaTitulo)
        .options(
            joinedload(RecorrenciaTitulo.conta_bancaria),
            joinedload(RecorrenciaTitulo.plano_conta),
            joinedload(RecorrenciaTitulo.parceiro),
        )
        .where(RecorrenciaTitulo.empresa_id == empresa.id)
    )


async def _leituras(sessao: AsyncSession, recorrencias: list[RecorrenciaTitulo]) -> list[dict]:
    if not recorrencias:
        return []
    t = TituloFinanceiro
    ids = [r.id for r in recorrencias]
    linhas = await sessao.execute(
        select(
            t.recorrencia_id,
            func.count(),
            func.count().filter(t.status == "A"),
            func.min(t.data_vencimento).filter(t.status == "A", t.data_vencimento >= hoje()),
        )
        .where(t.recorrencia_id.in_(ids))
        .group_by(t.recorrencia_id)
    )
    totais = {rid: (gerados, abertos, proximo) for rid, gerados, abertos, proximo in linhas.all()}
    saida = []
    for r in recorrencias:
        gerados, abertos, proximo = totais.get(r.id, (0, 0, None))
        saida.append({
            "id": r.id, "tipo_conta": r.tipo_conta, "conta_bancaria_id": r.conta_bancaria_id,
            "conta_bancaria_nome": r.conta_bancaria.nome, "plano_conta_id": r.plano_conta_id,
            "plano_conta_codigo": r.plano_conta.codigo, "plano_conta_nome": r.plano_conta.nome,
            "parceiro_id": r.parceiro_id, "parceiro_nome": r.parceiro.nome, "valor_titulo": r.valor_titulo,
            "anotacao": r.anotacao, "frequencia": r.frequencia, "data_inicio": r.data_inicio, "termino": r.termino,
            "data_fim": r.data_fim, "quantidade": r.quantidade, "ativa": r.ativa, "encerrada_em": r.encerrada_em,
            "titulos_gerados": gerados, "titulos_abertos": abertos, "proximo_vencimento": proximo,
        })  # fmt: skip
    return saida


async def listar(sessao: AsyncSession, empresa: Empresa) -> list[dict]:
    consulta = _consulta(empresa).order_by(RecorrenciaTitulo.created_at.desc(), RecorrenciaTitulo.id)
    return await _leituras(sessao, list((await sessao.scalars(consulta)).unique().all()))


async def _carregar(sessao: AsyncSession, empresa: Empresa, id_: UUID) -> RecorrenciaTitulo:
    consulta = _consulta(empresa).where(RecorrenciaTitulo.id == id_).execution_options(populate_existing=True)
    recorrencia = (await sessao.scalars(consulta)).unique().first()
    if recorrencia is None:
        raise NaoEncontrado("Recorrência")
    return recorrencia


async def obter(sessao: AsyncSession, empresa: Empresa, id_: UUID) -> dict:
    return (await _leituras(sessao, [await _carregar(sessao, empresa, id_)]))[0]


# ----------------------------------------------------------------------------- geração
def _datas(r: RecorrenciaTitulo, ate: date) -> list[date]:
    datas = list(regras.vencimentos(r.frequencia, r.data_inicio, r.termino, r.data_fim, r.quantidade, ate))
    if len(datas) > regras.MAXIMO_DE_OCORRENCIAS:
        raise RegraDeNegocio(
            f"Esta recorrência geraria mais de {regras.MAXIMO_DE_OCORRENCIAS} títulos. "
            "Reduza o período, use uma frequência maior ou informe um início mais recente."
        )
    return datas


async def _bloquear(sessao: AsyncSession, id_: UUID) -> None:
    """Serializa a geração da mesma recorrência (job e usuário) até o fim da transação."""
    await sessao.execute(text("select pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": f"recorrencia:{id_}"})


async def _gerar(sessao: AsyncSession, r: RecorrenciaTitulo) -> int:
    """Cria os títulos que faltam, depois de `gerado_ate`, até o fim do término (ou do horizonte, se sem fim)."""
    await _bloquear(sessao, r.id)
    novos = [d for d in _datas(r, regras.horizonte(hoje())) if r.gerado_ate is None or d > r.gerado_ate]
    for vencimento in novos:
        sessao.add(
            TituloFinanceiro(
                empresa_id=r.empresa_id, tipo_conta=r.tipo_conta, conta_bancaria_id=r.conta_bancaria_id,
                plano_conta_id=r.plano_conta_id, parceiro_id=r.parceiro_id, data_vencimento=vencimento,
                valor_titulo=r.valor_titulo, anotacao=r.anotacao, status="A", recorrencia_id=r.id,
            )
        )  # fmt: skip
    if novos:
        r.gerado_ate = novos[-1]
    return len(novos)


def _futuros_abertos(r: RecorrenciaTitulo):  # noqa: ANN202
    return (
        TituloFinanceiro.recorrencia_id == r.id,
        TituloFinanceiro.status == "A",
        TituloFinanceiro.data_vencimento >= hoje(),
    )


# ----------------------------------------------------------------------------- validação
async def _validar_modelo(
    sessao: AsyncSession, empresa: Empresa, tipo_conta: str, d: RecorrenciaAtualizar, vencimento: date
) -> None:
    """As mesmas regras de um título (RN03/RN04, papéis do parceiro, aporte) valem para o modelo."""
    await titulos._campos_validados(
        sessao,
        empresa,
        TituloEntrada(
            tipo_conta=tipo_conta, conta_bancaria_id=d.conta_bancaria_id, plano_conta_id=d.plano_conta_id,
            parceiro_id=d.parceiro_id, data_vencimento=vencimento, valor_titulo=d.valor_titulo, anotacao=d.anotacao,
        ),
    )  # fmt: skip


_CAMPOS_EDITAVEIS = ("conta_bancaria_id", "plano_conta_id", "parceiro_id", "valor_titulo", "anotacao")
_CAMPOS_DE_TERMINO = ("termino", "data_fim", "quantidade")


# ----------------------------------------------------------------------------- operações
async def criar(sessao: AsyncSession, empresa: Empresa, d: RecorrenciaEntrada) -> dict:
    await _validar_modelo(sessao, empresa, d.tipo_conta, d, d.data_inicio)
    r = RecorrenciaTitulo(empresa_id=empresa.id, **d.model_dump())
    _datas(r, regras.horizonte(hoje()))  # recusa cedo uma recorrência grande demais
    sessao.add(r)
    await sessao.flush()
    await _gerar(sessao, r)
    await confirmar(sessao)
    return await obter(sessao, empresa, r.id)


async def atualizar(sessao: AsyncSession, empresa: Empresa, id_: UUID, d: RecorrenciaAtualizar) -> dict:
    r = await _carregar(sessao, empresa, id_)
    if r.encerrada_em:
        raise RegraDeNegocio(MENSAGEM_ENCERRADA)
    await _validar_modelo(sessao, empresa, r.tipo_conta, d, max(r.data_inicio, hoje()))
    await _bloquear(sessao, r.id)
    for campo in (*_CAMPOS_EDITAVEIS, *_CAMPOS_DE_TERMINO):
        setattr(r, campo, getattr(d, campo))
    validos = set(_datas(r, regras.horizonte(hoje())))
    # Os títulos futuros em aberto acompanham o modelo; se o término encolheu, os que sobram saem.
    for titulo in (await sessao.scalars(select(TituloFinanceiro).where(*_futuros_abertos(r)))).all():
        if r.termino != "sem_fim" and titulo.data_vencimento not in validos:
            await sessao.delete(titulo)
            continue
        for campo in _CAMPOS_EDITAVEIS:
            setattr(titulo, campo, getattr(r, campo))
    if r.ativa:
        await _gerar(sessao, r)
    await confirmar(sessao)
    return await obter(sessao, empresa, id_)


async def pausar(sessao: AsyncSession, empresa: Empresa, id_: UUID) -> dict:
    r = await _carregar(sessao, empresa, id_)
    if r.encerrada_em:
        raise RegraDeNegocio(MENSAGEM_ENCERRADA)
    r.ativa = False
    await confirmar(sessao)
    return await obter(sessao, empresa, id_)


async def retomar(sessao: AsyncSession, empresa: Empresa, id_: UUID) -> dict:
    """Volta a gerar a partir de hoje: o que venceria durante a pausa não é criado retroativamente."""
    r = await _carregar(sessao, empresa, id_)
    if r.encerrada_em:
        raise RegraDeNegocio(MENSAGEM_ENCERRADA)
    r.ativa = True
    ontem = hoje() - timedelta(days=1)
    r.gerado_ate = max(r.gerado_ate, ontem) if r.gerado_ate else ontem
    await _gerar(sessao, r)
    await confirmar(sessao)
    return await obter(sessao, empresa, id_)


async def encerrar(sessao: AsyncSession, empresa: Empresa, id_: UUID) -> dict:
    r = await _carregar(sessao, empresa, id_)
    if r.encerrada_em:
        raise RegraDeNegocio(MENSAGEM_ENCERRADA)
    await _bloquear(sessao, r.id)
    await sessao.execute(delete(TituloFinanceiro).where(*_futuros_abertos(r)))
    r.ativa, r.encerrada_em = False, datetime.now().astimezone()
    await confirmar(sessao)
    return await obter(sessao, empresa, id_)


# ----------------------------------------------------------------------------- job de renovação
async def _renovar_uma(sessao: AsyncSession, recorrencia_id: UUID) -> int:
    r = await sessao.get(RecorrenciaTitulo, recorrencia_id)
    if r is None or not r.ativa or r.encerrada_em or r.termino != "sem_fim":
        return 0
    criados = await _gerar(sessao, r)
    await confirmar(sessao)
    return criados


async def renovar_horizonte(fabrica_de_sessoes: Callable[[], AsyncSession]) -> int:
    """Completa os títulos das recorrências sem fim até o horizonte. Idempotente: rodar de novo não duplica.

    Roda fora de qualquer requisição, então enumera as recorrências por uma função do banco (que atravessa a RLS)
    e gera cada uma dentro do contexto da sua empresa; o erro de uma não impede as demais.
    """
    async with fabrica_de_sessoes() as sessao:
        pares = (await sessao.execute(text("select id, empresa_id from recorrencias_para_renovar()"))).all()
    total = 0
    for recorrencia_id, empresa_id in pares:
        try:
            async with fabrica_de_sessoes() as sessao:
                await definir_empresa_da_transacao(sessao, empresa_id)
                total += await _renovar_uma(sessao, recorrencia_id)
        except Exception:
            logger.exception("Erro ao renovar a recorrência %s (empresa %s).", recorrencia_id, empresa_id)
    return total
