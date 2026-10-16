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
});
