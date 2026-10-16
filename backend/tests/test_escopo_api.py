# ruff: noqa: E501  (SQL dos cenários em linhas longas de propósito)
"""Escopo de acesso pela API, com a conexão no papel de runtime (RLS ativo, como em produção).

O cenário (empresa, equipes, clientes, negócios, projeto P) é o de `test_escopo_sql`; aqui cada pessoa entra
com e-mail e senha e usa as rotas reais.
"""

from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.security import gerar_hash
from tests.conftest import SENHA
from tests.test_escopo_sql import Cenario

API = "/api/v1"


class Api:
    def __init__(self, http: AsyncClient, c: Cenario) -> None:
        self.http, self.c, self.tokens = http, c, {}

    async def h(self, quem: str) -> dict[str, str]:
        if quem not in self.tokens:
            r = await self.http.post(f"{API}/auth/login", json={"email": f"{quem}@e.com", "senha": SENHA})
            assert r.status_code == 200, r.text
            self.tokens[quem] = r.json()["access_token"]
        return {"Authorization": f"Bearer {self.tokens[quem]}", "X-Empresa-ID": str(self.c.ids["E"])}

    async def get(self, quem: str, caminho: str):
        return await self.http.get(f"{API}{caminho}", headers=await self.h(quem))

    async def enviar(self, metodo: str, quem: str, caminho: str, corpo: object = None):
        return await self.http.request(metodo, f"{API}{caminho}", json=corpo, headers=await self.h(quem))


@pytest.fixture
async def api(http: AsyncClient, sessao: AsyncSession) -> Api:
    c = await Cenario(sessao).montar()
    await sessao.execute(text("UPDATE usuarios SET senha_hash = :h"), {"h": gerar_hash(SENHA)})
    await c.operador()
    await sessao.execute(text("SET ROLE hub_runtime"))
    yield Api(http, c)
    await sessao.execute(text("RESET ROLE"))


def _titulos(r) -> set[str]:  # noqa: ANN001
    assert r.status_code == 200, r.text
    return {x["titulo"] for x in r.json()}


async def test_listas_respeitam_o_escopo(api: Api):
    assert _titulos(await api.get("bruno", "/negocios")) == {"N_bruno_X", "N_livre_Z"}
    assert _titulos(await api.get("ana", "/negocios")) == {"N_bruno_X", "N_carla_W", "N_livre_Z", "N_livre_X"}
    assert len(_titulos(await api.get("admin", "/negocios"))) == 5
    # Bruno vê o próprio negócio com o nome do cliente X (de Ana), sem enxergar o cadastro de X
    n = next(x for x in (await api.get("bruno", "/negocios")).json() if x["titulo"] == "N_bruno_X")
    assert n["cliente_nome"] == "Cliente X"
    assert {c["nome"] for c in (await api.get("bruno", "/clientes")).json()} == {"Cliente Y", "Cliente Z"}


async def test_fora_do_escopo_e_inexistente(api: Api):
    alheio = api.c.ids["N_carla_W"]
    corpo = {"versao": 1, "titulo": "x", "cliente_id": str(api.c.ids["W"]), "etapa": "lead"}
    r_alheio = await api.enviar("PUT", "bruno", f"/negocios/{alheio}", corpo)
    r_inexistente = await api.enviar("PUT", "bruno", f"/negocios/{uuid4()}", corpo)
    assert r_alheio.status_code == r_inexistente.status_code == 404
    assert r_alheio.json()["erro"]["mensagem"] == r_inexistente.json()["erro"]["mensagem"]
    assert (await api.get("bruno", f"/orcamentos/{api.c.ids['O_N_bruno']}/documento")).status_code != 404  # o próprio
    assert (await api.get("carla", f"/orcamentos/{api.c.ids['O_N_bruno']}/documento")).status_code == 404


async def test_visivel_mas_nao_editavel(api: Api):
    await api.c.s.execute(text("RESET ROLE"))
    await api.c.s.execute(text("DELETE FROM equipe_membro WHERE usuario_id = :b"), {"b": api.c.u["bruno"]})
    await api.c.s.execute(text("SET ROLE hub_runtime"))
    negocios = (await api.get("ana", "/negocios")).json()  # Ana vê pelo cliente X, mas não lidera mais Bruno
    n = next(x for x in negocios if x["titulo"] == "N_bruno_X")
    assert n["pode_editar"] is False
    r = await api.enviar("PATCH", "ana", f"/negocios/{n['id']}/etapa", {"versao": n["versao"], "etapa": "proposta"})
    assert r.status_code == 403, r.text


async def test_vinculo_com_cliente_alheio(api: Api):
    r = await api.enviar("POST", "bruno", "/negocios", {"titulo": "roubo", "cliente_id": str(api.c.ids["W"])})
    assert r.status_code == 404 and "Cliente" in r.json()["erro"]["mensagem"]


async def test_dono_padrao_e_transferencia(api: Api):
    criado = await api.enviar("POST", "bruno", "/clientes", {"nome": "Novo do Bruno"})
    assert criado.status_code == 201, criado.text
    assert criado.json()["responsavel_id"] == str(api.c.u["bruno"])
    neg = await api.enviar("POST", "bruno", "/negocios", {"titulo": "meu", "cliente_id": criado.json()["id"], "responsavel_id": None})
    assert neg.status_code == 201 and neg.json()["responsavel_id"] == str(api.c.u["bruno"])
    corpo = {"entidade": "cliente", "id": criado.json()["id"], "para": str(api.c.u["carla"])}
    assert (await api.enviar("POST", "bruno", "/escopo/transferir", corpo)).status_code == 403
    assert (await api.enviar("POST", "ana", "/escopo/transferir", corpo)).status_code == 204
    fora = {**corpo, "para": str(api.c.u["fabio"])}
    assert (await api.enviar("POST", "ana", "/escopo/transferir", fora)).status_code == 403
    assert (await api.enviar("POST", "admin", "/escopo/transferir", fora)).status_code == 204


async def test_pessoas_atribuiveis(api: Api):
    nomes = lambda r: {p["nome"] for p in r.json()}  # noqa: E731
    assert nomes(await api.get("bruno", "/escopo/pessoas")) == {"bruno"}
    assert nomes(await api.get("ana", "/escopo/pessoas")) == {"ana", "bruno", "carla"}
    assert len(nomes(await api.get("admin", "/escopo/pessoas"))) == 10


async def test_equipes_so_admin(api: Api):
    corpo = {"nome": "Norte", "lideres": [str(api.c.u["diego"])], "membros": [str(api.c.u["fabio"])]}
    assert (await api.enviar("POST", "ana", "/equipes", corpo)).status_code == 403
    assert (await api.get("ana", "/equipes")).status_code == 403
    r = await api.enviar("POST", "admin", "/equipes", corpo)
    assert r.status_code == 201, r.text
    assert r.json()["lideres"] == [str(api.c.u["diego"])]
    assert len((await api.get("admin", "/equipes")).json()) == 3
    eu = (await api.get("diego", "/escopo/eu")).json()
    assert eu["lider"] is True and eu["liderados"] == 1
    assert (await api.enviar("DELETE", "admin", f"/equipes/{r.json()['id']}")).status_code == 204


async def test_projeto_participantes_e_etapas(api: Api):
    p = api.c.ids["P"]
    projeto = next(x for x in (await api.get("diego", "/projetos")).json() if x["id"] == str(p))
    assert projeto["pode_editar"] is False
    etapas = {e["titulo"]: e for e in projeto["etapas"]}
    assert etapas["Implantação"]["pode_editar"] is True and etapas["Treinamento"]["pode_editar"] is False
    corpo = lambda e: {"status": "andamento"}  # noqa: E731, ARG005
    r = await api.enviar("PATCH", "diego", f"/projetos/{p}/etapas/{etapas['Implantação']['id']}", corpo(etapas["Implantação"]))
    assert r.status_code == 200, r.text
    r = await api.enviar("PATCH", "diego", f"/projetos/{p}/etapas/{etapas['Treinamento']['id']}", corpo(etapas["Treinamento"]))
    assert r.status_code == 403
    # participantes: só quem edita o projeto inclui
    assert (await api.enviar("POST", "diego", f"/projetos/{p}/participantes", {"usuario_id": str(api.c.u["fabio"])})).status_code == 403
    r = await api.enviar("POST", "admin", f"/projetos/{p}/participantes", {"usuario_id": str(api.c.u["fabio"])})
    assert r.status_code == 200 and str(api.c.u["fabio"]) in r.json()


async def test_executor_de_tarefa_avulsa(api: Api):
    tarefas = (await api.get("fabio", "/tarefas")).json()
    assert {t["titulo"] for t in tarefas} == {"T1", "T_livre"}
    assert str(api.c.ids["P"]) not in {x["id"] for x in (await api.get("fabio", "/projetos")).json()}
    assert {x["titulo"] for x in (await api.get("fabio", "/projetos/referencias")).json()} >= {"P"}
    assert {x["nome"] for x in (await api.get("fabio", "/clientes/referencias")).json()} == {"Cliente X", "Cliente Z"}
    t1 = next(t for t in tarefas if t["titulo"] == "T1")
    r = await api.enviar("PATCH", "fabio", f"/tarefas/{t1['id']}/coluna", {"versao": t1["versao"], "coluna": "fazendo"})
    assert r.status_code == 200, r.text


async def test_painel_soma_so_o_escopo(api: Api):
    bruno = (await api.get("bruno", "/painel")).json()
    admin = (await api.get("admin", "/painel")).json()
    assert bruno["funil_abertos"] == 2 and admin["funil_abertos"] == 5


async def test_admin_ve_transferencias(api: Api):
    await api.enviar("POST", "ana", "/escopo/transferir", {"entidade": "negocio", "id": str(api.c.ids["N_bruno_X"]), "para": str(api.c.u["carla"])})
    linhas = (await api.c.s.execute(text("SELECT entidade FROM transferencia_dono"))).scalars().all()
    assert linhas == []  # a conexão está como Ana/runtime: só admin lê
    await api.get("admin", "/painel")  # a requisição do admin define o escopo dele na transação
    assert (await api.c.s.execute(text("SELECT entidade FROM transferencia_dono"))).scalars().all() == ["negocio"]


def test_uuid_helper():
    assert UUID(str(uuid4()))
