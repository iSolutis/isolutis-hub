from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BeforeValidator, Field

from app.schemas.comum import Auditoria, Dinheiro, Entrada, Leitura, Texto, TextoLongo, TextoOpcional, so_digitos

Origem = Literal["Site", "Indicação", "LinkedIn", "Instagram", "WhatsApp", "Evento", "Prospecção ativa", "Outro"]


def _validar_cnpj(v: str | None) -> str | None:
    if not v:
        return None
    if len(v) != 14:
        raise ValueError("O CNPJ deve ter 14 dígitos.")
    return v


Cnpj = Annotated[str | None, BeforeValidator(so_digitos), AfterValidator(_validar_cnpj)]


class ClienteEntrada(Entrada):
    nome: Texto
    cnpj: Cnpj = None
    segmento: TextoOpcional = None
    contato: TextoOpcional = None
    cargo: TextoOpcional = None
    telefone: TextoOpcional = None
    email: TextoOpcional = None
    cidade: TextoOpcional = None
    origem: Origem | None = None
    obs: TextoLongo = None


class ClienteAtualizar(ClienteEntrada):
    versao: int = Field(ge=1)


class ClienteLeitura(Auditoria):
    nome: str
    cnpj: str | None
    segmento: str | None
    contato: str | None
    cargo: str | None
    telefone: str | None
    email: str | None
    cidade: str | None
    origem: str | None
    obs: str | None


class ClienteResumo(ClienteLeitura):
    """Linha da lista de clientes, com os números que a tabela mostra."""

    negocios_abertos: int
    faturado: Dinheiro


class RelNegocio(Leitura):
    id: UUID
    titulo: str
    etapa: str
    valor: Dinheiro
    mensal: Dinheiro


class RelOrcamento(Leitura):
    id: UUID
    numero: str
    status: str
    total_projeto: Dinheiro


class ClienteRelacionados(Leitura):
    negocios: list[RelNegocio]
    orcamentos: list[RelOrcamento]
    lancamentos: int
    recebido: Dinheiro
