import { describe, expect, it } from "vitest";
import { dadosDe, mascararCep, problemaNaLogo, valoresDe } from "./empresa";

describe("máscaras", () => {
  it("CEP", () => {
    expect(mascararCep("40000000")).toBe("40000-000");
    expect(mascararCep("4000")).toBe("4000");
  });
});

describe("formulário ↔ API", () => {
  const salvo = { id: "e1", nome: "Alfa", tipo_inscricao: "CNPJ", inscricao: "11222333000181", cep: "40000000", uf: "BA", municipio_id: "m1" } as const;

  it("ida e volta preserva os valores e envia vazios como nulos", () => {
    const v = valoresDe(salvo);
    expect(v.inscricao).toBe("11.222.333/0001-81");
    expect(v.cep).toBe("40000-000");
    const d = dadosDe(v);
    expect(d).toMatchObject({ nome: "Alfa", tipo_inscricao: "CNPJ", inscricao: "11.222.333/0001-81", municipio_id: "m1", email: null, regime_tributario: null });
    expect(d).not.toHaveProperty("uf");
  });

  it("sem número de inscrição, o tipo não é enviado", () => {
    expect(dadosDe({ ...valoresDe(salvo), inscricao: "  " })).toMatchObject({ inscricao: null, tipo_inscricao: null });
  });
});

describe("problemaNaLogo", () => {
  it("aceita PNG/JPEG/WebP até 512 KB e recusa o resto", () => {
    expect(problemaNaLogo({ type: "image/png", size: 1000 })).toBeNull();
    expect(problemaNaLogo({ type: "image/webp", size: 512 * 1024 })).toBeNull();
    expect(problemaNaLogo({ type: "image/svg+xml", size: 1000 })).toMatch(/PNG, JPEG ou WebP/);
    expect(problemaNaLogo({ type: "image/jpeg", size: 512 * 1024 + 1 })).toMatch(/512 KB/);
  });
});
