import { describe, expect, it } from "vitest";
import { nomesDeIcones } from "@/ui/icones";
import { ACOES_DAS_TELAS, ESTRUTURA_MENU, ICONES_DAS_TELAS } from "./menu";

const grupos = ESTRUTURA_MENU.flatMap((s) => s.itens.flatMap((i) => ("grupo" in i ? [i] : [])));
const telas = ESTRUTURA_MENU.flatMap((s) => s.itens.flatMap((i) => ("id" in i ? [i.id] : i.filhos)));

describe("grupo Cadastros", () => {
  it("reúne Clientes, Fornecedores, Funcionários e Sócios, nessa ordem", () => {
    const cadastros = grupos.find((g) => g.grupo === "Cadastros");
    expect(cadastros?.filhos).toEqual(["clientes", "fornecedores", "funcionarios", "socios"]);
  });

  it("cada cadastro oferece a ação rápida de criar", () => {
    expect(ACOES_DAS_TELAS.fornecedores?.map((a) => a.id)).toEqual(["novoFornecedor"]);
    expect(ACOES_DAS_TELAS.funcionarios?.map((a) => a.id)).toEqual(["novoFuncionario"]);
    expect(ACOES_DAS_TELAS.socios?.map((a) => a.id)).toEqual(["novoSocio"]);
  });
});

describe("fim do módulo Despesas", () => {
  it("o menu não tem Despesas nem Investimentos", () => {
    expect(telas.filter((id) => /despesa|investimento/i.test(id))).toEqual([]);
    expect(Object.keys(ACOES_DAS_TELAS).filter((id) => /despesa|investimento/i.test(id))).toEqual([]);
  });

  it("os fornecedores não ficam mais dentro do Financeiro", () => {
    const financeiro = grupos.find((g) => g.grupo === "Financeiro");
    expect(financeiro?.filhos).not.toContain("fin-parceiros");
    expect(financeiro?.filhos).toContain("fin-recorrencias");
  });
});

describe("catálogo do menu", () => {
  it("toda tela do menu tem um ícone que existe", () => {
    const existentes = new Set(nomesDeIcones());
    for (const id of telas) expect(existentes.has(ICONES_DAS_TELAS[id] ?? ""), `ícone da tela ${id}`).toBe(true);
    for (const g of grupos) expect(existentes.has(g.icone), `ícone do grupo ${g.grupo}`).toBe(true);
  });

  it("não repete tela no menu", () => {
    expect(new Set(telas).size).toBe(telas.length);
  });
});
