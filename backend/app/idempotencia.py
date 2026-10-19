"""Idempotência de gravações (POST de criação).

O cliente envia `Idempotency-Key`. A dependência `idempotencia` reivindica a chave num commit próprio, antes do
handler; quando o handler responde com sucesso, `ProtegerPosts` guarda a resposta ANTES de enviar o último trecho
dela. Uma segunda requisição com a mesma chave:
  - espera a primeira terminar (até `ESPERA_MAXIMA`) e recebe a mesma resposta, sem criar de novo;
  - recebe 422 se a chave já foi usada em outra rota ou com outro corpo;
  - assume a chave de uma tentativa abandonada (processo que caiu) depois de `ABANDONO`.
Falha da primeira tentativa libera a chave, então o reenvio grava normalmente. Sem a chave nada muda.
"""

import asyncio
import hashlib
import random
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, FastAPI, Request
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.deps import Sessao, empresa_atual, usuario_atual
from app.errors import Conflito, RegraDeNegocio
from app.models import Empresa, Usuario

CABECALHO = "Idempotency-Key"
CHAVE_ESCOPO = "hub.idempotencia"  # no `scope` ASGI, que é por requisição (o `state` pode ser compartilhado)
ESPERA_MAXIMA = 15.0  # segundos esperando a primeira tentativa terminar
ABANDONO = 60  # segundos: tentativa "em andamento" mais velha que isso é considerada abandonada
VALIDADE_HORAS = 24
TAMANHO_MAXIMO_RESPOSTA = 256 * 1024


class RespostaRepetida(Exception):
    """A chave já tem resposta guardada: o tratador a devolve em vez de executar o handler."""

    def __init__(self, status: int, corpo: str) -> None:
        self.status, self.corpo = status, corpo


@dataclass
class Reivindicacao:
    sessao: AsyncSession
    chave: str


_INSERIR = text(
    "INSERT INTO idempotencia (empresa_id, usuario_id, chave, rota, corpo_hash) "
    "VALUES (app_empresa_id(), app_usuario_id(), :chave, :rota, :hash) ON CONFLICT DO NOTHING RETURNING 1"
)
_LER = text(
    "SELECT rota, corpo_hash, estado, codigo_http, resposta, extract(epoch FROM now() - criada_em) AS idade "
    "FROM idempotencia WHERE empresa_id = app_empresa_id() AND usuario_id = app_usuario_id() AND chave = :chave"
)
_ASSUMIR = text(
    "UPDATE idempotencia SET criada_em = now() WHERE empresa_id = app_empresa_id() AND usuario_id = app_usuario_id() "
    "AND chave = :chave AND estado = 'em_andamento' AND criada_em < now() - make_interval(secs => :abandono) RETURNING 1"
)
_CONCLUIR = text(
    "UPDATE idempotencia SET estado = 'concluida', codigo_http = :codigo, resposta = :resposta "
    "WHERE empresa_id = app_empresa_id() AND usuario_id = app_usuario_id() AND chave = :chave"
)
_LIBERAR = text(
    "DELETE FROM idempotencia WHERE empresa_id = app_empresa_id() AND usuario_id = app_usuario_id() AND chave = :chave"
)
_LIMPAR = text("DELETE FROM idempotencia WHERE criada_em < now() - make_interval(hours => :horas)")


async def idempotencia(
    request: Request,
    sessao: Sessao,
    _usuario: Annotated[Usuario, Depends(usuario_atual)],
    _empresa: Annotated[Empresa, Depends(empresa_atual)],
) -> None:
    """Dependência dos routers de dados: reivindica a chave do POST (ou repete a resposta já guardada)."""
    if request.method != "POST":
        return
    chave = (request.headers.get(CABECALHO) or "").strip()
    if not chave:
        return
    if len(chave) > 200:
        raise RegraDeNegocio("Chave de idempotência inválida.")
    rota = request.url.path
    corpo_hash = hashlib.sha256(await request.body()).hexdigest()
    prazo = asyncio.get_running_loop().time() + ESPERA_MAXIMA
    while True:
        if (await sessao.execute(_INSERIR, {"chave": chave, "rota": rota, "hash": corpo_hash})).first():
            await sessao.commit()
            request.scope[CHAVE_ESCOPO] = Reivindicacao(sessao, chave)
            if random.random() < 0.01:  # limpeza oportunista (não há processo fixo em ambiente sem servidor)
                await sessao.execute(_LIMPAR, {"horas": VALIDADE_HORAS})
                await sessao.commit()
            return
        linha = (await sessao.execute(_LER, {"chave": chave})).first()
        await sessao.commit()
        if linha is None:  # liberada entre o INSERT e a leitura: tenta reivindicar de novo
            continue
        if linha.rota != rota or linha.corpo_hash != corpo_hash:
            raise RegraDeNegocio("Esta chave de idempotência já foi usada em outra operação.", codigo="chave_reutilizada")
        if linha.estado == "concluida":
            raise RespostaRepetida(linha.codigo_http, linha.resposta or "")
        if linha.idade > ABANDONO:
            if (await sessao.execute(_ASSUMIR, {"chave": chave, "abandono": ABANDONO})).first():
                await sessao.commit()
                request.scope[CHAVE_ESCOPO] = Reivindicacao(sessao, chave)
                return
            await sessao.commit()
            continue
        if asyncio.get_running_loop().time() > prazo:
            raise Conflito("A gravação anterior ainda está em andamento. Aguarde e confira antes de tentar de novo.", codigo="gravacao_em_andamento")
        await asyncio.sleep(0.25)


async def _liberar(r: Reivindicacao) -> None:
    await r.sessao.rollback()
    await r.sessao.execute(_LIBERAR, {"chave": r.chave})
    await r.sessao.commit()


class ProtegerPosts:
    """Middleware ASGI: guarda a resposta de sucesso de um POST com chave (ou libera a chave em erro) antes de
    enviar o último trecho dela. Sem reivindicação na requisição (sem chave, rota sem a dependência) não faz nada."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] != "POST" or not scope["path"].startswith("/api/v1"):
            return await self.app(scope, receive, send)
        estado: dict[str, object] = {"status": 0, "json": False, "corpo": bytearray(), "grande": False}

        async def enviar(msg: Message) -> None:
            r: Reivindicacao | None = scope.get(CHAVE_ESCOPO)
            if r is not None and not estado.get("fim"):
                if msg["type"] == "http.response.start":
                    estado["status"] = msg["status"]
                    estado["json"] = b"json" in dict(msg.get("headers", [])).get(b"content-type", b"")
                elif msg["type"] == "http.response.body":
                    corpo: bytearray = estado["corpo"]  # type: ignore[assignment]
                    corpo.extend(msg.get("body", b""))
                    if len(corpo) > TAMANHO_MAXIMO_RESPOSTA:
                        estado["grande"] = True
                    if not msg.get("more_body"):
                        estado["fim"] = True
                        if 200 <= int(estado["status"]) < 300 and estado["json"] and not estado["grande"]:  # type: ignore[call-overload]
                            await r.sessao.execute(_CONCLUIR, {"chave": r.chave, "codigo": estado["status"], "resposta": bytes(corpo).decode()})
                            await r.sessao.commit()
                        else:
                            await _liberar(r)
            await send(msg)

        try:
            await self.app(scope, receive, enviar)
        except BaseException:
            r = scope.get(CHAVE_ESCOPO)
            if r is not None and not estado.get("fim"):
                estado["fim"] = True
                await _liberar(r)
            raise


def registrar_tratador(app: FastAPI) -> None:
    @app.exception_handler(RespostaRepetida)
    async def _repetida(_: Request, e: RespostaRepetida) -> Response:
        return Response(content=e.corpo, status_code=e.status, media_type="application/json", headers={"Idempotent-Replay": "true"})
