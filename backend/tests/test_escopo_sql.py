# ruff: noqa: E501  (SQL dos cenários em linhas longas de propósito)
"""Escopo de acesso imposto pelo banco (migração 0013), exercitado com o papel de runtime da aplicação.

Os dados são montados como operador (superusuário, sem RLS); cada verificação roda como `hub_runtime` com as
variáveis de transação que a API grava (app.usuario_id, app.empresa_id) seguidas de `app_definir_escopo()`.
Cenários: openspec/changes/escopo-de-acesso/specs/*.
"""

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

PESSOAS = {
    "admin": "admin",
    "diretora": "comercial",
    "ana": "comercial",
    "bruno": "comercial",
    "carla": "comercial",
    "diego": "membro",
    "elisa": "membro",
    "gabi": "membro",
    "fabio": "membro",
    "fin": "financeiro",
}


async def _exec(s: AsyncSession, sql: str, **p: object) -> None:
    await s.execute(text(sql), p)


async def _um(s: AsyncSession, sql: str, **p: object) -> object:
    return (await s.execute(text(sql), p)).scalar()


async def _lista(s: AsyncSession, sql: str, **p: object) -> list:
    return list((await s.execute(text(sql), p)).scalars().all())


class Cenario:
    def __init__(self, sessao: AsyncSession) -> None:
        self.s = sessao
        self.u: dict[str, uuid.UUID] = {}
        self.ids: dict[str, uuid.UUID] = {}

    async def operador(self) -> None:
        await _exec(self.s, "RESET ROLE")
        for g in ("usuario_id", "empresa_id", "usuarios_visiveis", "ve_tudo", "ve_financeiro", "lider"):
            await _exec(self.s, f"SELECT set_config('app.{g}', '', true)")

    async def como(self, quem: str, empresa: str = "E") -> None:
        await self.operador()
        await _exec(self.s, "SELECT set_config('app.usuario_id', :u, true)", u=str(self.u[quem]))
        await _exec(self.s, "SELECT set_config('app.empresa_id', :e, true)", e=str(self.ids[empresa]))
        await _exec(self.s, "SET ROLE hub_runtime")
        await _exec(self.s, "SELECT app_definir_escopo()")

    async def novo(self, chave: str, sql: str, **p: object) -> uuid.UUID:
        self.ids[chave] = await _um(self.s, sql + " RETURNING id", **p)  # type: ignore[assignment]
        return self.ids[chave]

    async def montar(self) -> "Cenario":
        await self.operador()
        e = await self.novo("E", "INSERT INTO empresa (nome) VALUES ('Empresa E')")
        f = await self.novo("F", "INSERT INTO empresa (nome) VALUES ('Empresa F')")
        for nome, papel in PESSOAS.items():
            self.u[nome] = await _um(  # type: ignore[assignment]
                self.s, "INSERT INTO usuarios (email, nome) VALUES (:e, :n) RETURNING id", e=f"{nome}@e.com", n=nome
            )
            await _exec(self.s, "INSERT INTO usuario_empresa (empresa_id, usuario_id, papel, ativo) VALUES (:e, :u, :p, true)",
                        e=e, u=self.u[nome], p=papel)  # fmt: skip
        # Diretoria (lidera Ana) → Sul (Ana lidera Bruno e Carla)
        for equipe, lideres, membros in [("Diretoria", ["diretora"], ["ana"]), ("Sul", ["ana"], ["bruno", "carla"])]:
            eq = await self.novo(equipe, "INSERT INTO equipe (empresa_id, nome) VALUES (:e, :n)", e=e, n=equipe)
            for lider in lideres:
                await _exec(self.s, "INSERT INTO equipe_lider (empresa_id, equipe_id, usuario_id) VALUES (:e, :q, :u)",
                            e=e, q=eq, u=self.u[lider])  # fmt: skip
            for m in membros:
                await _exec(self.s, "INSERT INTO equipe_membro (empresa_id, equipe_id, usuario_id) VALUES (:e, :q, :u)",
                            e=e, q=eq, u=self.u[m])  # fmt: skip

        async def cliente(chave: str, dono: str | None, empresa: uuid.UUID = e) -> uuid.UUID:
            c = await self.novo(chave, "INSERT INTO parceiro_negocio (empresa_id, nome, responsavel_id) VALUES (:e, :n, :d)",
                                e=empresa, n=f"Cliente {chave}", d=self.u.get(dono or ""))  # fmt: skip
            await _exec(self.s, "INSERT INTO parceiro_papel (empresa_id, parceiro_id, papel) VALUES (:e, :c, 'cliente')",
                        e=empresa, c=c)  # fmt: skip
            return c

        x, _, z = await cliente("X", "ana"), await cliente("Y", "bruno"), await cliente("Z", None)
        await cliente("W", "carla")
        await cliente("XF", None, f)

        async def negocio(chave: str, cli: uuid.UUID, resp: str | None) -> None:
            await self.novo(chave, "INSERT INTO negocios (empresa_id, titulo, cliente_id, responsavel_id) VALUES (:e, :t, :c, :r)",
                            e=e, t=chave, c=cli, r=self.u.get(resp or ""))  # fmt: skip

        await negocio("N_bruno_X", x, "bruno")
        await negocio("N_carla_W", self.ids["W"], "carla")
        await negocio("N_livre_Z", z, None)
        await negocio("N_livre_X", x, None)
        await negocio("N_diretora_Z", z, "diretora")
        await self.novo("O_N_bruno", "INSERT INTO orcamentos (empresa_id, numero, cliente_id, negocio_id) VALUES (:e, '2026-001', :c, :n)",
                        e=e, c=x, n=self.ids["N_bruno_X"])  # fmt: skip

        # Projeto P (resp admin, cliente Z): etapas de Diego e Elisa, Gabi incluída; T1 de Fábio, T2 sem responsável
        p = await self.novo("P", "INSERT INTO projetos (empresa_id, titulo, cliente_id, responsavel_id) VALUES (:e, 'P', :c, :r)",
                            e=e, c=z, r=self.u["admin"])  # fmt: skip
        await self.novo("E1", "INSERT INTO projeto_etapas (empresa_id, projeto_id, ordem, titulo, responsavel_id) VALUES (:e, :p, 1, 'Implantação', :r)",
                        e=e, p=p, r=self.u["diego"])  # fmt: skip
        await self.novo("E2", "INSERT INTO projeto_etapas (empresa_id, projeto_id, ordem, titulo, responsavel_id) VALUES (:e, :p, 2, 'Treinamento', :r)",
                        e=e, p=p, r=self.u["elisa"])  # fmt: skip
        await _exec(self.s, "INSERT INTO projeto_participante (empresa_id, projeto_id, usuario_id) VALUES (:e, :p, :u)",
                    e=e, p=p, u=self.u["gabi"])  # fmt: skip
        await self.novo("T1", "INSERT INTO tarefas (empresa_id, titulo, projeto_id, cliente_id, responsavel_id) VALUES (:e, 'T1', :p, :c, :r)",
                        e=e, p=p, c=x, r=self.u["fabio"])  # fmt: skip
        await self.novo("T2", "INSERT INTO tarefas (empresa_id, titulo, projeto_id) VALUES (:e, 'T2', :p)", e=e, p=p)
        await self.novo("T_livre", "INSERT INTO tarefas (empresa_id, titulo) VALUES (:e, 'T_livre')", e=e)
        await self.novo("Q", "INSERT INTO projetos (empresa_id, titulo, cliente_id) VALUES (:e, 'Q', :c)", e=e, c=z)
        return self


@pytest.fixture
async def c(sessao: AsyncSession) -> Cenario:
    cen = await Cenario(sessao).montar()
    yield cen
    await cen.operador()


async def _titulos(c: Cenario, tabela: str, coluna: str = "titulo") -> set[str]:
    return set(await _lista(c.s, f"SELECT {coluna} FROM {tabela}"))


async def _falha(c: Cenario, sql: str, **p: object) -> str:
    """Executa num savepoint e devolve a mensagem do erro (falha o teste se não houver erro)."""
    async with c.s.begin_nested() as sp:
        try:
            await _exec(c.s, sql, **p)
        except DBAPIError as erro:
            await sp.rollback()
            return str(erro.orig)
    pytest.fail(f"deveria falhar: {sql}")


async def _linhas(c: Cenario, sql: str, **p: object) -> int:
    return (await c.s.execute(text(sql), p)).rowcount


# --------------------------------------------------------------------------------------------- equipes
async def test_escopo_de_liderança_aninhada(c: Cenario):
    await c.como("diretora")
    visiveis = set(await _um(c.s, "SELECT app_usuarios_visiveis()"))  # type: ignore[arg-type]
    assert visiveis == {c.u["diretora"], c.u["ana"], c.u["bruno"], c.u["carla"]}
    await c.como("ana")
    assert set(await _um(c.s, "SELECT app_usuarios_visiveis()")) == {c.u["ana"], c.u["bruno"], c.u["carla"]}  # type: ignore[arg-type]
    await c.como("bruno")
    assert await _um(c.s, "SELECT app_usuarios_visiveis()") == [c.u["bruno"]]
    assert await _um(c.s, "SELECT app_lider()") is False


async def test_ciclo_e_dois_lideres(c: Cenario):
    await c.operador()
    e = c.ids["E"]
    q = await c.novo("Ciclo", "INSERT INTO equipe (empresa_id, nome) VALUES (:e, 'Ciclo')", e=e)
    await _exec(c.s, "INSERT INTO equipe_lider (empresa_id, equipe_id, usuario_id) VALUES (:e, :q, :b), (:e, :q, :d)",
                e=e, q=q, b=c.u["bruno"], d=c.u["diego"])  # fmt: skip
    await _exec(
        c.s, "INSERT INTO equipe_membro (empresa_id, equipe_id, usuario_id) VALUES (:e, :q, :a)", e=e, q=q, a=c.u["ana"]
    )
    await c.como("bruno")  # Bruno lidera Ana, que lidera Bruno: ciclo
    assert set(await _um(c.s, "SELECT app_usuarios_visiveis()")) == {c.u["ana"], c.u["bruno"], c.u["carla"]}  # type: ignore[arg-type]
    await c.como("diego")  # segundo líder da mesma equipe
    assert c.u["ana"] in await _um(c.s, "SELECT app_usuarios_visiveis()")  # type: ignore[operator]


async def test_sem_escopo_definido_falha_fechado(c: Cenario):
    await c.operador()
    await _exec(c.s, "SELECT set_config('app.empresa_id', :e, true)", e=str(c.ids["E"]))
    await _exec(c.s, "SET ROLE hub_runtime")  # sem app_definir_escopo()
    assert await _um(c.s, "SELECT app_usuarios_visiveis()") == []
    assert await _titulos(c, "negocios") == {"N_livre_Z"}  # só o que não tem dono (nem acima)


async def test_pessoa_desativada_sem_escopo_e_registros_seguem_com_o_lider(c: Cenario):
    await c.operador()
    await _exec(c.s, "UPDATE usuario_empresa SET ativo = false WHERE usuario_id = :u", u=c.u["bruno"])
    await c.como("bruno")
    assert await _um(c.s, "SELECT app_usuarios_visiveis()") == []
    await c.como("ana")
    assert "N_bruno_X" in await _titulos(c, "negocios")


async def test_equipes_so_admin_altera(c: Cenario):
    await c.como("ana")
    assert await _linhas(c, "UPDATE equipe SET nome = 'X' WHERE id = :q", q=c.ids["Sul"]) == 0
    await c.como("admin")
    assert await _linhas(c, "UPDATE equipe SET nome = 'Sul 2' WHERE id = :q", q=c.ids["Sul"]) == 1


# --------------------------------------------------------------------------------------------- visibilidade
async def test_visibilidade_comercial(c: Cenario):
    await c.como("bruno")
    # próprio + sem dono (N_livre_Z); não vê Carla, nem N_livre_X (sem dono, mas o cliente X tem dona)
    assert await _titulos(c, "negocios") == {"N_bruno_X", "N_livre_Z"}
    assert await _titulos(c, "parceiro_negocio", "nome") == {"Cliente Y", "Cliente Z"}
    await c.como("ana")  # líder de Bruno e Carla, dona de X
    assert await _titulos(c, "negocios") == {"N_bruno_X", "N_carla_W", "N_livre_Z", "N_livre_X"}
    await c.como("diretora")
    assert await _titulos(c, "negocios") == {"N_bruno_X", "N_carla_W", "N_livre_Z", "N_livre_X", "N_diretora_Z"}
    await c.como("admin")
    assert len(await _titulos(c, "negocios")) == 5


async def test_dono_do_cliente_ve_negocio_e_orcamento_de_outro(c: Cenario):
    await c.operador()
    await _exec(c.s, "DELETE FROM equipe_membro WHERE usuario_id = :b", b=c.u["bruno"])  # Ana deixa de liderar Bruno
    await c.como("ana")
    assert "N_bruno_X" in await _titulos(c, "negocios")
    assert await _lista(c.s, "SELECT numero FROM orcamentos") == ["2026-001"]
    # ver pela posse do cliente não dá edição
    assert await _linhas(c, "UPDATE negocios SET titulo = 'x' WHERE id = :n", n=c.ids["N_bruno_X"]) == 0


async def test_isolamento_entre_empresas_continua(c: Cenario):
    await c.como("admin")
    assert "Cliente XF" not in await _titulos(c, "parceiro_negocio", "nome")


async def test_financeiro_ve_todos_os_clientes(c: Cenario):
    await c.como("fin")
    assert await _titulos(c, "parceiro_negocio", "nome") == {"Cliente X", "Cliente Y", "Cliente Z", "Cliente W"}


async def test_referencias_minimas(c: Cenario):
    await c.como("fabio")  # executor de T1 (cliente X) em P
    assert await _lista(c.s, "SELECT nome FROM app_clientes_referencia()") == ["Cliente X", "Cliente Z"]
    assert await _lista(c.s, "SELECT titulo FROM app_projetos_referencia()") == ["P", "Q"]
    await c.como("bruno")
    assert "Cliente W" not in await _lista(c.s, "SELECT nome FROM app_clientes_referencia()")


async def test_nome_do_cliente_na_view_de_orcamentos(c: Cenario):
    await c.operador()
    await _exec(c.s, "DELETE FROM equipe_membro WHERE usuario_id = :b", b=c.u["bruno"])
    await c.como("bruno")  # vê o próprio orçamento, mas não o cadastro do cliente X (de Ana)
    assert await _lista(c.s, "SELECT cliente_nome FROM vw_orcamentos_totais") == ["Cliente X"]
    assert "Cliente X" not in await _titulos(c, "parceiro_negocio", "nome")


# --------------------------------------------------------------------------------------------- edição e dono
async def test_quem_edita_negocios(c: Cenario):
    await c.como("carla")
    assert await _linhas(c, "UPDATE negocios SET titulo = 'x' WHERE id = :n", n=c.ids["N_bruno_X"]) == 0
    await c.como("ana")
    assert await _linhas(c, "UPDATE negocios SET titulo = 'y' WHERE id = :n", n=c.ids["N_bruno_X"]) == 1
    await c.como("bruno")
    assert await _linhas(c, "UPDATE negocios SET titulo = 'z' WHERE id = :n", n=c.ids["N_bruno_X"]) == 1


async def test_transferencia_de_dono(c: Cenario):
    await c.como("bruno")
    erro = await _falha(
        c, "UPDATE parceiro_negocio SET responsavel_id = :cc WHERE id = :y", cc=c.u["carla"], y=c.ids["Y"]
    )
    assert "atribuição" in erro
    await _falha(c, "UPDATE parceiro_negocio SET responsavel_id = NULL WHERE id = :y", y=c.ids["Y"])
    await c.como("ana")
    assert (
        await _linhas(
            c, "UPDATE parceiro_negocio SET responsavel_id = :cc WHERE id = :y", cc=c.u["carla"], y=c.ids["Y"]
        )
        == 1
    )
    await _falha(c, "UPDATE parceiro_negocio SET responsavel_id = :f WHERE id = :y", f=c.u["fabio"], y=c.ids["Y"])
    await c.como("admin")
    log = (await c.s.execute(text("SELECT entidade, de, para, por FROM transferencia_dono"))).all()
    assert log == [("cliente", c.u["bruno"], c.u["carla"], c.u["ana"])]
    await c.como("ana")
    assert await _lista(c.s, "SELECT id FROM transferencia_dono") == []  # só admin lê


async def test_dono_padrao_e_criacao_sem_dono(c: Cenario):
    await c.como("bruno")
    await _falha(c, "INSERT INTO negocios (titulo, cliente_id) VALUES ('sem dono', :y)", y=c.ids["Y"])
    await _falha(c, "INSERT INTO negocios (titulo, cliente_id, responsavel_id) VALUES ('p/ carla', :y, :cc)",
                 y=c.ids["Y"], cc=c.u["carla"])  # fmt: skip
    await _exec(
        c.s,
        "INSERT INTO negocios (titulo, cliente_id, responsavel_id) VALUES ('meu', :y, :b)",
        y=c.ids["Y"],
        b=c.u["bruno"],
    )
    await c.como("ana")  # líder pode criar sem dono ou para liderado
    await _exec(c.s, "INSERT INTO negocios (titulo, cliente_id) VALUES ('livre', :x)", x=c.ids["X"])


async def test_vinculo_so_com_cliente_visivel(c: Cenario):
    await c.como("bruno")
    erro = await _falha(c, "INSERT INTO negocios (titulo, cliente_id, responsavel_id) VALUES ('roubo', :w, :b)",
                        w=c.ids["W"], b=c.u["bruno"])  # fmt: skip
    assert "cliente fora do escopo" in erro
    # orçamento do próprio negócio, mesmo com o cliente de Ana (que Bruno não vê pelo cadastro)
    await c.operador()
    await _exec(c.s, "DELETE FROM equipe_membro WHERE usuario_id = :b", b=c.u["bruno"])
    await c.como("bruno")
    await _exec(c.s, "INSERT INTO orcamentos (numero, cliente_id, negocio_id) VALUES ('2026-002', :x, :n)",
                x=c.ids["X"], n=c.ids["N_bruno_X"])  # fmt: skip


async def test_orcamento_segue_o_negocio_transferido(c: Cenario):
    await c.como("ana")
    await _exec(c.s, "UPDATE negocios SET responsavel_id = :cc WHERE id = :n", cc=c.u["carla"], n=c.ids["N_bruno_X"])
    await c.operador()
    await _exec(c.s, "DELETE FROM equipe_membro WHERE usuario_id IN (:b, :cc)", b=c.u["bruno"], cc=c.u["carla"])
    await c.operador()
    await _exec(c.s, "UPDATE parceiro_negocio SET responsavel_id = :w WHERE id = :x", w=c.u["admin"], x=c.ids["X"])
    await c.como("carla")
    assert await _lista(c.s, "SELECT numero FROM orcamentos") == ["2026-001"]
    await c.como("bruno")
    assert await _lista(c.s, "SELECT numero FROM orcamentos") == []


# --------------------------------------------------------------------------------------------- projetos
async def test_participante_ve_o_projeto_inteiro_e_atua_no_seu(c: Cenario):
    await c.como("diego")
    assert await _titulos(c, "projeto_etapas") == {"Implantação", "Treinamento"}
    assert {"T1", "T2"} <= await _titulos(c, "tarefas")
    assert await _linhas(c, "UPDATE projeto_etapas SET status = 'andamento' WHERE id = :e", e=c.ids["E1"]) == 1
    assert await _linhas(c, "UPDATE projeto_etapas SET status = 'andamento' WHERE id = :e", e=c.ids["E2"]) == 0
    assert await _linhas(c, "UPDATE projetos SET titulo = 'x' WHERE id = :p", p=c.ids["P"]) == 0
    await c.como("gabi")  # participante sem responsabilidade
    assert "P" in await _titulos(c, "projetos")
    assert await _linhas(c, "UPDATE tarefas SET titulo = 'x' WHERE id = :t", t=c.ids["T1"]) == 0


async def test_executor_de_tarefa_avulsa(c: Cenario):
    await c.como("fabio")
    assert await _titulos(c, "tarefas") == {"T1", "T_livre"}
    assert "P" not in await _titulos(c, "projetos")
    assert await _titulos(c, "projeto_etapas") == set()
    assert await _linhas(c, "UPDATE tarefas SET titulo = 'T1 feita' WHERE id = :t", t=c.ids["T1"]) == 1


async def test_criacao_de_tarefa_no_projeto(c: Cenario):
    await c.como("diego")
    await _exec(c.s, "INSERT INTO tarefas (titulo, projeto_id, responsavel_id) VALUES ('p/ elisa', :p, :e)",
                p=c.ids["P"], e=c.u["elisa"])  # fmt: skip
    erro = await _falha(c, "INSERT INTO tarefas (titulo, projeto_id, responsavel_id) VALUES ('p/ fabio', :p, :f)",
                        p=c.ids["P"], f=c.u["fabio"])  # fmt: skip
    assert "atribuição" in erro
    await c.como("fabio")  # executor avulso não cria tarefas no projeto
    await _falha(
        c, "INSERT INTO tarefas (titulo, projeto_id, responsavel_id) VALUES ('x', :p, :f)", p=c.ids["P"], f=c.u["fabio"]
    )
    await c.como("admin")  # responsável do projeto delega a alguém de fora
    await _exec(c.s, "INSERT INTO tarefas (titulo, projeto_id, responsavel_id) VALUES ('p/ fabio', :p, :f)",
                p=c.ids["P"], f=c.u["fabio"])  # fmt: skip


async def test_registro_sem_dono_publico_e_herdado(c: Cenario):
    await c.como("bruno")  # não participa de P
    assert "T_livre" in await _titulos(c, "tarefas")
    assert "T2" not in await _titulos(c, "tarefas")  # sem responsável, mas dentro de P
    assert "Q" in await _titulos(c, "projetos")  # sem dono, sem participantes, cliente sem dono
    assert "P" not in await _titulos(c, "projetos")
