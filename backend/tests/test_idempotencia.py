"""Idempotência de gravações: a mesma chave não cria o registro duas vezes (ver app/idempotencia.py)."""

import asyncio
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.main import app
from app.models import Empresa, Usuario, UsuarioEmpresa
from app.security import gerar_hash
from tests.conftest import SENHA

API = "/api/v1"
H = "Idempotency-Key"


async def _contar(api: AsyncClient) -> int:
    return len((await api.get(f"{API}/clientes")).json())


async def test_mesma_chave_cria_um_registro_e_repete_a_resposta(api: AsyncClient):
    primeira = await api.post(f"{API}/clientes", json={"nome": "Alfa"}, headers={H: "k1"})
    segunda = await api.post(f"{API}/clientes", json={"nome": "Alfa"}, headers={H: "k1"})
    assert primeira.status_code == 201 and segunda.status_code == 201
    assert segunda.json() == primeira.json()
    assert segunda.headers.get("Idempotent-Replay") == "true" and "Idempotent-Replay" not in primeira.headers
    assert await _contar(api) == 1


async def test_chaves_diferentes_criam_registros_diferentes(api: AsyncClient):
    await api.post(f"{API}/clientes", json={"nome": "Alfa"}, headers={H: "a"})
    await api.post(f"{API}/clientes", json={"nome": "Beta"}, headers={H: "b"})
    assert await _contar(api) == 2


async def test_sem_chave_comporta_como_antes(api: AsyncClient):
    await api.post(f"{API}/clientes", json={"nome": "Alfa"})
    await api.post(f"{API}/clientes", json={"nome": "Alfa"})
    assert await _contar(api) == 2


async def test_chave_reutilizada_em_outra_operacao_ou_corpo_e_recusada(api: AsyncClient):
    await api.post(f"{API}/clientes", json={"nome": "Alfa"}, headers={H: "k"})
    outro_corpo = await api.post(f"{API}/clientes", json={"nome": "Beta"}, headers={H: "k"})
    assert outro_corpo.status_code == 422 and outro_corpo.json()["erro"]["codigo"] == "chave_reutilizada"
    outra_rota = await api.post(f"{API}/produtos", json={"nome": "Alfa"}, headers={H: "k"})
    assert outra_rota.status_code == 422
    assert await _contar(api) == 1


async def test_falha_libera_a_chave_para_o_reenvio(api: AsyncClient):
    ruim = await api.post(f"{API}/clientes", json={"nome": "X", "cpf_cnpj": "123"}, headers={H: "k"})
    assert ruim.status_code == 422
    # mesma chave, mesmo corpo inválido: ainda recusa pela regra, não por "chave usada"
    de_novo = await api.post(f"{API}/clientes", json={"nome": "X", "cpf_cnpj": "123"}, headers={H: "k"})
    assert de_novo.status_code == 422 and de_novo.json()["erro"]["codigo"] != "chave_reutilizada"
    # com o corpo certo e outra chave, grava
    ok = await api.post(f"{API}/clientes", json={"nome": "X"}, headers={H: "k2"})
    assert ok.status_code == 201


async def test_chave_nao_vaza_entre_empresas(api: AsyncClient, sessao: AsyncSession):
    await api.post(f"{API}/clientes", json={"nome": "Alfa"}, headers={H: "k"})
    empresa = Empresa(nome="Outra")
    u = Usuario(email="outro@x.com", nome="Outro", senha_hash=gerar_hash(SENHA))
    sessao.add_all([empresa, u])
    await sessao.flush()
    sessao.add(UsuarioEmpresa(empresa_id=empresa.id, usuario_id=u.id, papel="admin", ativo=True))
    await sessao.commit()
    r = await api.post(f"{API}/auth/login", json={"email": u.email, "senha": SENHA})
    cab = {"Authorization": f"Bearer {r.json()['access_token']}", "X-Empresa-ID": str(empresa.id), H: "k"}
    criado = await api.post(f"{API}/clientes", json={"nome": "Alfa"}, headers=cab)
    assert criado.status_code == 201 and "Idempotent-Replay" not in criado.headers


@pytest.fixture
async def mundo_real(engine) -> AsyncIterator[tuple[AsyncClient, dict[str, str]]]:  # noqa: ANN001
    """Empresa e usuário gravados de verdade e uma sessão por requisição: permite requisições concorrentes."""
    from sqlalchemy.ext.asyncio import async_sessionmaker

    fabrica = async_sessionmaker(engine, expire_on_commit=False)
    async with fabrica() as s:
        empresa = Empresa(nome="Concorrência")
        u = Usuario(email="conc@x.com", nome="Conc", senha_hash=gerar_hash(SENHA))
        s.add_all([empresa, u])
        await s.flush()
        s.add(UsuarioEmpresa(empresa_id=empresa.id, usuario_id=u.id, papel="admin", ativo=True))
        await s.commit()
        empresa_id, usuario_id = empresa.id, u.id

    async def _sessao() -> AsyncIterator[AsyncSession]:
        async with fabrica() as nova:
            yield nova

    app.dependency_overrides[get_session] = _sessao
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://teste") as cliente:
        r = await cliente.post(f"{API}/auth/login", json={"email": "conc@x.com", "senha": SENHA})
        yield cliente, {"Authorization": f"Bearer {r.json()['access_token']}", "X-Empresa-ID": str(empresa_id)}
    app.dependency_overrides.clear()
    async with engine.begin() as c:
        await c.execute(text("DELETE FROM parceiro_negocio WHERE empresa_id = :e"), {"e": empresa_id})
        await c.execute(text("DELETE FROM usuario_empresa WHERE empresa_id = :e"), {"e": empresa_id})
        await c.execute(text("DELETE FROM empresa WHERE id = :e"), {"e": empresa_id})
        await c.execute(text("DELETE FROM usuarios WHERE id = :u"), {"u": usuario_id})


async def test_requisicoes_simultaneas_com_a_mesma_chave_criam_um_registro(mundo_real):
    cliente, cab = mundo_real
    respostas = await asyncio.gather(
        *[cliente.post(f"{API}/clientes", json={"nome": "Simultâneo"}, headers={**cab, H: "mesma"}) for _ in range(4)]
    )
    assert {r.status_code for r in respostas} == {201}
    assert len({r.json()["id"] for r in respostas}) == 1
    assert len((await cliente.get(f"{API}/clientes", headers=cab)).json()) == 1
