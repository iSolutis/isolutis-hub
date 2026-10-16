"""Regras puras do módulo financeiro (sem banco, sem HTTP)."""

import calendar
import re
from collections.abc import Iterator
from datetime import date, timedelta
from decimal import Decimal

from app.domain.dinheiro import centavos

NIVEL_MAXIMO = 3
# Largura do último segmento do código em cada nível: 1 · 1.01 · 1.01.001
LARGURA_SEGMENTO = {2: 2, 3: 3}


# ----------------------------------------------------------------------------- documentos
def so_digitos(valor: str | None) -> str:
    return re.sub(r"\D", "", valor or "")


def _digito(base: str, pesos: list[int]) -> int:
    resto = sum(int(d) * p for d, p in zip(base, pesos, strict=True)) % 11
    return 0 if resto < 2 else 11 - resto


def cpf_valido(cpf: str) -> bool:
    if len(cpf) != 11 or len(set(cpf)) == 1:
        return False
    d1 = _digito(cpf[:9], list(range(10, 1, -1)))
    d2 = _digito(cpf[:9] + str(d1), list(range(11, 1, -1)))
    return cpf[9:] == f"{d1}{d2}"


def cnpj_valido(cnpj: str) -> bool:
    if len(cnpj) != 14 or len(set(cnpj)) == 1:
        return False
    d1 = _digito(cnpj[:12], [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    d2 = _digito(cnpj[:12] + str(d1), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    return cnpj[12:] == f"{d1}{d2}"


def documento_valido(tipo_pessoa: str, documento: str) -> bool:
    return cpf_valido(documento) if tipo_pessoa == "PF" else cnpj_valido(documento)


# ----------------------------------------------------------------------------- plano de contas
def nivel_do_codigo(codigo: str) -> int:
    return codigo.count(".") + 1


def mensagem_codigo_invalido(nivel: int, pai_codigo: str | None) -> str:
    if nivel == 1:
        return "O código de uma conta de primeiro nível deve ser um número (ex.: 1)."
    largura = LARGURA_SEGMENTO[nivel]
    exemplo = f"{pai_codigo}.{'1'.zfill(largura)}"
    return f"O código deve ser o do pai seguido de ponto e {largura} dígitos (ex.: {exemplo})."


def codigo_valido(codigo: str, pai_codigo: str | None) -> bool:
    """RN01: 1 · 1.01 · 1.01.001 — o filho carrega o código do pai e um segmento de largura fixa."""
    if pai_codigo is None:
        return re.fullmatch(r"\d+", codigo) is not None
    nivel = nivel_do_codigo(pai_codigo) + 1
    if nivel > NIVEL_MAXIMO:
        return False
    segmento = LARGURA_SEGMENTO[nivel]
    return re.fullmatch(rf"{re.escape(pai_codigo)}\.\d{{{segmento}}}", codigo) is not None


def chave_de_ordenacao(codigo: str) -> tuple[int, ...]:
    """Ordena 1, 1.01, 1.01.001, 1.02, 2 ... numericamente (e não como texto)."""
    return tuple(int(p) for p in codigo.split("."))


def proximo_codigo(codigos_irmaos: list[str], pai_codigo: str | None) -> str:
    """Sugere o próximo código livre entre os filhos de `pai_codigo` (ou entre as raízes)."""
    ultimos = [int(c.split(".")[-1]) for c in codigos_irmaos]
    n = max(ultimos, default=0) + 1
    if pai_codigo is None:
        return str(n)
    largura = LARGURA_SEGMENTO[nivel_do_codigo(pai_codigo) + 1]
    return f"{pai_codigo}.{str(n).zfill(largura)}"


# ----------------------------------------------------------------------------- títulos
def natureza_do_titulo(tipo_titulo: str) -> str:
    """RN04: conta a pagar usa conta de despesa; a receber usa conta de receita."""
    return "D" if tipo_titulo == "P" else "R"


# Quem pode receber um pagamento da empresa: fornecedor, funcionário (salário) ou sócio (retirada, distribuição).
PAPEIS_QUE_RECEBEM_PAGAMENTO = frozenset({"fornecedor", "funcionario", "socio"})


def parceiro_pode_receber_pagamento(papeis: set[str]) -> bool:
    """Título a pagar exige um parceiro que seja fornecedor, funcionário ou sócio (não só cliente)."""
    return bool(PAPEIS_QUE_RECEBEM_PAGAMENTO & papeis)


def parceiro_pode_aportar(papeis: set[str]) -> bool:
    """Título numa conta de aporte exige um parceiro com o papel de sócio."""
    return "socio" in papeis


def valor_devido(valor: Decimal, desconto: Decimal, multa: Decimal, juros: Decimal) -> Decimal:
    return centavos(valor - desconto + multa + juros)


# ----------------------------------------------------------------------------- recorrência
# Passo de cada frequência: dias (semanal, quinzenal) ou meses (as demais).
DIAS_POR_FREQUENCIA = {"semanal": 7, "quinzenal": 15}
MESES_POR_FREQUENCIA = {"mensal": 1, "bimestral": 2, "trimestral": 3, "semestral": 6, "anual": 12}
FREQUENCIAS = (*DIAS_POR_FREQUENCIA, *MESES_POR_FREQUENCIA)
# Teto de ocorrências de uma recorrência: protege contra datas absurdas (início em 1900, "semanal" por 50 anos).
MAXIMO_DE_OCORRENCIAS = 600
HORIZONTE_EM_MESES = 12


def somar_meses(base: date, meses: int) -> date:
    """`base` + `meses`, mantendo o dia; se o mês de chegada é mais curto, cai no último dia dele (31/01 -> 28/02)."""
    indice = base.year * 12 + (base.month - 1) + meses
    ano, mes = divmod(indice, 12)
    mes += 1
    return date(ano, mes, min(base.day, calendar.monthrange(ano, mes)[1]))


def ocorrencia(frequencia: str, inicio: date, n: int) -> date:
    """Vencimento da n-ésima ocorrência (0 = a de início). Sempre calculado a partir do início, nunca da anterior,
    para que um mês curto não arraste os seguintes (31/01, 28/02, 31/03...)."""
    if frequencia in DIAS_POR_FREQUENCIA:
        return inicio + timedelta(days=DIAS_POR_FREQUENCIA[frequencia] * n)
    return somar_meses(inicio, MESES_POR_FREQUENCIA[frequencia] * n)


def vencimentos(
    frequencia: str, inicio: date, termino: str, data_fim: date | None, quantidade: int | None, ate: date
) -> Iterator[date]:
    """Vencimentos da recorrência em ordem. Término `data` e `quantidade` valem por inteiro (ignoram `ate`);
    `sem_fim` vai até `ate`. Para por segurança em MAXIMO_DE_OCORRENCIAS + 1 (quem chama detecta o excesso)."""
    n = 0
    while n <= MAXIMO_DE_OCORRENCIAS:
        dia = ocorrencia(frequencia, inicio, n)
        if termino == "quantidade" and n >= (quantidade or 0):
            return
        if termino == "data" and data_fim is not None and dia > data_fim:
            return
        if termino == "sem_fim" and dia > ate:
            return
        yield dia
        n += 1


def horizonte(hoje: date) -> date:
    """Até onde uma recorrência sem fim tem títulos gerados."""
    return somar_meses(hoje, HORIZONTE_EM_MESES)
