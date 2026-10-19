/**
 * Campos do cadastro de parceiro, compartilhados pelas telas Clientes (papel fixo "cliente") e
 * Financeiro › Parceiro de Negócio (hub com escolha de papéis). Cada tela monta a gaveta e salva pela
 * sua própria API; aqui ficam só o HTML dos campos, a leitura do formulário e o carregamento de municípios.
 */
import { html, raw, type Safe } from "@/core/html";
import { numero, paraCampo } from "@/core/numero";
import { ORIGENS } from "@/domain/constantes";
import { apiFinanceiro } from "@/features/financeiro/api";
import { formatarCep } from "@/features/financeiro/comum";
import { campo, fv, inp, sel, area } from "@/ui/campos";
import { combobox, comboboxDe } from "@/ui/combobox";
import { ligarMascaraDeDocumento, MAXLENGTH_DOCUMENTO, PLACEHOLDER_DOCUMENTO, tipoDoDocumento, valorInicialDoDocumento } from "@/ui/documento";
import { seletorDono } from "@/ui/formularios";
import type { SecaoFormulario } from "@/ui/formulario-pagina";
import { tentar } from "@/ui/erros";
import { avisar } from "@/ui/toast";

export const PAPEL_SOCIO = "socio";

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

/** O que os formulários precisam saber de um parceiro já existente (compatível com cliente e parceiro da API). */
export interface ValoresParceiro {
  id?: string;
  /** Dono (carteira) do cliente. */
  responsavel_id?: string | null;
  tipo_pessoa?: string;
  cpf_cnpj?: string | null;
  nome?: string;
  segmento?: string | null;
  contato?: string | null;
  cargo?: string | null;
  telefone?: string | null;
  email?: string | null;
  origem?: string | null;
  obs?: string | null;
  endereco?: string | null;
  cep?: string | null;
  municipio_id?: string | null;
  uf?: string | null;
  papeis?: string[];
  /** Participação do sócio na empresa, em %. */
  participacao_percentual?: number | null;
}

export interface PapelDisponivel {
  codigo: string;
  nome: string;
}

export interface CamposLidos {
  tipo_pessoa: "PJ" | "PF";
  cpf_cnpj: string | null;
  nome: string;
  segmento: string | null;
  contato: string | null;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  origem: (typeof ORIGENS)[number] | null;
  obs: string | null;
  endereco: string | null;
  cep: string | null;
  municipio_id: string | null;
  papeis: string[];
  participacao_percentual: number | null;
  /** Só presente quando o formulário tem o campo "Dono"; ausente, o servidor mantém (ou define quem cria). */
  responsavel_id?: string | null;
}

/** Campos soltos do parceiro (com o valor atual), para montar numa grade única ou em seções. */
function camposSoltos(v: ValoresParceiro) {
  const tipoDoc = tipoDoDocumento(v.tipo_pessoa ?? "PJ");
  return {
    nome: campo("Nome / Razão social", inp("nome", v.nome, 'maxlength="150" required'), true),
    tipo: campo("Tipo de pessoa", sel("tipo_pessoa", [["PJ", "Pessoa jurídica (CNPJ)"], ["PF", "Pessoa física (CPF)"]], v.tipo_pessoa ?? "PJ")),
    doc: campo("CPF / CNPJ", inp("cpf_cnpj", valorInicialDoDocumento(v.cpf_cnpj, tipoDoc), `inputmode="numeric" autocomplete="off" maxlength="${MAXLENGTH_DOCUMENTO}" placeholder="${PLACEHOLDER_DOCUMENTO[tipoDoc]}"`)),
    contato: campo("Contato principal", inp("contato", v.contato)),
    cargo: campo("Cargo", inp("cargo", v.cargo)),
    telefone: campo("Telefone / WhatsApp", inp("telefone", v.telefone, 'inputmode="tel"')),
    email: campo("E-mail", inp("email", v.email, 'type="email"')),
    segmento: campo("Segmento", inp("segmento", v.segmento, 'placeholder="Ex.: distribuição, saúde, indústria"')),
    origem: campo("Origem", sel("origem", [["", "—"], ...ORIGENS.map((o) => [o, o] as const)], v.origem)),
    endereco: campo("Endereço", inp("endereco", v.endereco, 'maxlength="150" placeholder="Rua, número, bairro"'), true),
    cep: campo("CEP", inp("cep", formatarCep(v.cep), 'inputmode="numeric" maxlength="9" placeholder="00000-000"')),
    uf: html`<div class="field"><label for="f-uf">UF</label><select name="uf" id="f-uf"><option value="">UF</option>${UFS.map((u) => html`<option value="${u}"${raw(u === v.uf ? " selected" : "")}>${u}</option>`)}</select></div>`,
    municipio: campo("Município", combobox({ nome: "municipio_id", rotulo: "Município", opcoes: [], valor: null, vazio: "Escolha a UF primeiro" }), true),
    obs: campo("Observações", area("obs", v.obs), true),
  };
}

/** Participação do sócio: só aparece com o papel Sócio marcado (ver `ligarCamposDoParceiro`). */
function campoParticipacao(v: ValoresParceiro): Safe {
  const visivel = (v.papeis ?? []).includes(PAPEL_SOCIO);
  return html`<div class="field full" id="campoParticipacao"${raw(visivel ? "" : " hidden")}><label for="f-participacao_percentual">Participação na empresa (%)</label>${inp("participacao_percentual", paraCampo(v.participacao_percentual), 'inputmode="decimal" placeholder="Ex.: 40"')}<span class="sub">A soma das participações dos sócios não pode passar de 100%.</span></div>`;
}

/** HTML dos campos. Com `papeis` (lista de papéis disponíveis) mostra as caixas de escolha de papel; sem, o papel é fixo. */
export function camposDoParceiro(v: ValoresParceiro = {}, papeis?: readonly PapelDisponivel[]): Safe {
  const marcados = new Set(v.papeis ?? []);
  const c = camposSoltos(v);
  return html`<div class="fields">
    ${
      papeis
        ? html`<div class="field full"><label>Papéis</label><div class="papeis" style="display:flex;gap:16px;flex-wrap:wrap">${papeis.map((p) => html`<label class="check"><input type="checkbox" name="papel" value="${p.codigo}"${raw(marcados.has(p.codigo) ? " checked" : "")}> ${p.nome}</label>`)}</div></div>`
        : ""
    }
    ${papeis ? campoParticipacao(v) : ""}
    ${c.nome}
    ${c.tipo}
    ${c.doc}
    ${c.contato}${c.cargo}
    ${c.telefone}${c.email}
    ${c.segmento}${c.origem}
    ${c.endereco}
    ${c.cep}
    ${c.uf}
    ${c.municipio}
    ${c.obs}
  </div>`;
}

/** Os mesmos campos agrupados em seções, para o formulário em página (papel fixo, sem escolha de papéis). */
export function secoesDoParceiro(v: ValoresParceiro = {}): SecaoFormulario[] {
  const c = camposSoltos(v);
  return [
    { id: "gerais", titulo: "Dados gerais", descricao: "Identificação da empresa", corpo: html`<div class="fields">${c.nome}${c.tipo}${c.doc}${c.segmento}${c.origem}${seletorDono("Dono do cliente (carteira)", v.responsavel_id, !v.id)}</div>` },
    { id: "contato", titulo: "Contato", descricao: "Quem fala pela empresa", corpo: html`<div class="fields">${c.contato}${c.cargo}${c.telefone}${c.email}</div>` },
    { id: "endereco", titulo: "Endereço", corpo: html`<div class="fields">${c.endereco}${c.cep}${c.uf}${c.municipio}</div>` },
    { id: "obs", titulo: "Observações", corpo: html`<div class="fields">${c.obs}</div>` },
  ];
}

/** Liga a máscara do CPF/CNPJ ao tipo de pessoa e o carregamento de municípios por UF (pré-selecionando o atual). */
export function ligarCamposDoParceiro(form: HTMLFormElement, v: ValoresParceiro = {}): void {
  const tipoPessoa = form.elements.namedItem("tipo_pessoa") as HTMLSelectElement;
  const mascara = ligarMascaraDeDocumento(form.elements.namedItem("cpf_cnpj") as HTMLInputElement, () => tipoDoDocumento(tipoPessoa.value));
  tipoPessoa.addEventListener("change", () => mascara.atualizarTipo());
  const uf = form.elements.namedItem("uf") as HTMLSelectElement;
  const municipio = comboboxDe(form, "municipio_id")!;
  const visivel = form.querySelector<HTMLInputElement>("#f-municipio_id")!;
  const carregar = async (selecionado?: string | null): Promise<void> => {
    visivel.placeholder = "Carregando…";
    const lista = uf.value ? await tentar(() => apiFinanceiro.municipios(uf.value)) : [];
    municipio.definirOpcoes((lista ?? []).map((m) => ({ id: m.id, rotulo: m.nome })), { valor: selecionado ?? null, silencioso: true });
    visivel.placeholder = uf.value ? "Digite para buscar…" : "Escolha a UF primeiro";
  };
  uf.addEventListener("change", () => void carregar());
  if (v.municipio_id && v.uf) void carregar(v.municipio_id);
  // A participação só faz sentido para sócios: mostra o campo ao marcar o papel e esconde ao desmarcar.
  const caixaSocio = form.querySelector<HTMLInputElement>(`input[name="papel"][value="${PAPEL_SOCIO}"]`);
  const campoParticipacao = form.querySelector<HTMLElement>("#campoParticipacao");
  caixaSocio?.addEventListener("change", () => {
    if (campoParticipacao) campoParticipacao.hidden = !caixaSocio.checked;
  });
}

/** Lê e valida o formulário; devolve null (já avisando) se faltar algo. `papelFixo` evita exigir a escolha de papéis. */
export function lerCamposDoParceiro(form: HTMLFormElement, papelFixo?: string): CamposLidos | null {
  const nome = fv(form, "nome");
  if (!nome) return avisar("Informe o nome.");
  const papeis = papelFixo ? [papelFixo] : [...form.querySelectorAll<HTMLInputElement>('input[name="papel"]:checked')].map((i) => i.value);
  if (!papeis.length) return avisar("Escolha pelo menos um papel (cliente, fornecedor, funcionário…).");
  const municipio = fv(form, "municipio_id");
  let participacao: number | null = null;
  if (papeis.includes(PAPEL_SOCIO)) {
    participacao = numero(fv(form, "participacao_percentual"));
    if (!(participacao > 0 && participacao <= 100)) return avisar("Informe a participação do sócio, maior que 0% e até 100%.");
  }
  return {
    tipo_pessoa: fv(form, "tipo_pessoa") as "PJ" | "PF", cpf_cnpj: fv(form, "cpf_cnpj") || null, nome,
    segmento: fv(form, "segmento") || null, contato: fv(form, "contato") || null, cargo: fv(form, "cargo") || null,
    telefone: fv(form, "telefone") || null, email: fv(form, "email") || null,
    origem: (fv(form, "origem") || null) as CamposLidos["origem"], obs: fv(form, "obs") || null,
    endereco: fv(form, "endereco") || null, cep: fv(form, "cep") || null, municipio_id: municipio || null, papeis,
    participacao_percentual: participacao,
    ...(form.elements.namedItem("responsavel_id") ? { responsavel_id: fv(form, "responsavel_id") || null } : {}),
  };
}
