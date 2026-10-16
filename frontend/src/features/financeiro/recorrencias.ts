/**
 * Recorrências: despesas e receitas que se repetem (aluguel, mensalidade…). Cada recorrência é um modelo; o
 * servidor gera os títulos reais, que aparecem em Títulos Financeiros com o indicador "Recorrente". Editar,
 * pausar ou encerrar só afeta os títulos futuros ainda abertos; os já quitados nunca mudam.
 */
import { $ } from "@/core/dom";
import { brl, dataBR, hoje, pluralizar } from "@/core/formato";
import { html, raw, type Safe } from "@/core/html";
import { numero, paraCampo } from "@/core/numero";
import { podeEscrever } from "@/state/estado";
import { registrarVista } from "@/state/nucleo";
import { registrarAcao } from "@/ui/acoes";
import { area, campo, fv, inp, sel } from "@/ui/campos";
import { cabecalhoDePagina, carregando, estadoVazio } from "@/ui/componentes";
import { tentar } from "@/ui/erros";
import { abrirGaveta } from "@/ui/gaveta";
import { espaco } from "@/ui/formularios";
import { gravar } from "@/ui/gravacao";
import { avisar } from "@/ui/toast";
import { botaoNovo } from "../comum";
import { apiFinanceiro, type ContaBancaria, type Parceiro, type PlanoConta, type Recorrencia, type RecorrenciaAtualizar, type RecorrenciaEntrada } from "./api";
import { confirmarExclusao, contasDoPlanoParaTitulo, formatarDocumento, GRUPO, parceirosParaTitulo } from "./comum";

export const FREQUENCIAS: ReadonlyArray<readonly [string, string]> = [
  ["semanal", "Semanal"],
  ["quinzenal", "Quinzenal (a cada 15 dias)"],
  ["mensal", "Mensal"],
  ["bimestral", "Bimestral"],
  ["trimestral", "Trimestral"],
  ["semestral", "Semestral"],
  ["anual", "Anual"],
];
const rotuloFrequencia = (f: string): string => FREQUENCIAS.find(([k]) => k === f)?.[1] ?? f;

const TERMINOS: ReadonlyArray<readonly [string, string]> = [
  ["sem_fim", "Sem fim (continua gerando)"],
  ["quantidade", "Após um número de ocorrências"],
  ["data", "Até uma data"],
];

const tela: { recorrencias: Recorrencia[] | null } = { recorrencias: null };

async function carregar(): Promise<void> {
  tela.recorrencias = await apiFinanceiro.recorrencias.listar();
}

/** "Encerrada", "Pausada" ou "Ativa", com a cor do selo. */
function situacao(r: Recorrencia): readonly [string, string] {
  if (r.encerrada_em) return ["Encerrada", ""];
  return r.ativa ? ["Ativa", "ok"] : ["Pausada", "warn"];
}

function periodo(r: Recorrencia): string {
  const inicio = `desde ${dataBR(r.data_inicio)}`;
  if (r.termino === "data") return `${inicio} até ${dataBR(r.data_fim)}`;
  if (r.termino === "quantidade") return `${inicio} · ${r.quantidade} ${pluralizar(r.quantidade ?? 0, "ocorrência", "ocorrências")}`;
  return `${inicio} · sem fim`;
}

function acoes(r: Recorrencia): Safe {
  if (r.encerrada_em || !podeEscrever()) return html``;
  const alternar = r.ativa
    ? html`<button class="btn" data-act="recorrenciaPausar" data-id="${r.id}">Pausar</button>`
    : html`<button class="btn" data-act="recorrenciaRetomar" data-id="${r.id}">Retomar</button>`;
  return html`<div class="fin-acoes"><button class="btn" data-act="recorrenciaEditar" data-id="${r.id}">Editar</button>${alternar}<button class="btn danger" data-act="recorrenciaEncerrar" data-id="${r.id}">Encerrar</button></div>`;
}

function vista(): Safe {
  const cabecalho = cabecalhoDePagina({
    titulo: "Recorrências",
    descricao: "Despesas e receitas que se repetem: o sistema gera os títulos de cada período",
    acoes: botaoNovo("novaRecorrencia", "Nova recorrência"),
  });
  if (!tela.recorrencias) return html`${cabecalho}${carregando()}`;
  if (!tela.recorrencias.length) {
    return html`${cabecalho}${estadoVazio({
      icone: "recorrencias",
      titulo: "Nenhuma recorrência cadastrada",
      texto: "Cadastre o aluguel, as assinaturas e as mensalidades para não lançar título por título.",
      acao: podeEscrever() ? html`<button class="btn primary" data-act="novaRecorrencia">Cadastrar a primeira recorrência</button>` : undefined,
    })}`;
  }
  return html`${cabecalho}
    <div class="tbl-wrap"><table style="min-width:900px"><thead><tr><th>Descrição</th><th>Tipo</th><th class="r">Valor</th><th>Frequência</th><th>Período</th><th class="r">Títulos</th><th>Próximo vencimento</th><th>Situação</th><th></th></tr></thead><tbody>
    ${tela.recorrencias.map((r) => {
      const [rotulo, cls] = situacao(r);
      return html`<tr><td><b>${r.parceiro_nome}</b><div class="sub"><span class="num">${r.plano_conta_codigo}</span> ${r.plano_conta_nome}</div></td>
        <td><span class="pill ${r.tipo_conta === "R" ? "ok" : "bad"}">${r.tipo_conta === "R" ? "A receber" : "A pagar"}</span></td>
        <td class="r num">${brl(r.valor_titulo)}</td><td>${rotuloFrequencia(r.frequencia)}</td><td class="sub">${periodo(r)}</td>
        <td class="r num">${r.titulos_gerados}<div class="sub">${r.titulos_abertos} em aberto</div></td>
        <td class="num">${r.proximo_vencimento ? dataBR(r.proximo_vencimento) : "—"}</td><td><span class="pill ${cls}">${rotulo}</span></td><td class="r">${acoes(r)}</td></tr>`;
    })}
    </tbody></table></div>`;
}

registrarVista({ id: "fin-recorrencias", nome: "Recorrências", grupo: GRUPO, permissao: "financeiro", carregar, depende: ["financeiro"], desenhar: vista });

async function formulario(r?: Recorrencia): Promise<void> {
  // as listas de apoio são buscadas na hora, para refletir cadastros feitos há pouco
  const apoio = await tentar(() => Promise.all([apiFinanceiro.plano.listar(), apiFinanceiro.contas.listar(), apiFinanceiro.parceiros.listar()]));
  if (!apoio) return;
  const [plano, contas, parceiros]: [PlanoConta[], ContaBancaria[], Parceiro[]] = apoio;
  const tipoInicial = r?.tipo_conta ?? "P";
  const opcoesPlano = (tipo: string, atual?: string): Safe => {
    const contasDoTipo = contasDoPlanoParaTitulo(plano, tipo);
    return html`<option value="">${contasDoTipo.length ? "Selecione…" : "Nenhuma conta disponível"}</option>${contasDoTipo.map((c) => html`<option value="${c.id}"${raw(c.id === atual ? " selected" : "")}>${c.codigo} ${c.nome}</option>`)}`;
  };
  const opcoesParceiro = (tipo: string, planoId: string, atual?: string): Safe => {
    const aporte = plano.find((c) => c.id === planoId)?.aporte_socio ?? false;
    return html`<option value="">Selecione…</option>${parceirosParaTitulo(parceiros, tipo, aporte).map((p) => html`<option value="${p.id}"${raw(p.id === atual ? " selected" : "")}>${p.nome} · ${formatarDocumento(p.cpf_cnpj)}</option>`)}`;
  };

  abrirGaveta({
    titulo: r ? `Recorrência · ${r.parceiro_nome}` : "Nova recorrência",
    corpo: html`<div class="fields">
      ${campo("Tipo", sel("tipo_conta", [["P", "A pagar (despesa)"], ["R", "A receber (receita)"]], tipoInicial))}
      ${campo("Valor de cada título (R$)", inp("valor_titulo", paraCampo(r?.valor_titulo), 'inputmode="decimal" placeholder="0,00"'))}
      <div class="field full"><label for="f-plano_conta_id">Conta do plano de contas</label><select name="plano_conta_id" id="f-plano_conta_id">${opcoesPlano(tipoInicial, r?.plano_conta_id)}</select></div>
      ${campo("Conta bancária", sel("conta_bancaria_id", [["", "Selecione…"], ...contas.map((c) => [c.id, `${c.nome} (${c.instituicao_codigo})`] as const)], r?.conta_bancaria_id ?? ""))}
      <div class="field"><label for="f-parceiro_id">Parceiro de negócio</label><select name="parceiro_id" id="f-parceiro_id">${opcoesParceiro(tipoInicial, r?.plano_conta_id ?? "", r?.parceiro_id)}</select></div>
      ${campo("Frequência", sel("frequencia", FREQUENCIAS, r?.frequencia ?? "mensal"))}
      ${campo("Primeiro vencimento", inp("data_inicio", r?.data_inicio ?? hoje(), 'type="date"'))}
      ${campo("Término", sel("termino", TERMINOS, r?.termino ?? "sem_fim"))}
      <div class="field termino-quantidade"><label for="f-quantidade">Número de ocorrências</label>${inp("quantidade", r?.quantidade ?? "", 'type="number" min="1" max="600" inputmode="numeric"')}</div>
      <div class="field termino-data"><label for="f-data_fim">Termina em</label>${inp("data_fim", r?.data_fim ?? "", 'type="date"')}</div>
      ${campo("Anotação", area("anotacao", r?.anotacao), true)}
    </div>
    <p class="sub" id="dicaRecorrencia" style="margin:0"></p>`,
    rodape: html`<button class="btn primary" data-salvar>Salvar</button>${espaco}`,
    montar: (f, fechar, L) => {
      const tipo = f.elements.namedItem("tipo_conta") as HTMLSelectElement;
      const planoSel = f.elements.namedItem("plano_conta_id") as HTMLSelectElement;
      const parceiroSel = f.elements.namedItem("parceiro_id") as HTMLSelectElement;
      const termino = f.elements.namedItem("termino") as HTMLSelectElement;
      const dica = $("#dicaRecorrencia", L)!;
      if (r) {
        // frequência e início definem as datas de todos os títulos: para mudá-los, encerre e crie outra recorrência
        (["tipo_conta", "frequencia", "data_inicio"] as const).forEach((n) => ((f.elements.namedItem(n) as HTMLInputElement).disabled = true));
        dica.textContent = "Tipo, frequência e primeiro vencimento não mudam. As alterações valem para os títulos futuros em aberto; os já quitados ficam como estão.";
      }
      const refazerParceiros = (): void => {
        const atual = parceiroSel.value;
        parceiroSel.innerHTML = String(opcoesParceiro(tipo.value, planoSel.value, atual));
      };
      tipo.addEventListener("change", () => {
        planoSel.innerHTML = String(opcoesPlano(tipo.value));
        refazerParceiros();
      });
      planoSel.addEventListener("change", refazerParceiros);
      const ajustarTermino = (): void => {
        f.querySelector<HTMLElement>(".termino-quantidade")!.hidden = termino.value !== "quantidade";
        f.querySelector<HTMLElement>(".termino-data")!.hidden = termino.value !== "data";
      };
      termino.addEventListener("change", ajustarTermino);
      ajustarTermino();

      $("[data-salvar]", L)?.addEventListener("click", async () => {
        if (!fv(f, "plano_conta_id")) return void avisar("Escolha a conta do plano de contas.");
        if (!fv(f, "conta_bancaria_id")) return void avisar("Escolha a conta bancária.");
        if (!fv(f, "parceiro_id")) return void avisar("Escolha o parceiro de negócio.");
        if (!(numero(fv(f, "valor_titulo")) > 0)) return void avisar("Informe o valor de cada título.");
        if (!fv(f, "data_inicio")) return void avisar("Informe o primeiro vencimento.");
        if (termino.value === "quantidade" && !(Number(fv(f, "quantidade")) >= 1)) return void avisar("Informe quantas ocorrências a recorrência tem.");
        if (termino.value === "data" && !fv(f, "data_fim")) return void avisar("Informe a data final da recorrência.");
        if (termino.value === "data" && fv(f, "data_fim") < fv(f, "data_inicio")) return void avisar("A data final não pode ser antes do primeiro vencimento.");
        const comum: RecorrenciaAtualizar = {
          conta_bancaria_id: fv(f, "conta_bancaria_id"), plano_conta_id: fv(f, "plano_conta_id"), parceiro_id: fv(f, "parceiro_id"),
          valor_titulo: numero(fv(f, "valor_titulo")), anotacao: fv(f, "anotacao") || null, termino: termino.value as RecorrenciaAtualizar["termino"],
          quantidade: termino.value === "quantidade" ? Number(fv(f, "quantidade")) : null,
          data_fim: termino.value === "data" ? fv(f, "data_fim") : null,
        };
        const criar: RecorrenciaEntrada = { ...comum, tipo_conta: tipo.value as "P" | "R", frequencia: fv(f, "frequencia") as RecorrenciaEntrada["frequencia"], data_inicio: fv(f, "data_inicio") };
        await gravar({
          recarregar: ["financeiro"], mensagem: r ? "Recorrência atualizada" : "Recorrência criada", fechar,
          operacao: () => (r ? apiFinanceiro.recorrencias.atualizar(r.id, comum) : apiFinanceiro.recorrencias.criar(criar)),
        });
      });
    },
  });
}

const porId = (id?: string): Recorrencia | undefined => tela.recorrencias?.find((r) => r.id === id);

registrarAcao("novaRecorrencia", () => void formulario());
registrarAcao("recorrenciaEditar", (alvo) => {
  const r = porId(alvo.dataset.id);
  if (r) void formulario(r);
});
registrarAcao("recorrenciaPausar", async (alvo) => {
  const r = porId(alvo.dataset.id);
  if (r) await gravar({ recarregar: ["financeiro"], mensagem: "Recorrência pausada", operacao: () => apiFinanceiro.recorrencias.pausar(r.id) });
});
registrarAcao("recorrenciaRetomar", async (alvo) => {
  const r = porId(alvo.dataset.id);
  if (r) await gravar({ recarregar: ["financeiro"], mensagem: "Recorrência retomada", operacao: () => apiFinanceiro.recorrencias.retomar(r.id) });
});
registrarAcao("recorrenciaEncerrar", (alvo) => {
  const r = porId(alvo.dataset.id);
  if (!r) return;
  confirmarExclusao({
    titulo: "Encerrar recorrência",
    mensagem: `Encerrar a recorrência de ${r.parceiro_nome} (${brl(r.valor_titulo)}, ${rotuloFrequencia(r.frequencia).toLowerCase()})? Os ${r.titulos_abertos} títulos futuros em aberto serão removidos; os já quitados permanecem.`,
    sucesso: "Recorrência encerrada",
    operacao: async () => void (await apiFinanceiro.recorrencias.encerrar(r.id)),
  });
});
