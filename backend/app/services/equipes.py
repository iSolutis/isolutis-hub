"""Equipes da empresa ativa (administração) e operações de escopo: transferência de dono e participantes."""

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import NaoEncontrado, RegraDeNegocio
from app.models import (
    Equipe,
    EquipeLider,
    EquipeMembro,
    Negocio,
    Parceiro,
    Projeto,
    ProjetoEtapa,
    ProjetoParticipante,
    Tarefa,
    UsuarioEmpresa,
)
from app.schemas.escopo import EquipeEntrada, EquipeLeitura, EtapaAtualizacao, TransferenciaEntrada
from app.services import escopo
from app.services.base import aplicar, conferir_versao, confirmar, obter

MODELOS_COM_DONO = {"cliente": Parceiro, "negocio": Negocio, "projeto": Projeto, "tarefa": Tarefa}


async def _leitura(sessao: AsyncSession, equipe: Equipe) -> EquipeLeitura:
    lideres = (await sessao.scalars(select(EquipeLider.usuario_id).where(EquipeLider.equipe_id == equipe.id))).all()
    membros = (await sessao.scalars(select(EquipeMembro.usuario_id).where(EquipeMembro.equipe_id == equipe.id))).all()
    return EquipeLeitura(
        id=equipe.id, nome=equipe.nome, lideres=sorted(lideres, key=str), membros=sorted(membros, key=str)
    )


async def listar(sessao: AsyncSession, empresa_id: UUID) -> list[EquipeLeitura]:
    equipes = (await sessao.scalars(select(Equipe).where(Equipe.empresa_id == empresa_id).order_by(Equipe.nome))).all()
    return [await _leitura(sessao, e) for e in equipes]


async def _exigir_pessoas_da_empresa(sessao: AsyncSession, empresa_id: UUID, ids: set[UUID]) -> None:
    if not ids:
        return
    achadas = set(
        (
            await sessao.scalars(
                select(UsuarioEmpresa.usuario_id).where(
                    UsuarioEmpresa.empresa_id == empresa_id, UsuarioEmpresa.usuario_id.in_(ids)
                )
            )
        ).all()
    )
    if ids - achadas:
        raise RegraDeNegocio("Escolha apenas pessoas da equipe da empresa.")


async def _gravar(sessao: AsyncSession, empresa_id: UUID, equipe: Equipe, dados: EquipeEntrada) -> EquipeLeitura:
    lideres, membros = set(dados.lideres), set(dados.membros)
    if not lideres:
        raise RegraDeNegocio("Escolha pelo menos um líder para a equipe.")
    await _exigir_pessoas_da_empresa(sessao, empresa_id, lideres | membros)
    equipe.nome = dados.nome.strip()
    await sessao.flush()
    await sessao.execute(delete(EquipeLider).where(EquipeLider.equipe_id == equipe.id))
    await sessao.execute(delete(EquipeMembro).where(EquipeMembro.equipe_id == equipe.id))
    sessao.add_all(
        EquipeLider(equipe_id=equipe.id, usuario_id=u, empresa_id=empresa_id) for u in sorted(lideres, key=str)
    )
    sessao.add_all(
        EquipeMembro(equipe_id=equipe.id, usuario_id=u, empresa_id=empresa_id) for u in sorted(membros, key=str)
    )
    try:
        await confirmar(sessao)
    except IntegrityError as e:
        await sessao.rollback()
        raise RegraDeNegocio("Já existe uma equipe com este nome.") from e
    return await _leitura(sessao, equipe)


async def criar(sessao: AsyncSession, empresa_id: UUID, dados: EquipeEntrada) -> EquipeLeitura:
    equipe = Equipe(empresa_id=empresa_id, nome=dados.nome.strip())
    sessao.add(equipe)
    return await _gravar(sessao, empresa_id, equipe, dados)


async def atualizar(sessao: AsyncSession, empresa_id: UUID, id_: UUID, dados: EquipeEntrada) -> EquipeLeitura:
    return await _gravar(sessao, empresa_id, await obter(sessao, Equipe, id_, "Equipe"), dados)


async def excluir(sessao: AsyncSession, id_: UUID) -> None:
    await sessao.delete(await obter(sessao, Equipe, id_, "Equipe"))
    await confirmar(sessao)


# ------------------------------------------------------------------------------------------- dono e participantes
async def transferir(sessao: AsyncSession, dados: TransferenciaEntrada) -> None:
    """Troca o dono; o banco confere a regra (líder dentro da árvore, admin em qualquer caso) e registra."""
    registro = await obter(sessao, MODELOS_COM_DONO[dados.entidade], dados.id, escopo.nome_da_entidade(dados.entidade))
    registro.responsavel_id = dados.para
    await confirmar(sessao)


async def participantes(sessao: AsyncSession, projeto_id: UUID) -> list[UUID]:
    await obter(sessao, Projeto, projeto_id, "Projeto")
    q = select(ProjetoParticipante.usuario_id).where(ProjetoParticipante.projeto_id == projeto_id)
    return sorted((await sessao.scalars(q)).all(), key=str)


async def incluir_participante(
    sessao: AsyncSession, empresa_id: UUID, projeto_id: UUID, usuario_id: UUID
) -> list[UUID]:
    await obter(sessao, Projeto, projeto_id, "Projeto")
    await escopo.exigir_edicao(sessao, "projeto", projeto_id)
    await _exigir_pessoas_da_empresa(sessao, empresa_id, {usuario_id})
    if await sessao.get(ProjetoParticipante, (projeto_id, usuario_id)) is None:
        sessao.add(ProjetoParticipante(projeto_id=projeto_id, usuario_id=usuario_id, empresa_id=empresa_id))
        await confirmar(sessao)
    return await participantes(sessao, projeto_id)


async def retirar_participante(sessao: AsyncSession, projeto_id: UUID, usuario_id: UUID) -> list[UUID]:
    await obter(sessao, Projeto, projeto_id, "Projeto")
    await escopo.exigir_edicao(sessao, "projeto", projeto_id)
    participante = await sessao.get(ProjetoParticipante, (projeto_id, usuario_id))
    if participante is None:
        raise NaoEncontrado("Participante")
    await sessao.delete(participante)
    await confirmar(sessao)
    return await participantes(sessao, projeto_id)


async def atualizar_etapa(sessao: AsyncSession, projeto_id: UUID, etapa_id: UUID, dados: EtapaAtualizacao) -> None:
    etapa = await obter(sessao, ProjetoEtapa, etapa_id, "Etapa")
    if etapa.projeto_id != projeto_id:
        raise NaoEncontrado("Etapa")
    await escopo.exigir_edicao(sessao, "etapa", etapa_id)
    if dados.versao is not None:
        conferir_versao(etapa, dados.versao)
    aplicar(etapa, dados.model_dump(), ignorar=("versao",))
    await confirmar(sessao)
