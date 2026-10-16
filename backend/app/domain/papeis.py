"""Papéis por empresa e a matriz papel → permissões. Único ponto de verdade; o front consome a lista de permissões."""

from typing import Final, Literal, get_args

Papel = Literal["admin", "financeiro", "comercial", "membro"]
Permissao = Literal["base", "comercial", "financeiro", "administracao"]

PAPEIS: Final[tuple[str, ...]] = get_args(Papel)
PERMISSOES: Final[tuple[str, ...]] = get_args(Permissao)

PERMISSOES_POR_PAPEL: Final[dict[str, frozenset[str]]] = {
    "admin": frozenset({"base", "comercial", "financeiro", "administracao"}),
    "financeiro": frozenset({"base", "financeiro"}),
    "comercial": frozenset({"base", "comercial"}),
    "membro": frozenset({"base"}),
}

PADRAO_PAPEL: Final[str] = "^(" + "|".join(PAPEIS) + ")$"


def permissoes_do_papel(papel: str | None) -> frozenset[str]:
    """Permissões de um papel; papel desconhecido ou ausente não concede nada."""
    return PERMISSOES_POR_PAPEL.get(papel or "", frozenset())


def ordenadas(permissoes: frozenset[str]) -> list[str]:
    """Lista estável (ordem da matriz) para devolver à API."""
    return [p for p in PERMISSOES if p in permissoes]


# Papéis de parceiro (cliente, fornecedor, funcionário, sócio…) que cada papel de usuário enxerga e edita.
# `None` = todos, inclusive papéis criados depois; funcionários e sócios (dados sensíveis) são só do admin.
PAPEIS_DE_PARCEIRO_POR_PAPEL: Final[dict[str, frozenset[str] | None]] = {
    "admin": None,
    "financeiro": frozenset({"cliente", "fornecedor"}),
    "comercial": frozenset({"cliente"}),
    "membro": frozenset(),
}


def papeis_de_parceiro_visiveis(papel: str | None) -> frozenset[str] | None:
    """Papéis de parceiro que o papel de usuário pode ver/editar (`None` = todos). Papel desconhecido não vê nenhum."""
    if papel in PAPEIS_DE_PARCEIRO_POR_PAPEL:
        return PAPEIS_DE_PARCEIRO_POR_PAPEL[papel]
    return frozenset()
