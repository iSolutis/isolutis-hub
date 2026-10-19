/**
 * Dados da empresa: cadastro completo (inscrição, identificação, contato, endereço e dados fiscais) e logomarca.
 * A logomarca substitui a logo padrão acima do menu e aparece nos documentos e relatórios gerados pelo Hub.
 *
 * Os valores digitados ficam em `tela.valores` a cada tecla: um redesenho vindo de outra área (dados da equipe
 * sincronizados) não apaga o que ainda não foi salvo.
 */
import type { components } from "@/api/schema";
import { api } from "@/api/endpoints";
import { acesso } from "@/state/estado";
import { html, raw, type Safe } from "@/core/html";
import { apiFinanceiro, type Municipio } from "@/features/financeiro/api";
import { formatarCep } from "@/features/financeiro/comum";
import { UFS } from "@/features/parceiros/campos";
import { registrarGuarda, registrarVista, render, vistaAtual } from "@/state/nucleo";
import { registrarAcao } from "@/ui/acoes";
import { cabecalhoDePagina, carregando, estadoDeErro } from "@/ui/componentes";
import { confirmar } from "@/ui/confirmar";
import { MAXLENGTH_DOCUMENTO, mascararDocumento, PLACEHOLDER_DOCUMENTO, reaplicarMascara, tipoDoDocumento, valorInicialDoDocumento } from "@/ui/documento";
import { aplicarLogo, lembrarIdentidade } from "@/ui/identidade";
import { tentar } from "@/ui/erros";
import { toast } from "@/ui/toast";

type EmpresaLeitura = components["schemas"]["EmpresaLeitura"];
type EmpresaDados = components["schemas"]["EmpresaDados"];

export const LOGO_MAX_BYTES = 512 * 1024;
export const TIPOS_DE_LOGO = ["image/png", "image/jpeg", "image/webp"] as const;

export const REGIMES: ReadonlyArray<readonly [string, string]> = [
  ["", "—"],
  ["mei", "MEI"],
  ["simples_nacional", "Simples Nacional"],
  ["lucro_presumido", "Lucro Presumido"],
  ["lucro_real", "Lucro Real"],
];

/** Campos de texto do formulário, na ordem em que são lidos (o nome é o mesmo da API). */
const CAMPOS = [
  "tipo_inscricao", "inscricao", "nome", "razao_social", "nome_fantasia", "email", "telefone", "site", "cep",
  "logradouro", "numero", "complemento", "bairro", "uf", "municipio_id", "inscricao_estadual", "inscricao_municipal",
  "regime_tributario", "cnae_codigo", "cnae_descricao", "data_abertura",
] as const; // prettier-ignore
type Campo = (typeof CAMPOS)[number];
type Valores = Record<Campo, string>;

const tela: {
  empresa: EmpresaLeitura | null;
  valores: Valores | null;
  municipios: Municipio[];
  ufMunicipios: string;
  erro: string;
  salvando: boolean;
  enviandoLogo: boolean;
} = { empresa: null, valores: null, municipios: [], ufMunicipios: "", erro: "", salvando: false, enviandoLogo: false };

/** Valores do formulário a partir do cadastro salvo (máscaras de CNPJ/CPF e CEP aplicadas). */
export function valoresDe(e: EmpresaLeitura): Valores {
  return {
    tipo_inscricao: e.tipo_inscricao ?? "CNPJ",
    inscricao: valorInicialDoDocumento(e.inscricao, tipoDoDocumento(e.tipo_inscricao)),
    nome: e.nome ?? "",
    razao_social: e.razao_social ?? "",
    nome_fantasia: e.nome_fantasia ?? "",
    email: e.email ?? "",
    telefone: e.telefone ?? "",
    site: e.site ?? "",
    cep: formatarCep(e.cep),
    logradouro: e.logradouro ?? "",
    numero: e.numero ?? "",
    complemento: e.complemento ?? "",
    bairro: e.bairro ?? "",
    uf: e.uf ?? "",
    municipio_id: e.municipio_id ?? "",
    inscricao_estadual: e.inscricao_estadual ?? "",
    inscricao_municipal: e.inscricao_municipal ?? "",
    regime_tributario: e.regime_tributario ?? "",
    cnae_codigo: e.cnae_codigo ?? "",
    cnae_descricao: e.cnae_descricao ?? "",
    data_abertura: e.data_abertura ?? "",
  };
}

const nulo = (v: string): string | null => v.trim() || null;

/** Corpo do PUT /empresas/ativa (a API normaliza dígitos e valida CNPJ/CPF). */
export function dadosDe(v: Valores): EmpresaDados {
  const inscricao = nulo(v.inscricao);
  return {
    nome: v.nome.trim(),
    tipo_inscricao: inscricao ? ((v.tipo_inscricao || "CNPJ") as EmpresaDados["tipo_inscricao"]) : null,
    inscricao,
    razao_social: nulo(v.razao_social),
    nome_fantasia: nulo(v.nome_fantasia),
    email: nulo(v.email),
    telefone: nulo(v.telefone),
    site: nulo(v.site),
    cep: nulo(v.cep),
    logradouro: nulo(v.logradouro),
    numero: nulo(v.numero),
    complemento: nulo(v.complemento),
    bairro: nulo(v.bairro),
    municipio_id: nulo(v.municipio_id),
    inscricao_estadual: nulo(v.inscricao_estadual),
    inscricao_municipal: nulo(v.inscricao_municipal),
    regime_tributario: (nulo(v.regime_tributario) as EmpresaDados["regime_tributario"]) ?? null,
    cnae_codigo: nulo(v.cnae_codigo),
    cnae_descricao: nulo(v.cnae_descricao),
    data_abertura: nulo(v.data_abertura),
  };
}

export const mascararCep = (valor: string): string => valor.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");

/** Recusa no navegador o que o servidor também recusaria (tipo e tamanho), com uma mensagem clara. */
export function problemaNaLogo(arquivo: { type: string; size: number }): string | null {
  if (!(TIPOS_DE_LOGO as readonly string[]).includes(arquivo.type)) return "Envie a logomarca em PNG, JPEG ou WebP.";
  if (arquivo.size > LOGO_MAX_BYTES) return "A logomarca pode ter no máximo 512 KB.";
  return null;
}

const alterado = (): boolean => !!tela.empresa && !!tela.valores && JSON.stringify(tela.valores) !== JSON.stringify(valoresDe(tela.empresa));

async function carregarMunicipios(uf: string): Promise<void> {
  tela.ufMunicipios = uf;
  tela.municipios = uf ? ((await tentar(() => apiFinanceiro.municipios(uf))) ?? []) : [];
}

async function carregar(): Promise<void> {
  try {
    tela.empresa = await api.empresas.ativa();
    tela.valores = valoresDe(tela.empresa);
    tela.erro = "";
    if (tela.valores.uf) await carregarMunicipios(tela.valores.uf);
  } catch (e) {
    tela.empresa = null;
    tela.erro = e instanceof Error ? e.message : "Não foi possível carregar os dados da empresa.";
  }
  registrarGuarda(async () =>
    vistaAtual() !== "empresa" || !alterado() || (await confirmar({ titulo: "Descartar alterações?", texto: "Os dados da empresa têm alterações que ainda não foram salvas.", confirmar: "Descartar", cancelar: "Continuar editando" })),
  );
}

// ---------------------------------------------------------------------------------------------- vista
const entrada = (nome: Campo, rotulo: string, attrs = "", cheio = false): Safe =>
  html`<div class="field${cheio ? " full" : ""}"><label for="emp-${nome}">${rotulo}</label>${raw(`<input id="emp-${nome}" name="${nome}" ${attrs}`)} value="${tela.valores?.[nome] ?? ""}"></div>`;

const escolha = (nome: Campo, rotulo: string, opcoes: ReadonlyArray<readonly [string, string]>, cheio = false): Safe =>
  html`<div class="field${cheio ? " full" : ""}"><label for="emp-${nome}">${rotulo}</label><select id="emp-${nome}" name="${nome}">${opcoes.map(
    ([v, r]) => html`<option value="${v}"${raw(v === tela.valores?.[nome] ? " selected" : "")}>${r}</option>`,
  )}</select></div>`;

const secao = (id: string, titulo: string, descricao: string, corpo: Safe): Safe =>
  html`<section class="panel fp-sec" id="emp-sec-${id}" aria-labelledby="emp-sec-${id}-t"><header><h2 id="emp-sec-${id}-t">${titulo}</h2><p class="sub">${descricao}</p></header><div class="corpo">${corpo}</div></section>`;

function secaoLogo(): Safe {
  const logo = tela.empresa?.logo;
  return secao(
    "logo",
    "Logomarca",
    "Aparece acima do menu e nos documentos e relatórios (orçamentos, plano de entrega, DRE e fluxo de caixa).",
    html`<div class="logo-empresa">
      <div class="logo-previa${logo ? "" : " vazia"}">${logo ? html`<img src="${logo}" alt="Logomarca atual de ${tela.empresa?.nome ?? "empresa"}">` : html`<span>Sem logomarca: o Hub usa a logo padrão.</span>`}</div>
      <div class="logo-acoes">
        <label class="btn${tela.enviandoLogo ? " carregando" : ""}" for="emp-logo">${tela.enviandoLogo ? "Enviando…" : logo ? "Trocar logomarca" : "Enviar logomarca"}</label>
        <input type="file" id="emp-logo" class="visualmente-oculto" accept="${TIPOS_DE_LOGO.join(",")}"${raw(tela.enviandoLogo ? " disabled" : "")}>
        ${logo ? html`<button type="button" class="btn ghost" data-act="removerLogoEmpresa">Remover</button>` : ""}
        <p class="sub">PNG, JPEG ou WebP, até 512 KB. Prefira fundo transparente e formato horizontal.</p>
      </div>
    </div>`,
  );
}

function vista(): Safe {
  const cabecalho = cabecalhoDePagina({ titulo: "Dados da empresa", descricao: "Cadastro usado no Hub, nos documentos enviados aos clientes e nos relatórios." });
  if (tela.erro) return html`${cabecalho}${estadoDeErro({ mensagem: tela.erro, acaoRepetir: "recarregarEmpresa" })}`;
  const v = tela.valores;
  if (!tela.empresa || !v) return html`${cabecalho}${carregando("Carregando os dados da empresa…")}`;
  const cpf = v.tipo_inscricao === "CPF";
  const municipios: ReadonlyArray<readonly [string, string]> = [
    ["", v.uf ? "Selecione o município" : "Escolha a UF primeiro"],
    ...tela.municipios.map((m) => [m.id, m.nome] as const),
  ];
  return html`${cabecalho}
    <form class="fp-secs empresa-form" id="empresaForm" novalidate>
      ${secao("inscricao", "Inscrição", "Documento de registro da empresa.", html`<div class="fields">
        ${escolha("tipo_inscricao", "Tipo de inscrição", [["CNPJ", "CNPJ"], ["CPF", "CPF"]])}
        ${entrada("inscricao", "Número de inscrição", `inputmode="numeric" autocomplete="off" maxlength="${MAXLENGTH_DOCUMENTO}" placeholder="${PLACEHOLDER_DOCUMENTO[tipoDoDocumento(v.tipo_inscricao)]}"`)}
      </div>`)}
      ${secao("identificacao", "Identificação", "Como a empresa aparece no Hub e nos documentos.", html`<div class="fields">
        ${entrada("nome", "Nome de exibição no Hub", 'maxlength="150" autocomplete="organization" required', true)}
        ${entrada("razao_social", cpf ? "Nome completo" : "Razão social", 'maxlength="150"', true)}
        ${entrada("nome_fantasia", "Nome fantasia", 'maxlength="150"', true)}
      </div>`)}
      ${secao("contato", "Contato", "Exibido no rodapé dos documentos.", html`<div class="fields">
        ${entrada("email", "E-mail", 'type="email" maxlength="150" autocomplete="email"')}
        ${entrada("telefone", "Telefone", 'type="tel" maxlength="20" autocomplete="tel" placeholder="(00) 00000-0000"')}
        ${entrada("site", "Site", 'maxlength="150" placeholder="www.suaempresa.com.br"', true)}
      </div>`)}
      ${secao("endereco", "Endereço", "Endereço da sede.", html`<div class="fields">
        ${entrada("cep", "CEP", 'inputmode="numeric" maxlength="9" autocomplete="postal-code" placeholder="00000-000"')}
        ${entrada("logradouro", "Logradouro", 'maxlength="150" autocomplete="address-line1"', true)}
        ${entrada("numero", "Número", 'maxlength="20"')}
        ${entrada("complemento", "Complemento", 'maxlength="100" autocomplete="address-line2"')}
        ${entrada("bairro", "Bairro", 'maxlength="100"')}
        ${escolha("uf", "UF", [["", "UF"], ...UFS.map((u) => [u, u] as const)])}
        ${escolha("municipio_id", "Município", municipios, true)}
      </div>`)}
      ${secao("fiscal", "Dados fiscais", "Informativos: ainda não são usados em cálculos de impostos.", html`<div class="fields">
        ${entrada("inscricao_estadual", "Inscrição estadual", 'maxlength="20"')}
        ${entrada("inscricao_municipal", "Inscrição municipal", 'maxlength="20"')}
        ${escolha("regime_tributario", "Regime tributário", REGIMES)}
        ${entrada("data_abertura", "Data de abertura", 'type="date"')}
        ${entrada("cnae_codigo", "CNAE principal (código)", 'maxlength="10" placeholder="0000-0/00"')}
        ${entrada("cnae_descricao", "Descrição do CNAE", 'maxlength="200"', true)}
      </div>`)}
      ${secaoLogo()}
      <div class="fp-acoes${alterado() ? " dirty" : ""}"><span class="sujo" role="status">Alterações não salvas</span><span class="sp"></span>
        <button type="button" class="btn ghost" data-act="descartarEmpresa"${raw(alterado() ? "" : " disabled")}>Descartar</button>
        <button type="button" class="btn primary" data-act="salvarEmpresa"${raw(tela.salvando ? " disabled" : "")}>${tela.salvando ? "Salvando…" : "Salvar alterações"}</button>
      </div>
    </form>`;
}

registrarVista({ id: "empresa", nome: "Dados da empresa", grupo: "Administração", permissao: "administracao", carregar, desenhar: vista });

// ---------------------------------------------------------------------------------------------- eventos
function marcarSujo(): void {
  document.querySelector("#empresaForm .fp-acoes")?.classList.toggle("dirty", alterado());
  const descartar = document.querySelector<HTMLButtonElement>('#empresaForm [data-act="descartarEmpresa"]');
  if (descartar) descartar.disabled = !alterado();
}

if (typeof document !== "undefined") {
  document.addEventListener("input", (e) => {
    const campo = e.target as HTMLInputElement;
    if (!tela.valores || !campo.closest?.("#empresaForm") || !campo.name) return;
    if (campo.name === "inscricao") reaplicarMascara(campo, (valor) => mascararDocumento(valor, tipoDoDocumento(tela.valores?.tipo_inscricao)));
    if (campo.name === "cep") campo.value = mascararCep(campo.value);
    if ((CAMPOS as readonly string[]).includes(campo.name)) tela.valores[campo.name as Campo] = campo.value;
    marcarSujo();
  });

  document.addEventListener("change", (e) => {
    const campo = e.target as HTMLInputElement;
    if (!tela.valores || !campo.closest?.("#empresaForm")) return;
    if (campo.id === "emp-logo") return void enviarLogo(campo);
    if (campo.name === "tipo_inscricao") {
      tela.valores.tipo_inscricao = campo.value;
      tela.valores.inscricao = mascararDocumento(tela.valores.inscricao, tipoDoDocumento(campo.value));
      render();
    } else if (campo.name === "uf") {
      tela.valores.uf = campo.value;
      tela.valores.municipio_id = "";
      void carregarMunicipios(campo.value).then(render);
    }
  });
}

async function enviarLogo(campo: HTMLInputElement): Promise<void> {
  const arquivo = campo.files?.[0];
  campo.value = "";
  if (!arquivo || !tela.empresa) return;
  const problema = problemaNaLogo(arquivo);
  if (problema) return void toast(problema);
  const imagem = await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  }).catch(() => "");
  if (!imagem) return void toast("Não foi possível ler o arquivo escolhido.");
  tela.enviandoLogo = true;
  render();
  const atualizada = await tentar(() => api.empresas.enviarLogo(imagem));
  tela.enviandoLogo = false;
  if (atualizada) {
    tela.empresa = { ...tela.empresa, logo: atualizada.logo };
    publicarIdentidade();
    toast("Logomarca atualizada.");
  }
  render();
}

/** Aplica a logomarca na casca e a lembra para a próxima abertura do Hub. */
function publicarIdentidade(): void {
  if (!tela.empresa) return;
  aplicarLogo(tela.empresa.logo ?? null, tela.empresa.nome);
  lembrarIdentidade(tela.empresa.id, { logo: tela.empresa.logo ?? null, paleta: tela.empresa.paleta ?? null });
}

registrarAcao("removerLogoEmpresa", async () => {
  if (!tela.empresa) return;
  const ok = await confirmar({ titulo: "Remover a logomarca?", texto: "O Hub e os documentos voltam a usar a logo padrão.", confirmar: "Remover", cancelar: "Manter" });
  if (!ok || (await tentar(() => api.empresas.removerLogo())) === null) return;
  tela.empresa = { ...tela.empresa, logo: null };
  publicarIdentidade();
  toast("Logomarca removida.");
  render();
});

registrarAcao("salvarEmpresa", async () => {
  if (!tela.empresa || !tela.valores || tela.salvando) return;
  const dados = dadosDe(tela.valores);
  if (!dados.nome) return void toast("Informe o nome de exibição da empresa.");
  tela.salvando = true;
  render();
  const salva = await tentar(() => api.empresas.salvar(dados));
  tela.salvando = false;
  if (salva) {
    tela.empresa = salva;
    tela.valores = valoresDe(salva);
    acesso.empresaNome = salva.nome;
    publicarIdentidade();
    toast("Dados da empresa atualizados.");
  }
  render();
});

registrarAcao("descartarEmpresa", () => {
  if (!tela.empresa) return;
  tela.valores = valoresDe(tela.empresa);
  void carregarMunicipios(tela.valores.uf).then(render);
});

registrarAcao("recarregarEmpresa", async () => {
  await carregar();
  render();
});
