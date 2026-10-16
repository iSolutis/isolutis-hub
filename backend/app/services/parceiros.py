"""Cadastro único de parceiros (hub de papéis): regras compartilhadas por clientes e pelo módulo financeiro."""

from collections.abc import Iterable
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID

from sqlalchemy import exists, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.errors import NaoEncontrado, RegraDeNegocio, SemPermissao
from app.financeiro import regras
from app.models import (
    Empresa,
    LancamentoReceita,
    Municipio,
    Negocio,
    Orcamento,
    PapelParceiro,
    Parceiro,
    ParceiroPapel,
    ParceiroSocio,
    ParceiroTag,
    Projeto,
    Tarefa,
)
from app.services import escopo
from app.services.base import conferir_versao, confirmar

PAPEL_CLIENTE = "cliente"
PAPEL_SOCIO = "socio"
PAPEL_FORNECEDOR = "fornecedor"

# Papéis de parceiro que o usuário enxerga/edita; `None` = todos (chamadas internas, sem requisição).
Visiveis = frozenset[str] | None


async def empresa_atual(sessao: AsyncSession) -> Empresa:
    """Resolve a empresa validada na dependência da requisição; scripts devem defini-la explicitamente."""
    empresa_id = sessao.info.get("empresa_id")
    empresa = await sessao.get(Empresa, empresa_id) if isinstance(empresa_id, UUID) else None
    if empresa is None:
        raise RegraDeNegocio("Defina uma empresa ativa antes de acessar os dados operacionais.")
    return empresa


def consulta() -> object:
    return select(Parceiro).options(selectinload(Parceiro.papeis), selectinload(Parceiro.socio), joinedload(Parceiro.municipio))


def exigir_papel_visivel(papel: str | None, visiveis: Visiveis) -> None:
    if papel and visiveis is not None and papel not in visiveis:
        raise SemPermissao("Seu papel nesta empresa não permite acessar este tipo de cadastro.")


def _restringir(q: object, empresa: Empresa, visiveis: Visiveis) -> object:
    """Só parceiros com ao menos um papel visível: os demais não existem para quem consulta."""
    if visiveis is None:
        return q
    return q.where(exists().where(  # type: ignore[attr-defined]
        ParceiroPapel.empresa_id == empresa.id,
        ParceiroPapel.parceiro_id == Parceiro.id,
        ParceiroPapel.papel.in_(visiveis),
    ))


async def listar(
    sessao: AsyncSession, empresa: Empresa, papel: str | None = None, busca: str | None = None,
    tag_ids: Iterable[UUID] | None = None, visiveis: Visiveis = None,
) -> list[Parceiro]:
    exigir_papel_visivel(papel, visiveis)
    q = _restringir(consulta().where(Parceiro.empresa_id == empresa.id), empresa, visiveis).order_by(Parceiro.nome)  # type: ignore[attr-defined]
    if papel:
        q = q.where(exists().where(
            ParceiroPapel.empresa_id == empresa.id,
            ParceiroPapel.parceiro_id == Parceiro.id,
            ParceiroPapel.papel == papel,
        ))
    tags = set(tag_ids or ())
    if tags:
        q = q.where(exists().where(
            ParceiroTag.empresa_id == empresa.id,
            ParceiroTag.parceiro_id == Parceiro.id,
            ParceiroTag.tag_id.in_(tags),
        ))
    if busca:
        digitos = regras.so_digitos(busca)
        criterio = Parceiro.nome.ilike(f"%{busca.strip()}%")
        if digitos:
            criterio = criterio | Parceiro.cpf_cnpj.ilike(f"%{digitos}%")
        q = q.where(criterio)
    return list((await sessao.scalars(q)).unique().all())


async def obter_completo(
    sessao: AsyncSession, empresa: Empresa, id_: UUID, papel: str | None = None, visiveis: Visiveis = None
) -> Parceiro:
    q = _restringir(consulta().where(Parceiro.id == id_, Parceiro.empresa_id == empresa.id), empresa, visiveis)  # type: ignore[attr-defined]
    if papel:
        q = q.where(exists().where(
            ParceiroPapel.empresa_id == empresa.id,
            ParceiroPapel.parceiro_id == Parceiro.id,
            ParceiroPapel.papel == papel,
        ))
    parceiro = (await sessao.scalars(q.execution_options(populate_existing=True))).unique().first()
    if parceiro is None:
        raise NaoEncontrado("Cliente" if papel == PAPEL_CLIENTE else "Parceiro")
    return parceiro


async def exigir_cliente(sessao: AsyncSession, id_: UUID) -> Parceiro:
    """Garante que o id é de um parceiro com o papel de cliente (negócios, orçamentos etc. exigem isso)."""
    return await obter_completo(sessao, await empresa_atual(sessao), id_, PAPEL_CLIENTE)


async def cliente_para_documento(sessao: AsyncSession, id_: UUID, nome: str) -> Parceiro | SimpleNamespace:
    """Cliente completo para o documento se a pessoa enxerga o cadastro; senão, só o nome (escopo de acesso)."""
    try:
        return await exigir_cliente(sessao, id_)
    except NaoEncontrado:
        return SimpleNamespace(nome=nome, contato=None, cargo=None, cpf_cnpj=None, tipo_pessoa="PJ")


async def listar_papeis(sessao: AsyncSession, visiveis: Visiveis = None) -> list[PapelParceiro]:
    q = select(PapelParceiro).where(PapelParceiro.ativo).order_by(PapelParceiro.nome)
    if visiveis is not None:
        q = q.where(PapelParceiro.codigo.in_(visiveis))
    return list((await sessao.scalars(q)).all())


async def _validar(sessao: AsyncSession, campos: dict) -> None:
    doc = campos.get("cpf_cnpj")
    if doc and not regras.documento_valido(campos["tipo_pessoa"], doc):
        raise RegraDeNegocio(
            f"{'CPF' if campos['tipo_pessoa'] == 'PF' else 'CNPJ'} inválido. Confira os números digitados."
        )
    if campos.get("cep") and len(campos["cep"]) != 8:
        raise RegraDeNegocio("O CEP deve ter 8 dígitos.")
    if campos.get("municipio_id") and await sessao.get(Municipio, campos["municipio_id"]) is None:
        raise RegraDeNegocio("Escolha um município válido.")


async def _papeis_validos(sessao: AsyncSession, codigos: Iterable[str]) -> set[str]:
    codigos = set(codigos)
    if not codigos:
        raise RegraDeNegocio("Escolha pelo menos um papel (cliente, fornecedor, funcionário…).")
    ativos = {p.codigo for p in await listar_papeis(sessao)}
    desconhecidos = codigos - ativos
    if desconhecidos:
        raise RegraDeNegocio(f"Papel inválido: {', '.join(sorted(desconhecidos))}.")
    return codigos


async def _vinculos_como_cliente(sessao: AsyncSession, id_: UUID) -> int:
    total = 0
    for modelo in (Negocio, Orcamento, LancamentoReceita, Projeto, Tarefa):
        total += await sessao.scalar(select(func.count()).select_from(modelo).where(modelo.cliente_id == id_)) or 0
    return total


async def _aportes_do_socio(sessao: AsyncSession, id_: UUID) -> int:
    from app.financeiro.models import (  # evita ciclo: o módulo financeiro importa este serviço
        PlanoConta,
        TituloFinanceiro,
    )

    return (
        await sessao.scalar(
            select(func.count())
            .select_from(TituloFinanceiro)
            .join(PlanoConta, PlanoConta.id == TituloFinanceiro.plano_conta_id)
            .where(TituloFinanceiro.parceiro_id == id_, PlanoConta.aporte_socio)
        )
        or 0
    )


async def _participacao(
    sessao: AsyncSession, empresa: Empresa, parceiro: Parceiro, papeis: set[str], pedida: Decimal | None
) -> ParceiroSocio | None:
    """Mantém `parceiro_socio` coerente com o papel `socio`: exige o percentual, limita a soma a 100 e o apaga ao sair do papel."""
    if PAPEL_SOCIO not in papeis:
        return None
    existente = parceiro.socio if parceiro.id is not None else None
    valor = pedida if pedida is not None else (existente.participacao_percentual if existente else None)
    if valor is None:
        raise RegraDeNegocio("Informe a participação do sócio na empresa (maior que 0% e até 100%).")
    # Dois sócios gravados ao mesmo tempo não podem estourar os 100%: serializa por empresa até o fim da transação.
    await sessao.execute(text("select pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": f"socios:{empresa.id}"})
    outros = await sessao.scalar(
        select(func.coalesce(func.sum(ParceiroSocio.participacao_percentual), 0)).where(
            ParceiroSocio.empresa_id == empresa.id, ParceiroSocio.parceiro_id != parceiro.id
        )
    ) or Decimal(0)
    if outros + valor > 100:
        raise RegraDeNegocio(
            f"A soma das participações passaria de 100%: os outros sócios já têm {outros}%. Informe até {100 - outros}%."
        )
    if existente:
        existente.participacao_percentual = valor
        return existente
    return ParceiroSocio(empresa_id=empresa.id, participacao_percentual=valor)


async def criar(
    sessao: AsyncSession, empresa: Empresa, campos: dict, papeis: Iterable[str],
    participacao: Decimal | None = None, visiveis: Visiveis = None,
) -> Parceiro:
    await _validar(sessao, campos)
    campos["responsavel_id"] = await escopo.dono_padrao(sessao, "responsavel_id" in campos, campos.get("responsavel_id"))
    codigos = await _papeis_validos(sessao, papeis)
    if visiveis is not None and codigos - visiveis:
        raise SemPermissao("Seu papel nesta empresa não permite cadastrar parceiros com este papel.")
    parceiro = Parceiro(empresa_id=empresa.id, **campos, papeis=[ParceiroPapel(papel=c) for c in sorted(codigos)])
    parceiro.socio = await _participacao(sessao, empresa, parceiro, codigos, participacao)
    sessao.add(parceiro)
    await _confirmar(sessao)
    return await obter_completo(sessao, empresa, parceiro.id)


async def atualizar(
    sessao: AsyncSession, empresa: Empresa, id_: UUID, campos: dict, versao: int,
    papeis: Iterable[str] | None = None, participacao: Decimal | None = None, visiveis: Visiveis = None,
) -> Parceiro:
    parceiro = await obter_completo(sessao, empresa, id_, visiveis=visiveis)
    await escopo.exigir_edicao(sessao, "cliente", id_)
    conferir_versao(parceiro, versao)
    await _validar(sessao, campos)
    for nome, valor in campos.items():
        setattr(parceiro, nome, valor)
    if papeis is not None:
        pedidos = await _papeis_validos(sessao, papeis)
        atuais = set(parceiro.codigos_de_papel)
        if visiveis is not None:
            if pedidos - visiveis:
                raise SemPermissao("Seu papel nesta empresa não permite atribuir este papel de parceiro.")
            pedidos |= atuais - visiveis  # papéis que o usuário nem enxerga permanecem como estão
        novos = pedidos
        if PAPEL_CLIENTE in atuais - novos and await _vinculos_como_cliente(sessao, id_):
            raise RegraDeNegocio(
                "Este parceiro tem negócios, orçamentos, projetos, tarefas ou lançamentos como cliente e não pode deixar de ser cliente."
            )
        if PAPEL_SOCIO in atuais - novos and await _aportes_do_socio(sessao, id_):
            raise RegraDeNegocio("Este sócio tem aportes lançados e não pode deixar de ser sócio.")
        parceiro.papeis[:] = [p for p in parceiro.papeis if p.papel in novos] + [
            ParceiroPapel(papel=c) for c in sorted(novos - atuais)
        ]
        parceiro.socio = await _participacao(sessao, empresa, parceiro, novos, participacao)
    await _confirmar(sessao)
    return await obter_completo(sessao, empresa, id_)


async def excluir(
    sessao: AsyncSession, empresa: Empresa, id_: UUID, papel: str | None = None, visiveis: Visiveis = None
) -> None:
    """Exclui o parceiro. Com `papel` (fachada de clientes): se ele tem outros papéis, só retira esse papel."""
    parceiro = await obter_completo(sessao, empresa, id_, papel, visiveis)
    if visiveis is not None and set(parceiro.codigos_de_papel) - visiveis:
        raise SemPermissao("Este parceiro também tem papéis que o seu acesso não gerencia; peça a um administrador.")
    if papel == PAPEL_CLIENTE and await _vinculos_como_cliente(sessao, id_):
        raise RegraDeNegocio(
            "Este cliente tem negócios, orçamentos, projetos, tarefas ou faturamento. Exclua esses registros antes."
        )
    outros = [p for p in parceiro.papeis if p.papel != papel] if papel else []
    if papel and outros:
        parceiro.papeis[:] = outros
        await confirmar(sessao)
        return
    from app.financeiro.models import TituloFinanceiro  # evita ciclo: o módulo financeiro importa este serviço

    if await sessao.scalar(
        select(func.count()).select_from(TituloFinanceiro).where(TituloFinanceiro.parceiro_id == id_)
    ):
        raise RegraDeNegocio("Há títulos financeiros deste parceiro. Exclua ou mude esses títulos antes.")
    if await _vinculos_como_cliente(sessao, id_):
        raise RegraDeNegocio(
            "Este parceiro tem negócios, orçamentos, projetos, tarefas ou lançamentos como cliente. Exclua esses registros antes."
        )
    await sessao.delete(parceiro)
    await confirmar(sessao)


async def _confirmar(sessao: AsyncSession) -> None:
    try:
        await confirmar(sessao)
    except IntegrityError as e:
        await sessao.rollback()
        raise RegraDeNegocio("Já existe um parceiro com este CPF/CNPJ.") from e
