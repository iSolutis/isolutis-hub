"""Dados da empresa ativa: cadastro completo, logomarca e paleta de cores.

Qualquer papel lê (a casca do Hub mostra a logomarca e aplica a paleta para todos); só administradores alteram.
"""

from fastapi import APIRouter, Depends, Response

from app.deps import Administrador, EmpresaAtual, Sessao, requer_base
from app.schemas.empresa import EmpresaDados, EmpresaLeitura, LogoEntrada, Paleta
from app.services import empresa as svc

router = APIRouter(prefix="/empresas/ativa", tags=["Empresa"])


@router.get("", dependencies=[Depends(requer_base)])
async def obter(empresa: EmpresaAtual, sessao: Sessao) -> EmpresaLeitura:
    return await svc.leitura(sessao, empresa)


@router.put("")
async def atualizar(dados: EmpresaDados, empresa: EmpresaAtual, _: Administrador, sessao: Sessao) -> EmpresaLeitura:
    return await svc.atualizar(sessao, empresa, dados)


@router.put("/logo")
async def definir_logo(dados: LogoEntrada, empresa: EmpresaAtual, _: Administrador, sessao: Sessao) -> EmpresaLeitura:
    return await svc.definir_logo(sessao, empresa, dados.imagem)


@router.delete("/logo", status_code=204)
async def remover_logo(empresa: EmpresaAtual, _: Administrador, sessao: Sessao) -> Response:
    await svc.remover_logo(sessao, empresa)
    return Response(status_code=204)


@router.put("/paleta")
async def definir_paleta(dados: Paleta, empresa: EmpresaAtual, _: Administrador, sessao: Sessao) -> EmpresaLeitura:
    return await svc.definir_paleta(sessao, empresa, dados)


@router.delete("/paleta")
async def restaurar_paleta(empresa: EmpresaAtual, _: Administrador, sessao: Sessao) -> EmpresaLeitura:
    """Volta à paleta padrão do Hub."""
    return await svc.definir_paleta(sessao, empresa, None)
