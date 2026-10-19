import { $ } from "@/core/dom";
import { brl } from "@/core/formato";
import { html, type Safe } from "@/core/html";
import { numero } from "@/core/numero";
import { podeEscrever, temPermissao } from "@/state/estado";
import { registrarVista } from "@/state/nucleo";
import { registrarAcao } from "@/ui/acoes";
import { campo, fv, inp, inpMoeda } from "@/ui/campos";
import { combobox } from "@/ui/combobox";
import { tentar } from "@/ui/erros";
import { registrarCadastroRapido } from "@/ui/cadastro-rapido";
import { abrirGaveta } from "@/ui/gaveta";
import { espaco } from "@/ui/formularios";
import { gravar } from "@/ui/gravacao";
import { avisar } from "@/ui/toast";
import { apiFinanceiro, type ContaBancaria, type ContaBancariaEntrada, type Instituicao } from "./api";
import { acoesDaLinha, confirmarExclusao, GRUPO } from "./comum";

const tela: { contas: ContaBancaria[] | null } = { contas: null };

async function carregar(): Promise<void> {
  tela.contas = await apiFinanceiro.contas.listar();
}

function vista(): Safe {
  if (!tela.contas) return html`<div class="head"><div><h1>Contas bancárias</h1></div></div><p class="sub">Carregando…</p>`;
  return html`<div class="head"><div><h1>Contas bancárias</h1><p>As contas da empresa, cada uma vinculada a uma instituição financeira.</p></div>
    <div class="tools"><button class="btn primary" data-act="novaContaBancaria">Nova conta bancária</button></div></div>
  ${
    tela.contas.length
      ? html`<div class="tbl-wrap"><table><thead><tr><th>Conta</th><th>Instituição financeira</th><th class="r">Saldo inicial</th><th></th></tr></thead><tbody>
      ${tela.contas.map((c) => html`<tr><td><b>${c.nome}</b></td><td>${c.instituicao_codigo} · ${c.instituicao_nome}</td><td class="r num">${brl(c.saldo_inicial)}</td><td class="r">${acoesDaLinha("contaBancaria", c.id)}</td></tr>`)}
    </tbody></table></div>`
      : html`<div class="empty"><b>Nenhuma conta bancária</b>Cadastre as contas da empresa para poder lançar títulos a pagar e a receber.<br><button class="btn primary" data-act="novaContaBancaria">Cadastrar a primeira conta</button></div>`
  }`;
}

registrarVista({ id: "fin-contas", nome: "Conta Bancária", grupo: GRUPO, permissao: "financeiro", carregar, depende: ["financeiro"], desenhar: vista });

/** Campos da conta (os três são os mesmos no cadastro completo e no rápido). */
function camposDaConta(instituicoes: readonly Instituicao[], c?: Partial<ContaBancaria>): Safe {
  return html`${campo("Instituição financeira", combobox({ nome: "instituicao_financeira_id", rotulo: "Instituição financeira", opcoes: instituicoes.map((i) => ({ id: i.id, codigo: i.codigo, rotulo: i.nome })), valor: c?.instituicao_financeira_id, vazio: "Digite o nome ou o código…" }), true)}
      ${campo("Nome da conta", inp("nome", c?.nome, 'maxlength="150" placeholder="Ex.: Conta corrente principal"'), true)}
      ${campo("Saldo inicial (R$)", inpMoeda("saldo_inicial", c?.saldo_inicial))}`;
}

/** Lê e valida; null = faltou algo (já avisou). */
function lerConta(f: HTMLFormElement): ContaBancariaEntrada | null {
  if (!fv(f, "instituicao_financeira_id")) return avisar("Escolha a instituição financeira.");
  if (!fv(f, "nome")) return avisar("Informe o nome da conta.");
  return { instituicao_financeira_id: fv(f, "instituicao_financeira_id"), nome: fv(f, "nome"), saldo_inicial: numero(fv(f, "saldo_inicial")) };
}

async function formConta(c?: ContaBancaria): Promise<void> {
  const instituicoes = await tentar(() => apiFinanceiro.instituicoes());
  if (!instituicoes) return;
  abrirGaveta({
    titulo: c ? c.nome : "Nova conta bancária",
    corpo: html`<div class="fields">
      ${camposDaConta(instituicoes, c)}
    </div>`,
    rodape: html`<button class="btn primary" data-salvar>Salvar</button>${espaco}`,
    montar: (f, fechar, L) => {
      $("[data-salvar]", L)?.addEventListener("click", async () => {
        const corpo = lerConta(f);
        if (!corpo) return;
        await gravar({
          recarregar: ["financeiro"], mensagem: "Conta bancária salva", fechar,
          operacao: () => (c ? apiFinanceiro.contas.atualizar(c.id, corpo) : apiFinanceiro.contas.criar(corpo)),
        });
      });
    },
  });
}

const porId = (id?: string): ContaBancaria | undefined => tela.contas?.find((c) => c.id === id);

registrarAcao("novaContaBancaria", () => void formConta());
registrarAcao("contaBancariaEditar", (alvo) => {
  const c = porId(alvo.dataset.id);
  if (c) void formConta(c);
});
registrarAcao("contaBancariaExcluir", (alvo) => {
  const c = porId(alvo.dataset.id);
  if (c) confirmarExclusao({ titulo: "Excluir conta bancária", mensagem: `Excluir a conta “${c.nome}”? Contas com títulos lançados não podem ser excluídas.`, sucesso: "Conta bancária excluída", operacao: () => apiFinanceiro.contas.excluir(c.id) });
});

// ------------------------------------------------------------------------------------------- cadastro rápido
/** Instituições financeiras (lista fixa do sistema): carregadas uma vez, quando um formulário oferece o cadastro rápido. */
let instituicoesDoCadastro: Instituicao[] = [];

export async function prepararCadastroDeConta(): Promise<void> {
  if (instituicoesDoCadastro.length || !temPermissao("financeiro") || !podeEscrever()) return;
  instituicoesDoCadastro = (await tentar(() => apiFinanceiro.instituicoes())) ?? [];
}

export const opcaoDaConta = (c: Pick<ContaBancaria, "id" | "nome" | "instituicao_codigo">) => ({ id: c.id, rotulo: `${c.nome} (${c.instituicao_codigo})` });

registrarCadastroRapido<ContaBancariaEntrada, ContaBancaria>("conta-bancaria", {
  novo: "Nova conta bancária",
  mensagem: "Conta bancária cadastrada",
  recarregar: ["financeiro"],
  pode: () => temPermissao("financeiro") && instituicoesDoCadastro.length > 0,
  campos: (ctx) => camposDaConta(instituicoesDoCadastro, { nome: ctx.sugestao }),
  ler: lerConta,
  criar: (dados) => apiFinanceiro.contas.criar(dados),
  opcao: opcaoDaConta,
});
