"""Equipes, participantes de projeto e transferência de dono (escopo de acesso)."""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.comum import Entrada, Leitura, TextoLongo
from app.schemas.projeto import StatusEtapa


class EquipeEntrada(Entrada):
    nome: str = Field(min_length=1, max_length=100)
    lideres: list[UUID] = Field(default_factory=list, max_length=200)
    membros: list[UUID] = Field(default_factory=list, max_length=500)


class EquipeLeitura(Leitura):
    id: UUID
    nome: str
    lideres: list[UUID]
    membros: list[UUID]


class PessoaReferencia(Leitura):
    id: UUID
    nome: str


class ProjetoReferencia(Leitura):
    id: UUID
    titulo: str


class TransferenciaEntrada(Entrada):
    entidade: Literal["cliente", "negocio", "projeto", "tarefa"]
    id: UUID
    para: UUID | None = Field(description="Novo dono; nulo deixa o registro sem dono (só líder/admin).")


class ParticipanteEntrada(Entrada):
    usuario_id: UUID


class EtapaAtualizacao(Entrada):
    """O que o responsável de uma etapa altera nela, sem precisar editar o projeto inteiro."""

    versao: int | None = Field(None, ge=1, description="Versão lida; se informada, protege contra edição concorrente.")
    status: StatusEtapa
    inicio: date | None = None
    fim: date | None = None
    descricao: TextoLongo = None
    entregaveis: TextoLongo = None

    @model_validator(mode="after")
    def _datas(self) -> "EtapaAtualizacao":
        if self.inicio and self.fim and self.fim < self.inicio:
            raise ValueError("O término não pode ser antes do início.")
        return self
