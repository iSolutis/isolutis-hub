import { $, $$ } from "@/core/dom";
import { esc, type Safe } from "@/core/html";
import { abrirCamada, type CamadaAberta } from "@/state/voltar";
import { ligarExclusaoEmDoisCliques } from "./exclusao";
import { ligarMascaraDeMoeda } from "./moeda";
import { abrirRegistro, fecharRegistro } from "./registro-aberto";

/**
 * Gaveta lateral (onde abrem todos os formulários).
 *
 * Responsabilidades: foco e acessibilidade (dialog modal, Esc, devolve o foco), confirmação em dois
 * cliques para exclusão, e os ganchos de conflito/autoria/presença que a funcionalidade preenche.
 *
 * As gavetas formam uma pilha em `#layer`. Abrir uma gaveta comum fecha as que estiverem abertas (o comportamento
 * de sempre); `empilhar: true` abre por cima e mantém a de baixo montada, com os valores digitados (é o que o
 * cadastro rápido usa). Só a gaveta do topo responde a Esc e ao Voltar do aparelho; as de baixo ficam `inert`.
 */
export interface OpcoesGaveta {
  titulo: string;
  corpo: Safe;
  rodape: Safe;
  /** Registro aberto (para aviso de conflito e presença "editando"). */
  registro?: { recurso: string; id: string; versao: number } | null;
  /** Linha "Cadastrado por …" mostrada acima do formulário. */
  autoria?: Safe | null;
  /** Liga os eventos do formulário; `camada` contém também o rodapé com os botões. */
  montar?: (form: HTMLFormElement, fechar: () => void, camada: HTMLElement) => void;
  aoFechar?: () => void;
  /** Abre por cima da gaveta atual em vez de substituí-la. */
  empilhar?: boolean;
}

/** O estado do registro aberto é comum à gaveta e ao formulário em página (ver `registro-aberto.ts`). */
export { registroAberto as gavetaAberta, observarRegistro as observarGaveta } from "./registro-aberto";
export type { RegistroAberto as GavetaAberta } from "./registro-aberto";

interface Camada {
  el: HTMLElement;
  fechar: (o?: { devolverFoco?: boolean; viaVoltar?: boolean }) => void;
}

const pilha: Camada[] = [];

/** Quantas gavetas estão abertas (0 = nenhuma). */
export const gavetasAbertas = (): number => pilha.length;

export function abrirGaveta(o: OpcoesGaveta): () => void {
  const layer = $("#layer");
  if (!layer) throw new Error("#layer ausente");
  const empilhada = !!o.empilhar && pilha.length > 0;
  if (!empilhada) while (pilha.length) pilha[pilha.length - 1]!.fechar({ devolverFoco: false });

  const anterior = document.activeElement as HTMLElement | null;
  const anteriorRegistro = abrirRegistro(o.titulo, o.registro ?? null);
  const abaixo = pilha[pilha.length - 1];
  // Ids fixos (`gform`, `conflito`) só na gaveta de base: a empilhada nunca tem registro aberto nem conflito.
  const el = document.createElement("div");
  el.className = empilhada ? "gaveta-camada empilhada" : "gaveta-camada";
  el.innerHTML = `<div class="scrim" data-fechar></div><div class="drawer" role="dialog" aria-modal="true" aria-label="${esc(o.titulo)}"><header><h2>${esc(o.titulo)}</h2><button class="btn ghost" data-fechar aria-label="Fechar">Fechar</button></header><form class="body"${empilhada ? "" : ' id="gform"'} novalidate>${empilhada ? "" : '<div class="banner conflito" id="conflito" hidden></div>'}${o.autoria ?? ""}${o.corpo}</form><footer>${o.rodape}</footer></div>`;
  layer.appendChild(el);
  if (abaixo) abaixo.el.inert = true;

  let historico: CamadaAberta | null = null;
  const camada: Camada = {
    el,
    fechar: ({ devolverFoco = true, viaVoltar = false } = {}) => {
      const i = pilha.indexOf(camada);
      if (i < 0) return;
      pilha.splice(i, 1);
      el.remove();
      document.removeEventListener("keydown", aoTeclar);
      if (historico && !viaVoltar) historico.fechar();
      if (abaixo) abaixo.el.inert = false;
      fecharRegistro(anteriorRegistro);
      o.aoFechar?.();
      if (devolverFoco) anterior?.focus?.();
    },
  };
  pilha.push(camada);
  const fechar = (): void => camada.fechar();

  const aoTeclar = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && pilha[pilha.length - 1] === camada) fechar();
  };
  document.addEventListener("keydown", aoTeclar);
  // Voltar do aparelho fecha só a gaveta empilhada (a de base segue o roteador, como sempre).
  if (empilhada) historico = abrirCamada(() => camada.fechar({ viaVoltar: true }));
  $$("[data-fechar]", el).forEach((b) => b.addEventListener("click", fechar));

  const form = $<HTMLFormElement>("form.body", el);
  if (!form) throw new Error("formulário da gaveta ausente");
  form.addEventListener("submit", (e) => e.preventDefault());

  // Exclusão em dois cliques: o primeiro clique arma o botão, o segundo confirma.
  ligarExclusaoEmDoisCliques(el);

  form.querySelectorAll<HTMLInputElement>("[data-moeda]").forEach(ligarMascaraDeMoeda);
  form.querySelector<HTMLElement>("input:not([readonly]):not([disabled]),select:not([disabled]),textarea")?.focus();
  o.montar?.(form, fechar, el);
  return fechar;
}
