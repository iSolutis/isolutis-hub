from datetime import date
from decimal import Decimal as D

import pytest

from app.financeiro import regras


def test_cpf_e_cnpj_com_digitos_verificadores():
    assert regras.cpf_valido("52998224725")
    assert not regras.cpf_valido("52998224724")  # dígito errado
    assert not regras.cpf_valido("11111111111")  # sequência repetida
    assert regras.cnpj_valido("11222333000181")
    assert not regras.cnpj_valido("11222333000180")
    assert not regras.cnpj_valido("00000000000000")
    assert regras.documento_valido("PF", "52998224725") and regras.documento_valido("PJ", "11222333000181")
    assert not regras.documento_valido("PJ", "52998224725")  # CPF onde se esperava CNPJ
    assert regras.so_digitos("11.222.333/0001-81") == "11222333000181"


def test_codigos_do_plano_de_contas_seguem_a_hierarquia():
    assert regras.codigo_valido("1", None) and regras.codigo_valido("12", None)
    assert not regras.codigo_valido("1.01", None)
    assert (
        regras.codigo_valido("1.01", "1")
        and not regras.codigo_valido("1.1", "1")
        and not regras.codigo_valido("2.01", "1")
    )
    assert regras.codigo_valido("1.01.001", "1.01") and not regras.codigo_valido("1.01.01", "1.01")
    assert not regras.codigo_valido("1.01.001.001", "1.01.001")  # quarto nível não existe
    assert regras.nivel_do_codigo("1.01.001") == 3


def test_proximo_codigo_e_ordenacao_numerica():
    assert regras.proximo_codigo([], None) == "1"
    assert regras.proximo_codigo(["1", "2"], None) == "3"
    assert regras.proximo_codigo([], "1") == "1.01"
    assert regras.proximo_codigo(["1.01", "1.09"], "1") == "1.10"
    assert regras.proximo_codigo(["1.01.001"], "1.01") == "1.01.002"
    codigos = ["10", "2", "1.02", "1", "1.01.001", "1.01"]
    assert sorted(codigos, key=regras.chave_de_ordenacao) == ["1", "1.01", "1.01.001", "1.02", "2", "10"]


def test_natureza_do_titulo_e_valor_devido():
    assert regras.natureza_do_titulo("P") == "D" and regras.natureza_do_titulo("R") == "R"
    assert regras.valor_devido(D("1000"), D("50"), D("10.50"), D("4.25")) == D("964.75")


# ----------------------------------------------------------------------------- parceiros em títulos
@pytest.mark.parametrize(
    ("papeis", "esperado"),
    [
        ({"fornecedor"}, True),
        ({"funcionario"}, True),
        ({"socio"}, True),
        ({"cliente", "fornecedor"}, True),
        ({"cliente"}, False),
        (set(), False),
    ],
)
def test_pagamento_exige_fornecedor_funcionario_ou_socio(papeis: set[str], esperado: bool):
    assert regras.parceiro_pode_receber_pagamento(papeis) is esperado


def test_aporte_exige_o_papel_socio():
    assert regras.parceiro_pode_aportar({"cliente", "socio"}) is True
    assert regras.parceiro_pode_aportar({"fornecedor"}) is False


# ----------------------------------------------------------------------------- recorrência: vencimentos
def _datas(
    frequencia: str,
    inicio: date,
    termino: str,
    fim: date | None = None,
    qtd: int | None = None,
    ate: date = date(2030, 1, 1),
):
    return list(regras.vencimentos(frequencia, inicio, termino, fim, qtd, ate))


def test_mensal_por_data_final_cobre_o_periodo_inteiro():
    datas = _datas("mensal", date(2026, 1, 5), "data", fim=date(2026, 12, 31))
    assert len(datas) == 12 and datas[0] == date(2026, 1, 5) and datas[-1] == date(2026, 12, 5)


def test_trimestral_vence_de_tres_em_tres_meses():
    assert _datas("trimestral", date(2026, 1, 10), "quantidade", qtd=4) == [
        date(2026, 1, 10), date(2026, 4, 10), date(2026, 7, 10), date(2026, 10, 10),
    ]  # fmt: skip


@pytest.mark.parametrize(("frequencia", "meses"), [("bimestral", 2), ("semestral", 6), ("anual", 12)])
def test_demais_frequencias_em_meses(frequencia: str, meses: int):
    a, b = _datas(frequencia, date(2026, 1, 15), "quantidade", qtd=2)
    assert (b.year * 12 + b.month) - (a.year * 12 + a.month) == meses and b.day == 15


def test_semanal_cai_sempre_no_mesmo_dia_da_semana():
    datas = _datas("semanal", date(2026, 3, 2), "quantidade", qtd=5)  # 02/03/2026 é segunda-feira
    assert {d.weekday() for d in datas} == {0} and datas[-1] == date(2026, 3, 30)


def test_quinzenal_soma_quinze_dias():
    datas = _datas("quinzenal", date(2026, 1, 1), "quantidade", qtd=3)
    assert datas == [date(2026, 1, 1), date(2026, 1, 16), date(2026, 1, 31)]


def test_dia_31_cai_no_ultimo_dia_do_mes_curto_sem_arrastar_os_seguintes():
    assert _datas("mensal", date(2026, 1, 31), "quantidade", qtd=4) == [
        date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30),
    ]  # fmt: skip
    assert regras.somar_meses(date(2024, 1, 31), 1) == date(2024, 2, 29)  # ano bissexto


def test_termino_por_quantidade_gera_exatamente_n():
    assert len(_datas("mensal", date(2026, 1, 1), "quantidade", qtd=6)) == 6


def test_termino_por_data_nao_passa_da_data_final():
    datas = _datas("mensal", date(2026, 1, 20), "data", fim=date(2026, 6, 30))
    assert datas[-1] == date(2026, 6, 20) and all(d <= date(2026, 6, 30) for d in datas)


def test_sem_fim_vai_ate_o_horizonte_e_cresce_com_ele():
    ate_a = _datas("mensal", date(2026, 1, 5), "sem_fim", ate=date(2026, 12, 31))
    ate_b = _datas("mensal", date(2026, 1, 5), "sem_fim", ate=date(2027, 3, 31))
    assert len(ate_a) == 12 and len(ate_b) == 15 and ate_b[:12] == ate_a


def test_excesso_de_ocorrencias_e_detectavel():
    muitas = _datas("semanal", date(1990, 1, 1), "sem_fim", ate=date(2030, 1, 1))
    assert len(muitas) == regras.MAXIMO_DE_OCORRENCIAS + 1


def test_horizonte_e_doze_meses_a_frente():
    assert regras.horizonte(date(2026, 10, 16)) == date(2027, 10, 16)
