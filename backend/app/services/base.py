"""Utilidades comuns dos serviços: carga por id, concorrência otimista e aplicação de campos."""

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.exc import StaleDataError

from app.errors import Conflito, NaoEncontrado
from app.services.escopo import traduzir_erro_de_escopo

T = TypeVar("T")

MENSAGEM_CONFLITO = (
    "Outra pessoa da equipe alterou este registro enquanto você o editava. "
    "Feche e abra de novo para ver a versão atual."
)


def conferir_versao(entidade: Any, versao: int) -> None:
    """Concorrência otimista: a versão que o cliente leu precisa ser a atual."""
    if entidade.versao != versao:
        raise Conflito(MENSAGEM_CONFLITO)


def aplicar(entidade: Any, campos: Mapping[str, Any], ignorar: tuple[str, ...] = ()) -> None:
    for nome, valor in campos.items():
        if nome not in ignorar:
            setattr(entidade, nome, valor)


async def obter(sessao: AsyncSession, modelo: type[T], id_: UUID, nome: str = "Registro", **opcoes: Any) -> T:
    entidade = await sessao.get(modelo, id_, **opcoes)
    if entidade is None:
        raise NaoEncontrado(nome)
    return entidade


async def confirmar(sessao: AsyncSession) -> None:
    """Fecha a unidade de trabalho; uma gravação concorrente vira 409 em vez de sobrescrever."""
    try:
        await sessao.commit()
    except StaleDataError as e:
        await sessao.rollback()
        raise Conflito(MENSAGEM_CONFLITO) from e
    except DBAPIError as e:  # recusa de escopo pelo banco (RLS/gatilho): vira 404/403 com mensagem clara
        traduzido = traduzir_erro_de_escopo(e)
        if traduzido is None:
            raise
        await sessao.rollback()
        raise traduzido from e
