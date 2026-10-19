"""Escopo de acesso dentro da empresa (migração 0015): o banco decide quem vê e edita o quê; aqui ficam as
perguntas que a API faz a ele antes de gravar, para responder com mensagens claras em vez de erro de banco.

Regras: openspec/changes/escopo-de-acesso. Fora do escopo = "não encontrado" (sem revelar existência);
visível mas não editável = 403.
"""

from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ErroApp, NaoEncontrado, SemPermissao
from app.models import Usuario, UsuarioEmpresa

Entidade = Literal["cliente", "negocio", "orcamento", "projeto", "etapa", "tarefa"]
_NOMES = {
    "cliente": "Cliente", "negocio": "Negócio", "orcamento": "Orçamento",
    "projeto": "Projeto", "etapa": "Etapa", "tarefa": "Tarefa",
}  # fmt: skip
_FUNCOES_EDITAR: dict[str, str] = {e: f"app_pode_editar_{e}" for e in _NOMES}

MSG_SO_LEITURA = "Você pode ver este registro, mas não alterá-lo. Fale com o responsável ou com o líder dele."
MSG_ATRIBUICAO = "Só o líder da equipe ou um administrador pode definir este responsável."


@dataclass(frozen=True)
class Escopo:
    usuario_id: UUID | None
    ve_tudo: bool
    lider: bool
    visiveis: frozenset[UUID]

    @property
    def define_dono(self) -> bool:
        """Pode criar sem dono ou atribuir a outra pessoa (sempre dentro do próprio escopo, salvo admin)."""
        return self.ve_tudo or self.lider


async def atual(sessao: AsyncSession) -> Escopo:
    linha = (await sessao.execute(text("select app_ve_tudo(), app_lider(), app_usuarios_visiveis()"))).one()
    return Escopo(sessao.info.get("usuario_id"), bool(linha[0]), bool(linha[1]), frozenset(linha[2] or ()))


async def dono_padrao(sessao: AsyncSession, informado: bool, valor: UUID | None) -> UUID | None:
    """Registro novo nasce com quem o criou como dono; só líder/admin cria sem dono ou para outra pessoa
    (o banco confere o mesmo no gatilho)."""
    escopo = await atual(sessao)
    if valor is None and (not informado or not escopo.define_dono):
        return escopo.usuario_id
    return valor


async def exigir_edicao(sessao: AsyncSession, entidade: Entidade, id_: UUID) -> None:
    pode = await sessao.scalar(text(f"select {_FUNCOES_EDITAR[entidade]}(:id)"), {"id": id_})
    if not pode:
        raise SemPermissao(MSG_SO_LEITURA)


async def exigir_vinculo_cliente(
    sessao: AsyncSession, cliente_id: UUID | None, negocio_id: UUID | None = None, projeto_id: UUID | None = None
) -> None:
    """Cliente fora do escopo é tratado como inexistente (o banco também recusa o vínculo)."""
    if cliente_id is None:
        return
    ok = await sessao.scalar(
        text(
            "select app_pode_vincular_cliente(:c, :n, :p) and exists "
            "(select 1 from parceiro_papel pp where pp.parceiro_id = :c and pp.papel = 'cliente')"
        ),
        {"c": cliente_id, "n": negocio_id, "p": projeto_id},
    )
    if not ok:
        raise NaoEncontrado("Cliente")


async def pessoas_atribuiveis(sessao: AsyncSession, empresa_id: UUID) -> list[tuple[UUID, str]]:
    """Quem a pessoa pode pôr como dono: todos (admin), ela e os liderados (líder) ou só ela."""
    escopo = await atual(sessao)
    consulta = (
        select(Usuario.id, Usuario.nome)
        .join(UsuarioEmpresa, UsuarioEmpresa.usuario_id == Usuario.id)
        .where(UsuarioEmpresa.empresa_id == empresa_id, UsuarioEmpresa.ativo, Usuario.ativo)
        .order_by(Usuario.nome)
    )
    if not escopo.ve_tudo:
        consulta = consulta.where(Usuario.id.in_(escopo.visiveis or {escopo.usuario_id}))
    return [(id_, nome) for id_, nome in (await sessao.execute(consulta)).all()]


def traduzir_erro_de_escopo(erro: DBAPIError) -> ErroApp | None:
    """Recusas do banco (RLS e gatilhos de escopo, SQLSTATE 42501) viram respostas da API."""
    orig = getattr(erro, "orig", None)
    if getattr(orig, "sqlstate", None) != "42501":
        return None
    dica = getattr(getattr(orig, "diag", None), "message_hint", None)
    if dica == "escopo_dono":
        return SemPermissao(MSG_ATRIBUICAO)
    if dica == "escopo_cliente":
        return NaoEncontrado("Cliente")
    return NaoEncontrado("Registro")


def nome_da_entidade(entidade: Entidade) -> str:
    return _NOMES[entidade]
