import { expect, test, type Page } from "@playwright/test";
import { abrir, estado, sessaoAberta, simularApi } from "./apoio";

const PAPEIS = [
  { codigo: "cliente", nome: "Cliente" },
  { codigo: "fornecedor", nome: "Fornecedor" },
  { codigo: "funcionario", nome: "Funcionário" },
  { codigo: "socio", nome: "Sócio" },
];

/** Os papéis e a lista de parceiros são controlados aqui; o resto vem das fixtures. */
async function cadastrosSimulados(page: Page, gravados: string[]): Promise<void> {
  await simularApi(page, { gravados });
  await page.route("**/api/v1/parceiros/papeis", (rota) => rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PAPEIS) }));
  await page.route("**/api/v1/parceiros", (rota) =>
    rota.request().method() === "GET" ? rota.fulfill({ status: 200, contentType: "application/json", body: "[]" }) : rota.fallback(),
  );
}

test.beforeEach(async ({ page }) => {
  await sessaoAberta(page, "fornecedores");
});

test("o grupo Cadastros reúne os quatro cadastros e o menu não tem Despesas", async ({ page }) => {
  await cadastrosSimulados(page, []);
  await abrir(page, "/fornecedores");
  const cadastros = page.locator("aside nav .sub-menu").filter({ has: page.locator("a[data-go='clientes']") });
  await expect(cadastros.locator("a")).toHaveText([/^Clientes\d*$/, "Fornecedores", "Funcionários", "Sócios"]) // Clientes mostra a contagem;
  await expect(page.locator("aside nav a[data-go='despesas']")).toHaveCount(0);
});

test("cada cadastro tem URL própria", async ({ page }) => {
  await cadastrosSimulados(page, []);
  await abrir(page, "/socios");
  expect(await estado(page)).toMatchObject({ url: "/socios", tela: "Sócios" });
  await abrir(page, "/funcionarios");
  expect(await estado(page)).toMatchObject({ url: "/funcionarios", tela: "Funcionários" });
});

test("o formulário abre com o papel da tela marcado e deixa marcar outros", async ({ page }) => {
  await cadastrosSimulados(page, []);
  await abrir(page, "/fornecedores");
  await page.locator("[data-act='novoFornecedor']").first().click();
  await expect(page.locator(".drawer input[name='papel'][value='fornecedor']")).toBeChecked();
  await expect(page.locator(".drawer input[name='papel'][value='socio']")).not.toBeChecked();
  await page.locator(".drawer input[name='papel'][value='cliente']").check();
  await expect(page.locator(".drawer input[name='papel']:checked")).toHaveCount(2);
});

test("a participação só aparece com o papel Sócio e é obrigatória", async ({ page }) => {
  const gravados: string[] = [];
  await cadastrosSimulados(page, gravados);
  await abrir(page, "/fornecedores");
  await page.locator("[data-act='novoFornecedor']").first().click();
  await expect(page.locator("#campoParticipacao")).toBeHidden();
  await page.locator(".drawer input[name='papel'][value='socio']").check();
  await expect(page.locator("#campoParticipacao")).toBeVisible();

  await page.fill("#f-nome", "Maria Souza");
  await page.locator("[data-salvar]").click();
  await expect(page.getByText(/participação do sócio/i)).toBeVisible();
  expect(gravados).toEqual([]);

  await page.fill("#f-participacao_percentual", "40");
  await page.locator("[data-salvar]").click();
  await expect.poll(() => gravados).toEqual(["POST /parceiros"]);
});

test("desmarcar Sócio esconde a participação de novo", async ({ page }) => {
  await cadastrosSimulados(page, []);
  await abrir(page, "/socios");
  await page.locator("[data-act='novoSocio']").first().click();
  await expect(page.locator("#campoParticipacao")).toBeVisible(); // o papel da tela já vem marcado
  await page.locator(".drawer input[name='papel'][value='socio']").uncheck();
  await expect(page.locator("#campoParticipacao")).toBeHidden();
});

test("o CPF/CNPJ é mascarado conforme o tipo de pessoa selecionado", async ({ page }) => {
  await cadastrosSimulados(page, []);
  await abrir(page, "/fornecedores");
  await page.locator("[data-act='novoFornecedor']").first().click();
  const doc = page.locator(".drawer #f-cpf_cnpj");
  await expect(doc).toHaveAttribute("placeholder", "00.000.000/0000-00");
  await doc.pressSequentially("11222333000181");
  await expect(doc).toHaveValue("11.222.333/0001-81");

  await page.selectOption(".drawer select[name='tipo_pessoa']", "PF");
  await expect(doc).toHaveAttribute("placeholder", "000.000.000-00");
  await expect(doc).toHaveValue("112.223.330-00");

  await doc.fill("");
  await doc.pressSequentially("529982247259");
  await expect(doc).toHaveValue("529.982.247-25");
});
