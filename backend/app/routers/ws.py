import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db import SessionLocal
from app.models import Usuario
from app.realtime import sala
from app.security import ler_token

router = APIRouter(tags=["Tempo real"])

CODIGO_NAO_AUTORIZADO = 4401


@router.websocket("/ws")
async def tempo_real(ws: WebSocket) -> None:
    """Primeira mensagem do cliente: {"tipo": "auth", "token": "<jwt>"}. Depois, presença e avisos de alteração."""
    await ws.accept()
    try:
        primeira = json.loads(await ws.receive_text())
    except (WebSocketDisconnect, ValueError):
        await ws.close(code=CODIGO_NAO_AUTORIZADO)
        return
    usuario_id = ler_token(str(primeira.get("token", ""))) if primeira.get("tipo") == "auth" else None
    async with SessionLocal() as sessao:
        usuario = await sessao.get(Usuario, usuario_id) if usuario_id else None
        nome, ativo = (usuario.nome, usuario.ativo) if usuario else ("", False)
    if usuario is None or not ativo:
        await ws.close(code=CODIGO_NAO_AUTORIZADO)
        return

    con = await sala.entrar(ws, usuario.id, nome)
    try:
        while True:
            mensagem = json.loads(await ws.receive_text())
            if mensagem.get("tipo") == "presenca":
                await sala.atualizar_presenca(con, str(mensagem.get("area") or ""), mensagem.get("editando"))
    except (WebSocketDisconnect, ValueError):
        pass
    finally:
        await sala.sair(con)
