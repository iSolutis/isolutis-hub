import { afterEach, describe, expect, it, vi } from "vitest";
import { http, idempotencia } from "./http";

afterEach(() => {
  idempotencia.encerrar();
  vi.unstubAllGlobals();
});

function espiar() {
  const fetchSimulado = vi.fn(async () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchSimulado);
  const chaves = (): Array<string | undefined> => fetchSimulado.mock.calls.map((c) => ((c as unknown as [string, RequestInit])[1].headers as Record<string, string>)["Idempotency-Key"]);
  return chaves;
}

describe("chave de idempotência", () => {
  it("só vai em POST dentro de uma tentativa; ordem e corpo entram na chave", async () => {
    const chaves = espiar();
    await http.post("/x", { a: 1 });
    idempotencia.iniciar("tentativa");
    await http.post("/x", { a: 1 });
    await http.post("/y", { a: 2 });
    await http.get("/z");
    const [fora, primeira, segunda, leitura] = chaves();
    expect(fora).toBeUndefined();
    expect(primeira).toMatch(/^tentativa:1:/);
    expect(segunda).toMatch(/^tentativa:2:/);
    expect(leitura).toBeUndefined();
  });

  it("repetir a tentativa repete as chaves; corpo editado muda a chave", async () => {
    const chaves = espiar();
    idempotencia.iniciar("t");
    await http.post("/x", { nome: "A" });
    idempotencia.iniciar("t");
    await http.post("/x", { nome: "A" });
    idempotencia.iniciar("t");
    await http.post("/x", { nome: "B" });
    const [a, b, c] = chaves();
    expect(b).toBe(a);
    expect(c).not.toBe(a);
  });
});
