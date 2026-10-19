import { beforeEach, describe, expect, it, vi } from "vitest";
import { abrirCamada, reiniciarCamadas, voltarEhDeCamada } from "./voltar";

beforeEach(() => {
  reiniciarCamadas();
  vi.stubGlobal("history", { pushState: vi.fn(), back: vi.fn() });
  vi.stubGlobal("location", { href: "http://t/" });
});

describe("camadas", () => {
  it("Voltar com camada aberta a fecha e é consumido", () => {
    const aoVoltar = vi.fn();
    abrirCamada(aoVoltar);
    expect(voltarEhDeCamada()).toBe(true);
    expect(aoVoltar).toHaveBeenCalledOnce();
    expect(voltarEhDeCamada()).toBe(false);
  });
  it("fechar pela interface desfaz o histórico e ignora o popstate", () => {
    const aoVoltar = vi.fn();
    abrirCamada(aoVoltar).fechar();
    expect(history.back).toHaveBeenCalledOnce();
    expect(voltarEhDeCamada()).toBe(true);
    expect(aoVoltar).not.toHaveBeenCalled();
    expect(voltarEhDeCamada()).toBe(false);
  });
  it("camada aberta durante o retorno de outra só entra no histórico depois do popstate pendente", () => {
    abrirCamada(vi.fn()).fechar(); // ex.: a folha do combobox fecha…
    const aoVoltar = vi.fn();
    abrirCamada(aoVoltar); // …e a gaveta de cadastro rápido abre em seguida
    expect(history.pushState).toHaveBeenCalledTimes(1);
    expect(voltarEhDeCamada()).toBe(true); // popstate do retorno da folha
    expect(history.pushState).toHaveBeenCalledTimes(2);
    expect(aoVoltar).not.toHaveBeenCalled();
    expect(voltarEhDeCamada()).toBe(true); // Voltar do aparelho fecha a gaveta
    expect(aoVoltar).toHaveBeenCalledOnce();
  });
  it("fechar uma camada ainda adiada não mexe no histórico", () => {
    abrirCamada(vi.fn()).fechar();
    abrirCamada(vi.fn()).fechar();
    expect(history.back).toHaveBeenCalledTimes(1);
    expect(voltarEhDeCamada()).toBe(true);
    expect(history.pushState).toHaveBeenCalledTimes(1);
    expect(voltarEhDeCamada()).toBe(false);
  });
});
