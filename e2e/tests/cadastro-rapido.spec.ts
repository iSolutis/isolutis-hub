import { expect, test, type Page } from "@playwright/test";
import { sessaoAberta, simularApi } from "./apoio";

const PAPEIS = [
  { codigo: "cliente", nome: "Cliente" },
  { codigo: "fornecedor", nome: "Fornecedor" },
  { codigo: "funcionario", nome: "Funcionário" },
  { codigo: "socio", nome: "Sócio" },
];

let gravados: string[];

async function entrar(page: Page, aba: string): Promise<void> {
  gravados = [];
  await simularApi(page, { gravados });
  await page.route("**/api/v1/parceiros/papeis", (rota) => rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PAPEIS) }));
  await sessaoAberta(page, aba);
  await page.goto("/");
  await page.locator("#view").waitFor();
}

test.describe("título", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, "fin-titulos");
    // O servidor devolve o parceiro com o nome e os papéis enviados.
    await page.route("**/api/v1/parceiros", async (rota) => {
      const req = rota.request();
      if (req.method() !== "POST") return rota.fallback();
      const corpo = req.postDataJSON() as { nome: string; papeis: string[] };
      gravados.push("POST /parceiros");
      await rota.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "p-novo", nome: corpo.nome, cpf_cnpj: null, tipo_pessoa: "PJ", papeis: corpo.papeis, versao: 1 }) });
    });
    await page.getByRole("button", { name: "Novo título" }).first().click();
    await page.locator(".drawer").waitFor();
  });

  test("cria o parceiro sem sair do título e o deixa selecionado", async ({ page }) => {
    await page.locator('select[name="tipo_conta"]').selectOption("P");
    await page.locator('input[name="valor_titulo"]').fill("150,00");
    const parceiro = page.getByRole("combobox", { name: "Parceiro de negócio" });
    await parceiro.click();
    await parceiro.fill("Acme Nova");
    await page.locator(".cbx-op", { hasText: "+ Cadastrar “Acme Nova”…" }).click();

    const empilhada = page.locator(".gaveta-camada.empilhada .drawer");
    await expect(empilhada).toBeVisible();
    await expect(page.locator(".drawer")).toHaveCount(2);
    await expect(empilhada.locator('input[name="nome"]')).toHaveValue("Acme Nova");
    await expect(empilhada.locator('input[name="papel"][value="fornecedor"]')).toBeChecked();
    await expect(empilhada.locator('input[name="papel"][value="cliente"]')).not.toBeChecked();

    await empilhada.locator("[data-salvar]").click();
    await expect(page.locator(".drawer")).toHaveCount(1);
    await expect(parceiro).toHaveValue(/Acme Nova/);
    await expect(page.locator('input[name="parceiro_id"]')).toHaveValue("p-novo");
    await expect(page.locator('input[name="valor_titulo"]')).toHaveValue("150,00");
    expect(gravados.filter((g) => g === "POST /parceiros")).toHaveLength(1);
  });

  test("Esc fecha só o cadastro rápido e nada é criado", async ({ page }) => {
    await page.locator('input[name="valor_titulo"]').fill("99,00");
    await page.getByRole("combobox", { name: "Parceiro de negócio" }).click();
    await page.locator(".cbx-op", { hasText: "+ Novo parceiro…" }).click();
    await expect(page.locator(".gaveta-camada.empilhada .drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".gaveta-camada.empilhada")).toHaveCount(0);
    await expect(page.locator(".drawer")).toHaveCount(1);
    await expect(page.locator('input[name="valor_titulo"]')).toHaveValue("99,00");
    await expect(page.locator('input[name="parceiro_id"]')).toHaveValue("");
    expect(gravados).toHaveLength(0);
  });

  test("conta do plano não oferece cadastro rápido", async ({ page }) => {
    await page.getByRole("combobox", { name: "Conta do plano de contas" }).click();
    await expect(page.locator(".cbx-op", { hasText: "+ " })).toHaveCount(0);
  });
});

test("orçamento: cria o cliente pelo cadastro rápido e não o duplica quando o orçamento falha", async ({ page }) => {
  await entrar(page, "orcamentos");
  let falhar = true;
  await page.route("**/api/v1/orcamentos", async (rota) => {
    if (rota.request().method() === "POST" && falhar) {
      falhar = false;
      return rota.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ erro: { codigo: "interno", mensagem: "Falhou." } }) });
    }
    await rota.fallback();
  });
  await page.getByRole("button", { name: "Novo orçamento" }).first().click();
  await page.locator(".drawer").waitFor();

  const cliente = page.getByRole("combobox", { name: "Cliente" });
  await cliente.click();
  await page.locator(".cbx-op", { hasText: "+ Novo cliente…" }).click();
  const empilhada = page.locator(".gaveta-camada.empilhada .drawer");
  await empilhada.locator('input[name="nome"]').fill("Clínica Horizonte");
  await expect(empilhada.locator('input[name="cpf_cnpj"]')).toBeVisible();
  await expect(empilhada.locator('input[name="endereco"]')).toHaveCount(0); // formulário reduzido
  await empilhada.locator("[data-salvar]").click();
  await expect(page.locator(".drawer")).toHaveCount(1);
  await expect(page.locator('input[name="cliente_id"]')).not.toHaveValue("");

  await page.locator("#itens input[data-k='descricao']").first().fill("Implantação");
  const salvar = page.locator(".drawer [data-salvar]");
  await salvar.click(); // falha
  await expect(salvar).toBeEnabled();
  await salvar.click(); // nova tentativa
  await expect.poll(() => gravados.filter((g) => g.startsWith("POST /orcamentos")).length).toBe(1);
  expect(gravados.filter((g) => g === "POST /clientes")).toHaveLength(1);
});

test.describe("tela estreita", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("folha de seleção → cadastro rápido → Voltar do aparelho fecha só a gaveta empilhada", async ({ page }) => {
    await entrar(page, "fin-titulos");
    await page.getByRole("button", { name: "Novo título" }).first().click();
    await page.locator(".drawer").waitFor();
    const url = page.url();
    await page.getByRole("combobox", { name: "Parceiro de negócio" }).click();
    await expect(page.locator(".cbx-folha")).toBeVisible();
    await page.locator(".cbx-folha .cbx-op", { hasText: "+ Novo parceiro…" }).click();
    await expect(page.locator(".cbx-folha")).toHaveCount(0);
    await expect(page.locator(".gaveta-camada.empilhada .drawer")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".gaveta-camada.empilhada")).toHaveCount(0);
    await expect(page.locator(".drawer")).toHaveCount(1);
    expect(page.url()).toBe(url);
    await page.goBack(); // o Voltar seguinte segue o comportamento de sempre da gaveta de base
    await expect(page.locator(".gaveta-camada.empilhada")).toHaveCount(0);
  });
});
