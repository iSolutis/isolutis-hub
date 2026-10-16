// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const recarregar = vi.fn(async () => {});
vi.mock("@/state/nucleo", () => ({ recarregar: (...a: unknown[]) => (recarregar as (...x: unknown[]) => Promise<void>)(...a) }));
vi.mock("./toast", () => ({ toast: vi.fn() }));
vi.mock("./gaveta", () => ({ gavetaAberta: null }));
const tentar = vi.fn(async (fn: () => Promise<unknown>) => {
  try {
    return await fn();
  } catch {
    return null; // como `tentar` real: erro já mostrado, devolve null
  }
});
vi.mock("./erros", () => ({ tentar: (fn: () => Promise<unknown>) => tentar(fn) }));

import { comTrava, gravar } from "./gravacao";
import { toast } from "./toast";

let botao: HTMLButtonElement;
const adiar = () => {
  let liberar!: (v: unknown) => void;
  const p = new Promise((r) => (liberar = r));
  return { p, liberar };
};

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<button data-salvar>Salvar</button>';
  botao = document.querySelector("button")!;
});

describe("comTrava", () => {
  it("ignora cliques enquanto a gravação está em andamento", async () => {
    const espera = adiar();
    const fn = vi.fn(() => espera.p);
    const primeiro = comTrava(botao, fn);
    expect(botao.disabled).toBe(true);
    expect(botao.textContent).toContain("Salvando…");
    expect(await comTrava(botao, fn)).toBeUndefined();
    espera.liberar("ok");
    await primeiro;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("devolve o botão ao normal quando a operação avisa o erro e devolve null", async () => {
    await comTrava(botao, async () => null);
    expect(botao.disabled).toBe(false);
    expect(botao.textContent).toBe("Salvar");
    expect(botao.classList.contains("loading")).toBe(false);
  });

  it("devolve o botão ao normal quando a operação lança", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await comTrava(botao, async () => {
      throw new Error("x");
    });
    expect(botao.disabled).toBe(false);
    expect(botao.textContent).toBe("Salvar");
  });
});

describe("gravar", () => {
  const op = (resultado: unknown) => ({ recarregar: ["clientes"], mensagem: "Salvo", operacao: async () => resultado });

  it("fecha e confirma antes de a recarga terminar", async () => {
    const espera = adiar();
    recarregar.mockImplementationOnce(() => espera.p as Promise<void>);
    const fechar = vi.fn();
    const r = await gravar({ ...op({ id: "1" }), fechar });
    expect(r).toEqual({ id: "1" });
    expect(fechar).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith("Salvo");
    expect(recarregar).toHaveBeenCalledWith("clientes");
    espera.liberar(undefined);
  });

  it("avisa quando só a recarga falha, mantendo o registro gravado", async () => {
    recarregar.mockRejectedValueOnce(new Error("rede"));
    await gravar(op({ id: "1" }));
    await Promise.resolve();
    await Promise.resolve();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("Atualize a tela"));
  });

  it("solto, trava sozinho o botão Salvar e ignora a segunda chamada", async () => {
    const espera = adiar();
    const operacao = vi.fn(() => espera.p);
    const primeira = gravar({ recarregar: [], mensagem: "", operacao });
    expect(botao.disabled).toBe(true);
    expect(await gravar({ recarregar: [], mensagem: "", operacao })).toBeNull();
    espera.liberar({ id: "1" });
    await primeira;
    expect(operacao).toHaveBeenCalledTimes(1);
    expect(botao.disabled).toBe(false);
  });

  it("erro na operação devolve null e destrava", async () => {
    const r = await gravar({ recarregar: [], mensagem: "x", operacao: async () => Promise.reject(new Error("falhou")) });
    expect(r).toBeNull();
    expect(botao.disabled).toBe(false);
  });
});
