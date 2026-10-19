import { expect, test } from "@playwright/test";
import { sessaoAberta, simularApi } from "./apoio";

let gravados: string[];

test.beforeEach(async ({ page }) => {
  gravados = [];
  await simularApi(page, { gravados });
  await sessaoAberta(page, "fin-contas");
  await page.goto("/");
  await page.locator(".emp-card").click();
  await page.locator("#view").waitFor();
});

test("duplo clique em Salvar grava uma vez só e a gaveta fecha", async ({ page }) => {
  // atrasa o servidor para o segundo clique cair durante a gravação
  await page.route("**/api/v1/financeiro/contas-bancarias", async (rota) => {
    if (rota.request().method() === "POST") await new Promise((r) => setTimeout(r, 600));
    await rota.fallback();
  });
  await page.getByRole("button", { name: "Nova conta bancária" }).click();
  await page.getByRole("combobox", { name: "Instituição financeira" }).click();
  await page.locator(".cbx-op").first().click();
  await page.locator('input[name="nome"]').fill("Conta principal");
  const salvar = page.locator(".drawer [data-salvar]");
  await salvar.dblclick();
  await expect(salvar).toBeDisabled();
  await expect(salvar).toContainText("Salvando…");
  await expect(page.locator(".drawer")).toHaveCount(0);
  expect(gravados.filter((g) => g.startsWith("POST /financeiro/contas-bancarias"))).toHaveLength(1);
});

test("erro na gravação devolve o botão ao normal e mantém o que foi digitado", async ({ page }) => {
  await page.route("**/api/v1/financeiro/contas-bancarias", async (rota) => {
    if (rota.request().method() === "POST") {
      return rota.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ erro: { codigo: "regra_de_negocio", mensagem: "Nome já usado." } }) });
    }
    await rota.fallback();
  });
  await page.getByRole("button", { name: "Nova conta bancária" }).click();
  await page.getByRole("combobox", { name: "Instituição financeira" }).click();
  await page.locator(".cbx-op").first().click();
  await page.locator('input[name="nome"]').fill("Conta principal");
  const salvar = page.locator(".drawer [data-salvar]");
  await salvar.click();
  await expect(salvar).toBeEnabled();
  await expect(salvar).toHaveText("Salvar");
  await expect(page.locator('input[name="nome"]')).toHaveValue("Conta principal");
});
