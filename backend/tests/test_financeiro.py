from datetime import date

from httpx import AsyncClient

API = "/api/v1"
ANO = date.today().year


async def test_lancamento_unico_e_serie_mensal(api: AsyncClient, novo_cliente):
    c = await novo_cliente()
    base = {
        "cliente_id": c["id"],
        "tipo": "mensal",
        "descricao": "Manutenção",
        "valor": 800,
        "vencimento": f"{ANO}-01-31",
    }
    r = await api.post(f"{API}/faturamento", json={**base, "repetir": 3, "status": "recebido"})
    assert r.status_code == 201
    serie = r.json()
    assert [x["descricao"] for x in serie] == ["Manutenção · 1/3", "Manutenção · 2/3", "Manutenção · 3/3"]
    assert [x["vencimento"] for x in serie] == [
        f"{ANO}-01-31",
        f"{ANO}-02-28" if ANO % 4 else f"{ANO}-02-29",
        f"{ANO}-03-31",
    ]
    assert [x["status"] for x in serie] == ["recebido", "previsto", "previsto"]  # só a primeira herda o status
    assert serie[0]["recebido_em"] and serie[1]["recebido_em"] is None
    assert len({x["grupo_id"] for x in serie}) == 1 and [x["parcela"] for x in serie] == [1, 2, 3]

    unico = (await api.post(f"{API}/faturamento", json={**base, "descricao": "Avulso"})).json()[0]
    assert unico["grupo_id"] is None and unico["parcela"] is None


async def test_lote_de_venda_fechada_parcela_sem_perder_centavos(api: AsyncClient, novo_cliente):
    c = await novo_cliente()
    r = await api.post(
        f"{API}/faturamento/lote",
        json={
            "cliente_id": c["id"],
            "titulo": "Portal",
            "projeto": {"valor": 100, "parcelas": 3, "primeiro_vencimento": f"{ANO}-03-10"},
            "mensal": {"valor": 800, "meses": 2, "primeira_mensalidade": f"{ANO}-04-10"},
        },
    )
    assert r.status_code == 201, r.text
    lancs = r.json()
    projeto = [x for x in lancs if x["tipo"] == "projeto"]
    assert [x["valor"] for x in projeto] == [33.33, 33.33, 33.34] and sum(x["valor"] for x in projeto) == 100
    assert projeto[0]["descricao"] == "Portal · parcela 1/3"
    mensais = [x for x in lancs if x["tipo"] == "mensal"]
    assert [x["descricao"] for x in mensais] == ["Manutenção mensal · Portal · 1/2", "Manutenção mensal · Portal · 2/2"]
    assert all(x["status"] == "previsto" for x in lancs)
    # séries distintas por tipo
    assert projeto[0]["grupo_id"] != mensais[0]["grupo_id"]

    assert (await api.post(f"{API}/faturamento/lote", json={"cliente_id": c["id"]})).status_code == 422


async def test_lote_marca_negocio_como_faturado(api: AsyncClient, novo_cliente):
    c = await novo_cliente()
    n = (await api.post(f"{API}/negocios", json={"titulo": "P", "cliente_id": c["id"]})).json()
    await api.post(
        f"{API}/faturamento/lote",
        json={
            "cliente_id": c["id"],
            "negocio_id": n["id"],
            "projeto": {"valor": 50, "primeiro_vencimento": f"{ANO}-05-01"},
        },
    )
    assert (await api.get(f"{API}/negocios")).json()[0]["faturado"] is True


async def test_receber_editar_e_resumo(api: AsyncClient, novo_cliente):
    c = await novo_cliente()
    mk = lambda mes, valor, tipo="projeto": {  # noqa: E731
        "cliente_id": c["id"],
        "tipo": tipo,
        "descricao": f"L{mes}",
        "valor": valor,
        "vencimento": f"{ANO}-{mes:02d}-10",
    }
    a = (await api.post(f"{API}/faturamento", json=mk(1, 1000))).json()[0]
    await api.post(f"{API}/faturamento", json=mk(1, 200, "mensal"))
    await api.post(f"{API}/faturamento", json=mk(2, 500))

    r = await api.post(f"{API}/faturamento/{a['id']}/receber")
    assert r.json()["status"] == "recebido" and r.json()["recebido_em"] == date.today().isoformat()

    resumo = (await api.get(f"{API}/faturamento/resumo", params={"ano": ANO})).json()
    jan, fev = resumo["meses"][0], resumo["meses"][1]
    assert (jan["recebido"], jan["previsto"], jan["recorrente"], jan["quantidade"]) == (1000, 200, 200, 2)
    assert (fev["recebido"], fev["previsto"]) == (0, 500)
    assert resumo["total_recebido"] == 1000 and resumo["total_previsto"] == 700 and ANO in resumo["anos_disponiveis"]
    assert len(resumo["meses"]) == 12

    # voltar para previsto limpa a data de recebimento (regra também garantida por CHECK)
    corpo = {k: a[k] for k in ("cliente_id", "tipo", "descricao", "valor", "vencimento", "nf")} | {"status": "previsto"}
    r = await api.put(f"{API}/faturamento/{a['id']}", json={**corpo, "versao": r.json()["versao"]})
    assert r.json()["recebido_em"] is None

    jan_lista = (await api.get(f"{API}/faturamento", params={"ano": ANO, "mes": 1})).json()
    assert len(jan_lista) == 2


async def test_exportar_csv(api: AsyncClient, novo_cliente):
    c = await novo_cliente("Acme; Ltda")
    await api.post(
        f"{API}/faturamento",
        json={
            "cliente_id": c["id"],
            "tipo": "projeto",
            "descricao": 'Parcela "única"',
            "valor": 1234.5,
            "vencimento": f"{ANO}-06-05",
            "nf": "NF-1",
        },
    )
    r = await api.get(f"{API}/faturamento/exportar", params={"ano": ANO})
    assert r.status_code == 200 and r.text.startswith("﻿")
    linhas = r.text.lstrip("﻿").split("\r\n")
    assert linhas[0] == '"Data";"Cliente";"Descrição";"Tipo";"Situação";"Valor";"Nota fiscal"'
    assert (
        linhas[1] == f'"05/06/{ANO}";"Acme; Ltda";"Parcela ""única""";"Projeto sob medida";"Previsto";"1234,50";"NF-1"'
    )


async def _categoria(api: AsyncClient) -> str:
    return (await api.get(f"{API}/despesas/opcoes")).json()["categorias"][0]["id"]


async def test_despesa_recorrente_pagar_e_resumo_do_resultado(api: AsyncClient, novo_cliente):
    cat = await _categoria(api)
    r = await api.post(
        f"{API}/despesas",
        json={
            "data": f"{ANO}-01-05",
            "descricao": "Hospedagem",
            "valor": 100,
            "categoria_id": cat,
            "status": "pago",
            "repetir": 3,
        },
    )
    ds = r.json()
    assert [d["status"] for d in ds] == ["pago", "a_pagar", "a_pagar"] and ds[0]["pago_em"] == f"{ANO}-01-05"
    assert ds[0]["categoria_nome"] == "Servidores e infraestrutura" and ds[2]["descricao"] == "Hospedagem · 3/3"

    pago = (await api.post(f"{API}/despesas/{ds[1]['id']}/pagar")).json()
    assert pago["status"] == "pago" and pago["pago_em"] == date.today().isoformat()

    c = await novo_cliente()
    lanc = (
        await api.post(
            f"{API}/faturamento",
            json={
                "cliente_id": c["id"],
                "tipo": "projeto",
                "descricao": "x",
                "valor": 1000,
                "vencimento": f"{ANO}-01-20",
                "status": "recebido",
            },
        )
    ).json()[0]
    assert lanc["status"] == "recebido"

    resumo = (await api.get(f"{API}/despesas/resumo", params={"ano": ANO})).json()
    assert resumo["recebido_no_ano"] == 1000
    assert resumo["despesas_pagas"] == 200 and resumo["despesas_a_pagar"] == 100
    assert resumo["resultado"] == 800  # recebido menos despesas PAGAS
    assert resumo["meses"][0] == {"mes": 1, "recebido": 1000, "despesas": 100, "resultado": 900, "investimentos": 0}


async def test_investimento_cria_investidor_e_agrega_por_pessoa(api: AsyncClient):
    corpo = {
        "data": f"{ANO}-02-01",
        "descricao": "Aporte",
        "valor": 3000,
        "investidor": "Soraya Sá",
        "forma": "Dinheiro (aporte)",
    }
    inv = (await api.post(f"{API}/investimentos", json=corpo)).json()
    assert inv["investidor_nome"] == "Soraya Sá"
    await api.post(
        f"{API}/investimentos", json={**corpo, "valor": 1000, "investidor": "soraya sá"}
    )  # mesmo nome (citext)
    await api.post(
        f"{API}/investimentos", json={**corpo, "data": f"{ANO - 1}-02-01", "valor": 1000, "investidor": "Jefferson"}
    )
    resumo = (await api.get(f"{API}/despesas/resumo", params={"ano": ANO})).json()
    assert resumo["investido_no_ano"] == 4000 and resumo["investido_total"] == 5000
    assert resumo["investidores"][0] == {"nome": "Soraya Sá", "no_ano": 4000, "total": 4000, "percentual": 80}
    opc = (await api.get(f"{API}/despesas/opcoes")).json()
    assert opc["investidores"] == ["Jefferson", "Soraya Sá"]

    r = await api.put(f"{API}/investimentos/{inv['id']}", json={**corpo, "valor": 3500, "versao": inv["versao"]})
    assert r.json()["valor"] == 3500
    assert (await api.delete(f"{API}/investimentos/{inv['id']}")).status_code == 204
