"""Tempo real: presença ("Usando agora") e aviso de alteração de dados por WebSocket.

Mensagens servidor -> cliente:
  {"tipo": "presenca", "pessoas": [{"usuario_id", "nome", "area", "editando"}]}
  {"tipo": "alterado", "recursos": ["clientes", ...]}      # peça ao servidor os dados novamente
Mensagens cliente -> servidor:
  {"tipo": "presenca", "area": "negocios", "editando": "Título do registro" | null}

A sala vive na memória do processo: serve uma instância única. Para várias instâncias, troque
`publicar_alteracao` por LISTEN/NOTIFY do PostgreSQL ou Redis (a interface pública não muda).
"""

import asyncio
import contextlib
import logging
from dataclasses import dataclass, field
from uuid import UUID

from fastapi import WebSocket

log = logging.getLogger(__name__)


@dataclass
class Conexao:
    ws: WebSocket
    usuario_id: UUID
    nome: str
    area: str = ""
    editando: str | None = None


@dataclass
class Sala:
    conexoes: dict[int, Conexao] = field(default_factory=dict)

    async def entrar(self, ws: WebSocket, usuario_id: UUID, nome: str) -> Conexao:
        con = Conexao(ws=ws, usuario_id=usuario_id, nome=nome)
        self.conexoes[id(ws)] = con
        await self._enviar_presenca()
        return con

    async def sair(self, con: Conexao) -> None:
        self.conexoes.pop(id(con.ws), None)
        await self._enviar_presenca()

    async def atualizar_presenca(self, con: Conexao, area: str, editando: str | None) -> None:
        con.area = area[:40]
        con.editando = editando[:40] if editando else None
        await self._enviar_presenca()

    def pessoas(self) -> list[dict[str, object]]:
        """Uma entrada por pessoa (várias abas viram uma); quem está editando tem prioridade."""
        por_pessoa: dict[UUID, Conexao] = {}
        for con in self.conexoes.values():
            atual = por_pessoa.get(con.usuario_id)
            if atual is None or (con.editando and not atual.editando):
                por_pessoa[con.usuario_id] = con
        return [
            {"usuario_id": str(c.usuario_id), "nome": c.nome, "area": c.area, "editando": c.editando}
            for c in por_pessoa.values()
        ]

    async def _enviar_presenca(self) -> None:
        await self._transmitir({"tipo": "presenca", "pessoas": self.pessoas()})

    async def publicar_alteracao(self, recursos: set[str]) -> None:
        if recursos:
            await self._transmitir({"tipo": "alterado", "recursos": sorted(recursos)})

    async def _transmitir(self, mensagem: dict[str, object]) -> None:
        for con in list(self.conexoes.values()):
            try:
                await con.ws.send_json(mensagem)
            except Exception:  # noqa: BLE001 - conexão caída: remove e segue
                log.debug("Removendo conexão WebSocket caída")
                self.conexoes.pop(id(con.ws), None)


sala = Sala()


def agendar_publicacao(recursos: set[str]) -> None:
    """Chamado de contextos síncronos (eventos do SQLAlchemy) dentro do loop em execução."""
    with contextlib.suppress(RuntimeError):
        asyncio.get_running_loop().create_task(sala.publicar_alteracao(recursos))
