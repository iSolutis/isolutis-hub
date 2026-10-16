"""Cadastro completo da empresa ativa e identidade visual (logomarca e paleta de cores)."""

import re
from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

TipoInscricao = Literal["CNPJ", "CPF"]
RegimeTributario = Literal["mei", "simples_nacional", "lucro_presumido", "lucro_real"]

_COR = re.compile(r"^#[0-9a-fA-F]{6}$")


def _vazio_para_none(valor: object) -> object:
    if isinstance(valor, str):
        valor = valor.strip()
        return valor or None
    return valor


def _so_digitos(valor: object) -> object:
    if isinstance(valor, str):
        return re.sub(r"\D", "", valor) or None
    return valor


class Paleta(BaseModel):
    """Duas cores escolhidas; a interface deriva os demais tons (claro e escuro) a partir delas."""

    primaria: str = Field(description="Cor principal (barra lateral, botões), #rrggbb")
    destaque: str = Field(description="Cor de destaque (seleção, links, gráficos), #rrggbb")

    @field_validator("primaria", "destaque")
    @classmethod
    def _cor_hex(cls, v: str) -> str:
        if not _COR.match(v):
            raise ValueError("Use uma cor no formato #rrggbb.")
        return v.lower()


class EmpresaDados(BaseModel):
    """Campos editáveis do cadastro (o que a tela "Dados da empresa" envia)."""

    nome: str = Field(min_length=1, max_length=150, description="Nome de exibição no Hub")
    tipo_inscricao: TipoInscricao | None = None
    inscricao: str | None = Field(default=None, max_length=18)
    razao_social: str | None = Field(default=None, max_length=150)
    nome_fantasia: str | None = Field(default=None, max_length=150)
    inscricao_estadual: str | None = Field(default=None, max_length=20)
    inscricao_municipal: str | None = Field(default=None, max_length=20)
    cnae_codigo: str | None = Field(default=None, max_length=10)
    cnae_descricao: str | None = Field(default=None, max_length=200)
    regime_tributario: RegimeTributario | None = None
    data_abertura: date | None = None
    email: EmailStr | None = Field(default=None, max_length=150)
    telefone: str | None = Field(default=None, max_length=20)
    site: str | None = Field(default=None, max_length=150)
    cep: str | None = Field(default=None, max_length=9)
    logradouro: str | None = Field(default=None, max_length=150)
    numero: str | None = Field(default=None, max_length=20)
    complemento: str | None = Field(default=None, max_length=100)
    bairro: str | None = Field(default=None, max_length=100)
    municipio_id: UUID | None = None

    _vazios = field_validator(
        "nome", "tipo_inscricao", "razao_social", "nome_fantasia", "inscricao_estadual", "inscricao_municipal",
        "cnae_codigo", "cnae_descricao", "regime_tributario", "email", "telefone", "site", "logradouro", "numero",
        "complemento", "bairro", "data_abertura", "municipio_id", mode="before",
    )(_vazio_para_none)  # fmt: skip
    _digitos = field_validator("inscricao", "cep", mode="before")(_so_digitos)

    @field_validator("cep")
    @classmethod
    def _cep(cls, v: str | None) -> str | None:
        if v is not None and len(v) != 8:
            raise ValueError("O CEP tem 8 dígitos.")
        return v


class EmpresaLeitura(EmpresaDados):
    id: UUID
    segmento: str | None = None
    uf: str | None = Field(default=None, description="UF do município do endereço")
    logo: str | None = Field(default=None, description="Logomarca como data URL (data:image/...;base64,...)")
    paleta: Paleta | None = None


class LogoEntrada(BaseModel):
    imagem: str = Field(description="Imagem PNG, JPEG ou WebP como data URL ou base64 puro (até 512 KB)")
