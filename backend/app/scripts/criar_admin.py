"""Cria (ou promove e redefine a senha de) um administrador.

  python -m app.scripts.criar_admin --email voce@empresa.com.br --nome "Seu Nome"
A senha é pedida no terminal (ou passe --senha; evite em histórico de shell).
"""

import argparse
import asyncio
import getpass

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Usuario
from app.security import TAMANHO_MINIMO_SENHA, gerar_hash


async def criar(email: str, nome: str, senha: str) -> bool:
    async with SessionLocal() as sessao:
        usuario = await sessao.scalar(select(Usuario).where(Usuario.email == email))
        novo = usuario is None
        if usuario is None:
            usuario = Usuario(email=email.lower(), nome=nome)
            sessao.add(usuario)
        usuario.nome, usuario.admin, usuario.ativo = nome, True, True
        usuario.senha_hash = gerar_hash(senha)
        await sessao.commit()
        return novo


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--email", required=True)
    ap.add_argument("--nome", required=True)
    ap.add_argument("--senha")
    args = ap.parse_args()
    senha = args.senha or getpass.getpass("Senha: ")
    if len(senha) < TAMANHO_MINIMO_SENHA:
        raise SystemExit(f"A senha precisa ter pelo menos {TAMANHO_MINIMO_SENHA} caracteres.")
    novo = asyncio.run(criar(args.email, args.nome, senha))
    print("Administrador criado." if novo else "Administrador atualizado.")


if __name__ == "__main__":
    main()
