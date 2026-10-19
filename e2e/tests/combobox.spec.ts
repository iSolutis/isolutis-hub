import { expect, test, type Page } from "@playwright/test";
import { sessaoAberta, simularApi } from "./apoio";

test.beforeEach(async ({ page }) => {
  await simularApi(page);
  await sessaoAberta(page, "fin-contas");
});

/** Abre a gaveta "Nova conta bancária", cujo campo Instituição é um combobox. */
async function abrirGaveta(page: Page): Promise<void> {
  await page.goto("/");
  // Depois do login a aplicação pergunta a empresa, mesmo quando só há uma.
  await page.locator(".emp-card").click();
  await page.locator("#view").waitFor();
  await page.getByRole("button", { name: "Nova conta bancária" }).click();
  await page.locator(".drawer").waitFor();
}

const estreito = (page: Page): boolean => (page.viewportSize()?.width ?? 1280) <= 860;

test("digitar filtra a lista e escolher grava o valor", async ({ page }) => {
  await abrirGaveta(page);
  const campo = page.getByRole("combobox", { name: "Instituição financeira" });
  if (estreito(page)) {
    await campo.tap();
    await page.locator(".cbx-folha").waitFor();
    await page.locator(".cbx-busca-in").fill("mercado");
  } else {
    await campo.click();
    await campo.fill("mercado");
  }
  const opcoes = page.locator(".cbx-op");
  await expect(opcoes).toHaveCount(1);
  await opcoes.first().click();
  await expect(page.locator('input[name="instituicao_financeira_id"]')).not.toHaveValue("");
  await expect(page.locator(".cbx-lista, .cbx-folha")).toHaveCount(0);
  await expect(campo).toHaveValue(/Mercado Bela Vista/);
});

test("Esc fecha só a seleção; a gaveta continua aberta (telas largas)", async ({ page }) => {
  test.skip(estreito(page), "a folha fecha pelo botão Voltar");
  await abrirGaveta(page);
  const campo = page.getByRole("combobox", { name: "Instituição financeira" });
  await campo.click();
  await expect(page.locator(".cbx-lista")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".cbx-lista")).toHaveCount(0);
  await expect(page.locator(".drawer")).toBeVisible();
});

test("a lista não é cortada pela rolagem da gaveta (telas largas)", async ({ page }) => {
  test.skip(estreito(page), "só a folha em tela estreita");
  await abrirGaveta(page);
  await page.getByRole("combobox", { name: "Instituição financeira" }).click();
  const caixa = await page.locator(".cbx-lista").boundingBox();
  expect(caixa).not.toBeNull();
  expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(page.locator(".cbx-lista .cbx-op").first()).toBeVisible();
});

test("o botão Voltar do aparelho fecha só a folha (telas estreitas)", async ({ page }) => {
  test.skip(!estreito(page), "a folha só existe em tela estreita");
  await abrirGaveta(page);
  const url = page.url();
  await page.getByRole("combobox", { name: "Instituição financeira" }).tap();
  await expect(page.locator(".cbx-folha")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".cbx-folha")).toHaveCount(0);
  await expect(page.locator(".drawer")).toBeVisible();
  expect(page.url()).toBe(url);
});

test("a folha usa busca de 16px e itens de ao menos 44px (telas estreitas)", async ({ page }) => {
  test.skip(!estreito(page), "a folha só existe em tela estreita");
  await abrirGaveta(page);
  await page.getByRole("combobox", { name: "Instituição financeira" }).tap();
  const tamanho = await page.locator(".cbx-busca-in").evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(tamanho).toBeGreaterThanOrEqual(16);
  const alturas = await page.locator(".cbx-folha .cbx-op").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(alturas.length).toBeGreaterThan(0);
  for (const h of alturas) expect(h).toBeGreaterThanOrEqual(44);
});
