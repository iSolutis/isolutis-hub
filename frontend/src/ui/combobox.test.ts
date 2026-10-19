// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { combobox, comboboxDe, filtrarOpcoes, type OpcaoCombobox } from "./combobox";
import { reiniciarCamadas } from "@/state/voltar";
import { html } from "@/core/html";
import { fv } from "./campos";
import { registrarCadastroRapido } from "./cadastro-rapido";
import { gavetasAbertas } from "./gaveta";

const plano: OpcaoCombobox[] = [
  { id: "1", codigo: "1.01.001", rotulo: "Caixa", grupo: "Ativo circulante" },
  { id: "2", codigo: "2.01.015", rotulo: "Fornecedores nacionais", grupo: "Passivo" },
  { id: "3", codigo: "3.02.001", rotulo: "Receita de serviços", grupo: "Receitas" },
  { id: "4", codigo: "4.01.007", rotulo: "Água e esgoto", grupo: "Despesas administrativas" },
];

function montar(extra: Partial<Parameters<typeof combobox>[0]> = {}) {
  document.body.innerHTML = `<form id="f">${combobox({ nome: "plano", rotulo: "Conta do plano", opcoes: plano, ...extra })}</form>`;
  const form = document.getElementById("f") as HTMLFormElement;
  const oculto = form.querySelector<HTMLInputElement>('input[name="plano"]')!;
  const campo = form.querySelector<HTMLInputElement>("#f-plano")!;
  return { form, oculto, campo, cbx: comboboxDe(form, "plano")! };
}

beforeEach(() => {
  reiniciarCamadas();
  document.body.innerHTML = "";
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
});

describe("filtrarOpcoes", () => {
  it("ignora acento e caixa", () => {
    expect(filtrarOpcoes(plano, "AGUA").itens.map((o) => o.id)).toEqual(["4"]);
    expect(filtrarOpcoes(plano, "servicos").itens.map((o) => o.id)).toEqual(["3"]);
  });
  it("casa pelo código e exige todos os termos", () => {
    expect(filtrarOpcoes(plano, "2.01").itens.map((o) => o.id)).toEqual(["2"]);
    expect(filtrarOpcoes(plano, "receita servicos").itens.map((o) => o.id)).toEqual(["3"]);
    expect(filtrarOpcoes(plano, "receita fornecedores").itens).toEqual([]);
  });
  it("casa pelo grupo, depois do nome", () => {
    expect(filtrarOpcoes(plano, "passivo").itens.map((o) => o.id)).toEqual(["2"]);
  });
  it("começo do nome vem antes de trecho no meio", () => {
    const o = [
      { id: "a", rotulo: "Taxa de caixa" },
      { id: "b", rotulo: "Caixa geral" },
    ];
    expect(filtrarOpcoes(o, "caixa").itens.map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("limita e informa o total", () => {
    const muitas = Array.from({ length: 120 }, (_, i) => ({ id: String(i), rotulo: `Conta ${i}` }));
    const r = filtrarOpcoes(muitas, "");
    expect(r.itens).toHaveLength(50);
    expect(r.total).toBe(120);
  });
});

describe("combobox", () => {
  it("renderiza valor inicial e papel ARIA", () => {
    const { oculto, campo } = montar({ valor: "2" });
    expect(oculto.value).toBe("2");
    expect(campo.value).toBe("2.01.015 Fornecedores nacionais");
    expect(campo.getAttribute("role")).toBe("combobox");
  });

  it("digitar filtra e Enter escolhe sem enviar o formulário", () => {
    const { form, oculto, campo } = montar();
    const enviar = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", enviar);
    const mudou = vi.fn();
    oculto.addEventListener("change", mudou);
    campo.focus();
    campo.value = "agua";
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelectorAll(".cbx-op")).toHaveLength(1);
    campo.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(oculto.value).toBe("4");
    expect(mudou).toHaveBeenCalledTimes(1);
    expect(enviar).not.toHaveBeenCalled();
    expect(document.querySelector(".cbx-lista")).toBeNull();
  });

  it("texto solto não vira valor: ao sair volta ao rótulo escolhido", () => {
    const { oculto, campo, cbx } = montar({ valor: "1" });
    campo.value = "xyz";
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    cbx.fechar(true);
    expect(oculto.value).toBe("1");
    expect(campo.value).toBe("1.01.001 Caixa");
  });

  it("campo vazio ao sair limpa a escolha", () => {
    const { oculto, campo, cbx } = montar({ valor: "1" });
    campo.value = "";
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    cbx.fechar(true);
    expect(oculto.value).toBe("");
  });

  it("definirValor e definirOpcoes", () => {
    const { oculto, campo, cbx } = montar({ valor: "1" });
    cbx.definirValor("3", { silencioso: true });
    expect(oculto.value).toBe("3");
    cbx.definirOpcoes(plano.filter((o) => o.id !== "3"));
    expect(oculto.value).toBe(""); // item sumiu
    expect(campo.value).toBe("");
    cbx.definirValor("desconhecido");
    expect(oculto.value).toBe("");
  });

  it("Esc fecha só a lista, na fase de captura", () => {
    const { campo } = montar();
    const naGaveta = vi.fn();
    document.addEventListener("keydown", naGaveta); // bolha, como a gaveta
    campo.focus();
    campo.click();
    expect(document.querySelector(".cbx-lista")).not.toBeNull();
    campo.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(document.querySelector(".cbx-lista")).toBeNull();
    expect(naGaveta).not.toHaveBeenCalledWith(expect.objectContaining({ key: "Escape" }));
    document.removeEventListener("keydown", naGaveta);
  });

  it("ação final fica visível com filtro e vira valor", () => {
    const { oculto, campo } = montar({ acaoFinal: { valor: "__novo", rotulo: "+ Novo…" } });
    campo.click();
    campo.value = "agua";
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    const ops = [...document.querySelectorAll<HTMLElement>(".cbx-op")];
    expect(ops.at(-1)?.textContent).toContain("+ Novo…");
    ops.at(-1)!.click();
    expect(oculto.value).toBe("__novo");
  });
});

describe("cadastro rápido", () => {
  let permitido = true;
  const criados: Array<{ id: string; nome: string }> = [];
  registrarCadastroRapido<{ nome: string }, { id: string; nome: string }>("conta-teste", {
    novo: "Nova conta",
    mensagem: "Conta cadastrada",
    recarregar: [],
    pode: () => permitido,
    campos: (ctx) => html`<input name="nome" value="${ctx.sugestao ?? ""}">`,
    ler: (f) => (fv(f, "nome") ? { nome: fv(f, "nome") } : null),
    criar: async (e) => {
      const c = { id: `n${criados.length + 1}`, nome: e.nome };
      criados.push(c);
      return c;
    },
    opcao: (c) => ({ id: c.id, rotulo: c.nome }),
    aceito: (c) => c.nome !== "Recusada",
  });

  const abrirLista = (campo: HTMLInputElement, texto = ""): HTMLElement[] => {
    campo.click();
    if (texto) {
      campo.value = texto;
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return [...document.querySelectorAll<HTMLElement>(".cbx-op")];
  };
  const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
  async function salvarNaGaveta(nome?: string): Promise<void> {
    const camada = document.querySelector<HTMLElement>(".gaveta-camada:last-child")!;
    const campoNome = camada.querySelector<HTMLInputElement>("[name=nome]")!;
    if (nome !== undefined) campoNome.value = nome;
    camada.querySelector<HTMLButtonElement>("[data-salvar]")!.click();
    for (let i = 0; i < 5; i++) await tick();
  }

  beforeEach(() => {
    while (gavetasAbertas()) document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    permitido = true;
    criados.length = 0;
  });

  function montarComCadastro() {
    const m = montar({ cadastroRapido: { tipo: "conta-teste" } });
    document.body.insertAdjacentHTML("beforeend", '<div id="layer"></div>');
    return m;
  }

  it("mostra “+ Nova conta…” sem texto e “+ Cadastrar “…”…” com texto", () => {
    const { campo } = montarComCadastro();
    expect(abrirLista(campo).at(-1)?.textContent).toBe("+ Nova conta…");
    expect(abrirLista(campo, "Banco X").at(-1)?.textContent).toBe("+ Cadastrar “Banco X”…");
  });

  it("não oferece sem permissão", () => {
    permitido = false;
    const { campo } = montarComCadastro();
    expect(abrirLista(campo).some((o) => o.textContent?.includes("Nova conta"))).toBe(false);
  });

  it("cria, inclui e seleciona o item, com a busca como sugestão", async () => {
    const { campo, oculto } = montarComCadastro();
    const mudou = vi.fn();
    oculto.addEventListener("change", mudou);
    abrirLista(campo, "Banco X").at(-1)!.click();
    expect(gavetasAbertas()).toBe(1);
    expect(document.querySelector<HTMLInputElement>(".gaveta-camada [name=nome]")!.value).toBe("Banco X");
    await salvarNaGaveta();
    expect(gavetasAbertas()).toBe(0);
    expect(oculto.value).toBe("n1");
    expect(campo.value).toBe("Banco X");
    expect(mudou).toHaveBeenCalledTimes(1);
    expect(oculto.value).not.toBe("__cadastro_rapido");
  });

  it("dentro do cadastro rápido nenhum campo oferece outro cadastro", () => {
    const { campo } = montarComCadastro();
    abrirLista(campo).at(-1)!.click();
    document.body.insertAdjacentHTML("beforeend", `<form id="g">${combobox({ nome: "outra", rotulo: "Outra", opcoes: plano, cadastroRapido: { tipo: "conta-teste" } })}</form>`);
    const outra = document.querySelector<HTMLInputElement>("#f-outra")!;
    expect(abrirLista(outra).some((o) => o.textContent?.includes("Nova conta"))).toBe(false);
  });

  it("item que não serve no campo é avisado e não selecionado", async () => {
    const { campo, oculto } = montarComCadastro();
    abrirLista(campo).at(-1)!.click();
    await salvarNaGaveta("Recusada");
    expect(oculto.value).toBe("");
    expect([...document.querySelectorAll(".toast")].map((t) => t.textContent).join(" ")).toContain("não pode ser usado");
  });

  it("desistir não muda o campo", async () => {
    const { campo, oculto } = montarComCadastro();
    abrirLista(campo).at(-1)!.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await tick();
    expect(gavetasAbertas()).toBe(0);
    expect(oculto.value).toBe("");
    expect(criados).toHaveLength(0);
  });
});
