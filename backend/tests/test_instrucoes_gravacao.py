"""Quantas instruções SQL uma gravação faz. Cada instrução é uma ida e volta ao banco (~120 ms entre a função na
Vercel e o Neon quando estão em regiões diferentes), então o total é custo direto de latência ao salvar."""

import re

import pytest
from httpx import AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

API = "/api/v1"


@pytest.fixture
def instrucoes(sessao: AsyncSession):  # noqa: ANN201
    lista: list[str] = []

    def contar(conn, cur, st, params, ctx, many):  # noqa: ANN001, ANN202
        lista.append(re.sub(r"\s+", " ", st)[:110])

    alvo = sessao.bind.sync_engine if sessao.bind is not None else sessao.sync_session.get_bind()
    event.listen(alvo, "before_cursor_execute", contar)
    yield lista
    event.remove(alvo, "before_cursor_execute", contar)


async def test_medir_post_cliente_e_negocio(api: AsyncClient, instrucoes: list[str], novo_cliente, capsys):
    c = await novo_cliente("Base")
    instrucoes.clear()
    r = await api.post(f"{API}/clientes", json={"nome": "Medida"})
    assert r.status_code == 201
    do_cliente = list(instrucoes)
    instrucoes.clear()
    r = await api.post(f"{API}/negocios", json={"titulo": "Medido", "cliente_id": c["id"]})
    assert r.status_code == 201
    do_negocio = list(instrucoes)
    with capsys.disabled():
        print(f"\nPOST /clientes: {len(do_cliente)} instruções; POST /negocios: {len(do_negocio)} instruções")
        for i, s in enumerate(do_negocio, 1):
            print(f"  {i:>2}. {s}")
