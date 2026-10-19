// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { html } from "@/core/html";
import { reiniciarCamadas } from "@/state/voltar";
import { abrirGaveta, gavetasAbertas } from "./gaveta";
import { fecharRegistro, registroAberto } from "./registro-aberto";

const camadas = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("#layer > .gaveta-camada")];
const esc = (): boolean => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

function abrir(nome: string, empilhar = false, registro?: { recurso: string; id: string; versao: number }): () => void {
  return abrirGaveta({ titulo: nome, corpo: html`<input name="${nome}">`, rodape: html``, empilhar, registro });
}

beforeEach(() => {
  while (gavetasAbertas()) esc();
  document.body.innerHTML = '<button id="origem">origem</button><div id="layer"></div>';
  reiniciarCamadas();
  fecharRegistro();
});

describe("pilha de gavetas", () => {
  it("abrir uma gaveta comum substitui a que estiver aberta", () => {
    abrir("a");
    abrir("b");
    expect(camadas()).toHaveLength(1);
    expect(document.querySelector("[name=a]")).toBeNull();
    expect(gavetasAbertas()).toBe(1);
  });

  it("empilhar mantém a gaveta de baixo montada, com os valores, e inerte", () => {
    abrir("a");
    const campoA = document.querySelector<HTMLInputElement>("[name=a]")!;
    campoA.value = "digitado";
    abrir("b", true);
    expect(camadas()).toHaveLength(2);
    expect(camadas()[0]!.inert).toBe(true);
    expect(camadas()[1]!.classList.contains("empilhada")).toBe(true);
    expect(document.querySelectorAll("#gform")).toHaveLength(1);
    esc();
    expect(camadas()).toHaveLength(1);
    expect(camadas()[0]!.inert).toBe(false);
    expect(document.querySelector<HTMLInputElement>("[name=a]")!.value).toBe("digitado");
  });

  it("Esc fecha só a gaveta do topo", () => {
    abrir("a");
    abrir("b", true);
    esc();
    expect(gavetasAbertas()).toBe(1);
    expect(document.querySelector("[name=a]")).not.toBeNull();
    esc();
    expect(gavetasAbertas()).toBe(0);
  });

  it("empilhar sem gaveta aberta abre uma gaveta comum", () => {
    abrir("b", true);
    expect(camadas()[0]!.classList.contains("empilhada")).toBe(false);
  });

  it("restaura o registro aberto da gaveta de baixo ao fechar a empilhada", () => {
    abrir("a", false, { recurso: "titulos", id: "t1", versao: 3 });
    const fecharB = abrir("b", true);
    expect(registroAberto).toBeNull();
    fecharB();
    expect(registroAberto?.id).toBe("t1");
  });

  it("devolve o foco a quem abriu a gaveta empilhada", () => {
    abrir("a");
    const campoA = document.querySelector<HTMLInputElement>("[name=a]")!;
    campoA.focus();
    const fecharB = abrir("b", true);
    expect(document.activeElement?.getAttribute("name")).toBe("b");
    fecharB();
    expect(document.activeElement).toBe(campoA);
  });
});
