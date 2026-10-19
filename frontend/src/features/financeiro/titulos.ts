import { $, $$ } from "@/core/dom";
import { brl, dataBR, hoje } from "@/core/formato";
import { html, type Safe } from "@/core/html";
import { numero } from "@/core/numero";
import { ui } from "@/state/estado";
import { registrarVista, render } from "@/state/nucleo";
import { registrarAcao } from "@/ui/acoes";
import { area, campo, fv, inp, inpMoeda, sel } from "@/ui/campos";
import { combobox, comboboxDe, type OpcaoCombobox } from "@/ui/combobox";
import { tentar } from "@/ui/erros";
import { abrirGaveta } from "@/ui/gaveta";
import { espaco } from "@/ui/formularios";
import { gravar } from "@/ui/gravacao";
import { avisar } from "@/ui/toast";
import { apiFinanceiro, type ContaBancaria, type Parceiro, type PlanoConta, type Titulo, type TituloEntrada } from "./api";
import { acoesDaLinha, confirmarExclusao, contasDoPlanoParaTitulo, GRUPO, parceirosParaTitulo } from "./comum";
import { opcaoDaConta, prepararCadastroDeConta } from "./contas-bancarias";
import { opcaoDoParceiro, prepararCadastroDeParceiro } from "../parceiros/cadastro-rapido";

const STATUS: Record<string, readonly [string, string]> = { A: ["Aberto", "info"], Q: ["Quitado", "ok"], C: ["Cancelado", ""] };
const TIPO: Record<string, string> = { P: "A pagar", R: "A receber" };

const tela: { titulos: Titulo[] | null } = { titulos: null };

async function carregar(): Promise<void> {
  tela.titulos = await apiFinanceiro.titulos.listar();
}

function vista(): Safe {
  if (!tela.titulos) return html`<div class="head"><div><h1>Títulos financeiros</h1></div></div><p class="sub">Carregando…</p>`;
  const h = hoje();
  const lista = tela.titulos.filter((t) => (ui.finTipo === "todos" || t.tipo_conta === ui.finTipo) && (ui.finStatus === "todos" || t.status === ui.finStatus));
  const seg = (acao: string, atual: string, opcoes: Array<[string, string]>): Safe =>
    html`<div class="seg" role="group">${opcoes.map(([k, r]) => html`<button data-act="${acao}" data-valor="${k}" aria-pressed="${atual === k}">${r}</button>`)}</div>`;
  const abertos = tela.titulos.filter((t) => t.status === "A");
  const aPagar = abertos.filter((t) => t.tipo_conta === "P").reduce((s, t) => s + t.valor_devido, 0);
  const aReceber = abertos.filter((t) => t.tipo_conta === "R").reduce((s, t) => s + t.valor_devido, 0);
  return html`<div class="head"><div><h1>Títulos financeiros</h1><p>Contas a pagar e a receber · em aberto: <b class="num">${brl(aReceber)}</b> a receber, <b class="num">${brl(aPagar)}</b> a pagar</p></div>
    <div class="tools"><button class="btn" data-act="novaRecorrencia">Nova recorrência</button><button class="btn primary" data-act="novoTitulo">Novo título</button></div></div>
  <div class="fin-filtros">${seg("filtroFinTipo", ui.finTipo, [["todos", "Todos"], ["R", "A receber"], ["P", "A pagar"]])}${seg("filtroFinStatus", ui.finStatus, [["todos", "Todos"], ["A", "Abertos"], ["Q", "Quitados"], ["C", "Cancelados"]])}</div>
  ${
    tela.titulos.length
      ? html`<div class="tbl-wrap"><table style="min-width:860px"><thead><tr><th>Vencimento</th><th>Tipo</th><th>Parceiro</th><th>Conta do plano</th><th>Conta bancária</th><th class="r">Valor devido</th><th>Situação</th><th></th></tr></thead><tbody>
      ${lista.map((t) => {
        const [rot, cls] = STATUS[t.status] ?? ["", ""];
        const atrasado = t.status === "A" && t.data_vencimento < h;
        return html`<tr><td class="num">${dataBR(t.data_vencimento)}${atrasado ? html`<div class="sub" style="color:var(--bad-texto)">atrasado</div>` : ""}</td><td><span class="pill ${t.tipo_conta === "R" ? "ok" : "bad"}">${TIPO[t.tipo_conta]}</span></td>
        <td><b>${t.parceiro_nome}</b>${t.recorrencia_id ? html` <a class="pill info" href="/fin-recorrencias" data-go="fin-recorrencias" title="Título gerado por uma recorrência">Recorrente</a>` : ""}</td><td><span class="num sub">${t.plano_conta_codigo}</span> ${t.plano_conta_nome}</td><td>${t.conta_bancaria_nome}</td>
        <td class="r num">${brl(t.valor_devido)}${t.status === "Q" && t.valor_quitacao !== t.valor_devido ? html`<div class="sub">pago ${brl(t.valor_quitacao)}</div>` : ""}</td><td><span class="pill ${cls}">${rot}</span>${t.data_pagamento ? html`<div class="sub num">${dataBR(t.data_pagamento)}</div>` : ""}</td><td class="r">${acoesDaLinha("titulo", t.id)}</td></tr>`;
      })}
      ${!lista.length ? html`<tr><td colspan="8" class="sub">Nenhum título com esses filtros.</td></tr>` : ""}
    </tbody></table></div>`
      : html`<div class="empty"><b>Nenhum título lançado</b>Antes de lançar, cadastre o plano de contas, uma conta bancária e o parceiro.<br><button class="btn primary" data-act="novoTitulo">Lançar o primeiro título</button></div>`
  }`;
}

registrarVista({ id: "fin-titulos", nome: "Títulos Financeiros", grupo: GRUPO, permissao: "financeiro", carregar, depende: ["financeiro"], desenhar: vista });

async function formTitulo(t?: Titulo): Promise<void> {
  // as listas de apoio são buscadas na hora, para refletir cadastros feitos há pouco
  const apoio = await tentar(() =>
    Promise.all([apiFinanceiro.plano.listar(), apiFinanceiro.contas.listar(), apiFinanceiro.parceiros.listar(), prepararCadastroDeParceiro(), prepararCadastroDeConta()]),
  );
  if (!apoio) return;
  const [plano, contas, parceiros]: [PlanoConta[], ContaBancaria[], Parceiro[], void, void] = apoio;
  const tipoInicial = t?.tipo_conta ?? "R";
  /** RN04: contas a pagar mostram só despesas; a receber, só receitas. */
  const contasDoTipo = (tipo: string): PlanoConta[] => contasDoPlanoParaTitulo(plano, tipo);
  const nomeDoPlano = new Map(plano.map((c) => [c.id, `${c.codigo} ${c.nome}`]));
  const opcoesPlano = (tipo: string): OpcaoCombobox[] =>
    contasDoTipo(tipo).map((c) => ({ id: c.id, codigo: c.codigo, rotulo: c.nome, grupo: c.plano_pai_id ? nomeDoPlano.get(c.plano_pai_id) : undefined }));
  const campoPlano = (tipo: string, atual?: string | null): Safe =>
    combobox({ nome: "plano_conta_id", rotulo: "Conta do plano de contas", opcoes: opcoesPlano(tipo), valor: atual, vazio: contasDoTipo(tipo).length ? "Digite para buscar…" : "Nenhuma conta disponível" });

  /** Parceiros do tipo de título e da conta escolhidos (a conta de aporte só aceita sócios); o atual sempre fica na lista. */
  const opcoesParceiro = (tipo: string, planoId: string, atual?: string): OpcaoCombobox[] => {
    const aporte = plano.find((c) => c.id === planoId)?.aporte_socio ?? false;
    const lista = parceirosParaTitulo(parceiros, tipo, aporte);
    const atualFora = parceiros.find((p) => p.id === atual && !lista.some((x) => x.id === p.id));
    return [...lista, ...(atualFora ? [atualFora] : [])].map(opcaoDoParceiro);
  };
  /** Formulário montado (o contexto do cadastro rápido lê o tipo e a conta escolhidos na hora). */
  let form: HTMLFormElement | null = null;
  const contextoParceiro = () => ({
    tipoConta: form ? fv(form, "tipo_conta") : tipoInicial,
    aporte: plano.find((c) => c.id === (form ? fv(form, "plano_conta_id") : t?.plano_conta_id))?.aporte_socio ?? false,
  });

  abrirGaveta({
    titulo: t ? `Título · ${t.parceiro_nome}` : "Novo título financeiro",
    corpo: html`<div class="fields">
      ${campo("Tipo", sel("tipo_conta", [["R", "A receber (receita)"], ["P", "A pagar (despesa)"]], tipoInicial))}
      ${campo("Situação", sel("status", [["A", "Aberto"], ["Q", "Quitado"], ["C", "Cancelado"]], t?.status ?? "A"))}
      <div class="field full"><label for="f-plano_conta_id">Conta do plano de contas</label>${campoPlano(tipoInicial, t?.plano_conta_id)}<span class="sub" id="dicaPlano"></span></div>
      ${campo("Conta bancária", combobox({ nome: "conta_bancaria_id", rotulo: "Conta bancária", opcoes: contas.map(opcaoDaConta), valor: t?.conta_bancaria_id, cadastroRapido: { tipo: "conta-bancaria" } }))}
      ${campo("Parceiro de negócio", combobox({ nome: "parceiro_id", rotulo: "Parceiro de negócio", opcoes: opcoesParceiro(tipoInicial, t?.plano_conta_id ?? "", t?.parceiro_id), valor: t?.parceiro_id, cadastroRapido: { tipo: "parceiro", contexto: contextoParceiro, aoCriar: (c) => parceiros.push(c.item as Parceiro) } }))}
      ${campo("Data de emissão", inp("data_emissao", t?.data_emissao, 'type="date"'))}${campo("Data de vencimento", inp("data_vencimento", t?.data_vencimento ?? hoje(), 'type="date"'))}
      ${campo("Valor do título (R$)", inpMoeda("valor_titulo", t?.valor_titulo))}${campo("Desconto (R$)", inpMoeda("valor_desconto", t?.valor_desconto))}
      ${campo("Multa (R$)", inpMoeda("valor_multa", t?.valor_multa))}${campo("Juros (R$)", inpMoeda("valor_juros", t?.valor_juros))}
      <div class="field full"><span class="sub">Valor devido: <b class="num" id="devido">R$ 0,00</b></span></div>
      <div class="field quitacao"${t?.status === "Q" ? "" : " hidden"}><label for="f-data_pagamento">Data de pagamento</label>${inp("data_pagamento", t?.data_pagamento, 'type="date"')}</div>
      <div class="field quitacao"${t?.status === "Q" ? "" : " hidden"}><label for="f-valor_quitacao">Valor pago (R$)</label>${inpMoeda("valor_quitacao", t?.status === "Q" ? t?.valor_quitacao : "", "vazio = valor devido")}</div>
      ${campo("Anotação", area("anotacao", t?.anotacao), true)}
    </div>`,
    rodape: html`<button class="btn primary" data-salvar>Salvar</button>${espaco}`,
    montar: (f, fechar, L) => {
      form = f;
      const tipo = f.elements.namedItem("tipo_conta") as HTMLSelectElement;
      const planoSel = f.elements.namedItem("plano_conta_id") as HTMLInputElement;
      const status = f.elements.namedItem("status") as HTMLSelectElement;
      const dica = $("#dicaPlano", L)!;
      const mostrarDica = (): void => {
        dica.textContent = contasDoTipo(tipo.value).length ? `Somente contas analíticas de ${tipo.value === "P" ? "despesa" : "receita"}.` : `Não há conta analítica de ${tipo.value === "P" ? "despesa" : "receita"} no plano de contas. Cadastre uma antes.`;
      };
      const parceiroCbx = comboboxDe(f, "parceiro_id")!;
      const refazerParceiros = (): void => {
        parceiroCbx.definirOpcoes(opcoesParceiro(tipo.value, planoSel.value, fv(f, "parceiro_id")), { valor: fv(f, "parceiro_id") });
      };
      tipo.addEventListener("change", () => {
        comboboxDe(f, "plano_conta_id")?.definirOpcoes(opcoesPlano(tipo.value), { valor: fv(f, "plano_conta_id") });
        mostrarDica();
        refazerParceiros();
      });
      planoSel.addEventListener("change", refazerParceiros);
      mostrarDica();
      const atualizar = (): void => {
        $$(".quitacao", L).forEach((e) => (e.hidden = status.value !== "Q"));
        const devido = numero(fv(f, "valor_titulo")) - numero(fv(f, "valor_desconto")) + numero(fv(f, "valor_multa")) + numero(fv(f, "valor_juros"));
        $("#devido", L)!.textContent = brl(devido);
      };
      f.addEventListener("input", atualizar);
      f.addEventListener("change", atualizar);
      atualizar();

      $("[data-salvar]", L)?.addEventListener("click", async () => {
        if (!fv(f, "plano_conta_id")) return void avisar("Escolha a conta do plano de contas.");
        if (!fv(f, "conta_bancaria_id")) return void avisar("Escolha a conta bancária.");
        if (!fv(f, "parceiro_id")) return void avisar("Escolha o parceiro de negócio.");
        if (!numero(fv(f, "valor_titulo"))) return void avisar("Informe o valor do título.");
        if (status.value === "Q" && !fv(f, "data_pagamento")) return void avisar("Informe a data de pagamento do título quitado.");
        const corpo: TituloEntrada = {
          tipo_conta: tipo.value as "P" | "R", conta_bancaria_id: fv(f, "conta_bancaria_id"), plano_conta_id: fv(f, "plano_conta_id"), parceiro_id: fv(f, "parceiro_id"),
          data_emissao: fv(f, "data_emissao") || null, data_vencimento: fv(f, "data_vencimento"), valor_titulo: numero(fv(f, "valor_titulo")),
          valor_desconto: numero(fv(f, "valor_desconto")), valor_multa: numero(fv(f, "valor_multa")), valor_juros: numero(fv(f, "valor_juros")),
          status: status.value as "A" | "Q" | "C", data_pagamento: status.value === "Q" ? fv(f, "data_pagamento") || null : null,
          valor_quitacao: status.value === "Q" && numero(fv(f, "valor_quitacao")) ? numero(fv(f, "valor_quitacao")) : null, anotacao: fv(f, "anotacao") || null,
        };
        await gravar({
          recarregar: ["financeiro"], mensagem: "Título salvo", fechar,
          operacao: () => (t ? apiFinanceiro.titulos.atualizar(t.id, corpo) : apiFinanceiro.titulos.criar(corpo)),
        });
      });
    },
  });
}

const porId = (id?: string): Titulo | undefined => tela.titulos?.find((t) => t.id === id);

registrarAcao("novoTitulo", () => void formTitulo());
registrarAcao("tituloEditar", (alvo) => {
  const t = porId(alvo.dataset.id);
  if (t) void formTitulo(t);
});
registrarAcao("tituloExcluir", (alvo) => {
  const t = porId(alvo.dataset.id);
  if (t) confirmarExclusao({ titulo: "Excluir título", mensagem: `Excluir o título de ${t.parceiro_nome} com vencimento em ${dataBR(t.data_vencimento)} (${brl(t.valor_devido)})?`, sucesso: "Título excluído", operacao: () => apiFinanceiro.titulos.excluir(t.id) });
});
registrarAcao("filtroFinTipo", (alvo) => {
  ui.finTipo = alvo.dataset.valor ?? "todos";
  render();
});
registrarAcao("filtroFinStatus", (alvo) => {
  ui.finStatus = alvo.dataset.valor ?? "todos";
  render();
});
