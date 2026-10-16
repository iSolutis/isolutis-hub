from uuid import uuid4

from app.realtime import Sala


class FalsoWs:
    def __init__(self) -> None:
        self.enviadas: list[dict] = []
        self.caida = False

    async def send_json(self, msg: dict) -> None:
        if self.caida:
            raise RuntimeError("conexão perdida")
        self.enviadas.append(msg)


async def test_presenca_agrupa_abas_da_mesma_pessoa_e_nao_revela_o_registro():
    sala, ana, empresa = Sala(), uuid4(), uuid4()
    ws1, ws2, ws3 = FalsoWs(), FalsoWs(), FalsoWs()
    c1 = await sala.entrar(ws1, ana, empresa, "Ana")  # type: ignore[arg-type]
    c2 = await sala.entrar(ws2, ana, empresa, "Ana")  # type: ignore[arg-type]
    await sala.entrar(ws3, uuid4(), empresa, "Beto")  # type: ignore[arg-type]
    await sala.atualizar_presenca(c1, "negocios", None)
    await sala.atualizar_presenca(c2, "clientes", "Alfa Ltda")
    pessoas = {p["nome"]: p for p in sala.pessoas(empresa)}
    # Escopo de acesso: quem não enxerga "Alfa Ltda" não pode saber que ela está sendo editada.
    assert len(pessoas) == 2 and pessoas["Ana"]["editando"] == "um registro"
    assert "Alfa" not in str(ws3.enviadas)
    assert ws3.enviadas[-1]["tipo"] == "presenca"


async def test_presenca_e_alteracoes_nao_cruzam_empresas():
    sala, e1, e2 = Sala(), uuid4(), uuid4()
    a, b = FalsoWs(), FalsoWs()
    await sala.entrar(a, uuid4(), e1, "A")  # type: ignore[arg-type]
    await sala.entrar(b, uuid4(), e2, "B")  # type: ignore[arg-type]
    await sala.publicar_alteracao({"clientes"}, e1)
    assert a.enviadas[-1] == {"tipo": "alterado", "recursos": ["clientes"]}
    assert all(m.get("tipo") != "alterado" for m in b.enviadas)


async def test_alteracao_e_limpeza_de_conexao_caida():
    sala, empresa = Sala(), uuid4()
    a, b = FalsoWs(), FalsoWs()
    await sala.entrar(a, uuid4(), empresa, "A")  # type: ignore[arg-type]
    await sala.entrar(b, uuid4(), empresa, "B")  # type: ignore[arg-type]
    b.caida = True
    await sala.publicar_alteracao({"clientes", "negocios"}, empresa)
    assert a.enviadas[-1] == {"tipo": "alterado", "recursos": ["clientes", "negocios"]}
    assert len(sala.conexoes) == 1
    antes = len(a.enviadas)
    await sala.publicar_alteracao(set(), empresa)  # nada a avisar
    assert len(a.enviadas) == antes
