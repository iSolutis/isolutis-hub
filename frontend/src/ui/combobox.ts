/**
 * Combobox pesquisável: escolha de um item de lista longa digitando para filtrá-la.
 *
 * Contrato de formulário igual ao do `<select>` que substitui: um `<input type="hidden" name=…>` guarda o
 * identificador (lido por `fv`, escutado por `change`) e um `<input>` visível mostra o rótulo. Texto digitado e
 * não escolhido nunca vira valor.
 *
 * Duas apresentações, escolhidas na hora do uso por `matchMedia("(max-width: 860px)")`:
 *  - lista suspensa (telas largas), num portal em `document.body` ancorado ao campo, para não ser cortada pela
 *    rolagem da gaveta;
 *  - folha de seleção em tela cheia (telas estreitas), com busca no topo, itens de 44 px, altura que acompanha o
 *    teclado virtual e o botão Voltar do aparelho fechando só a folha (`state/voltar.ts`).
 *
 * O HTML vem de `combobox(...)`; o comportamento é ligado por delegação de eventos no `document`, então vale
 * para qualquer tela que renderize o campo, inclusive quando a gaveta troca o conteúdo de `#layer`. O código da
 * tela fala com o campo por `comboboxDe(form, nome)` (`definirValor`, `definirOpcoes`).
 */
import { normalizarTexto } from "@/core/formato";
import { attr, esc, html, raw, type Safe } from "@/core/html";
import { abrirCamada, type CamadaAberta } from "@/state/voltar";

export interface OpcaoCombobox {
  id: string;
  rotulo: string;
  /** Código mostrado antes do rótulo e usado na busca (por exemplo, `2.01.015`). */
  codigo?: string;
  /** Contexto em texto secundário, também pesquisável (por exemplo, o grupo pai de uma conta). */
  grupo?: string;
}

/** Ação fixa no fim da lista, visível mesmo com filtro ativo (por exemplo, "+ Novo cliente…"). */
export interface AcaoFinalCombobox {
  valor: string;
  rotulo: string;
}

export interface OpcoesCombobox {
  /** `name` do campo oculto (e base do `id` do campo visível: `f-<nome>`). */
  nome: string;
  /** Rótulo do campo: nome acessível e título da folha. */
  rotulo: string;
  opcoes: readonly OpcaoCombobox[];
  valor?: string | null;
  /** Texto do campo vazio (padrão "Selecione…"). */
  vazio?: string;
  obrigatorio?: boolean;
  desabilitado?: boolean;
  acaoFinal?: AcaoFinalCombobox;
}

export const LIMITE_DE_ITENS = 50;
const CONSULTA_ESTREITA = "(max-width: 860px)";
const ALTURA_MAXIMA_LISTA = 320;

export const textoDaOpcao = (o: OpcaoCombobox): string => (o.codigo ? `${o.codigo} ${o.rotulo}` : o.rotulo);

// ---------------------------------------------------------------------------------------------------- filtro
export interface ResultadoFiltro {
  itens: OpcaoCombobox[];
  total: number;
}

/** Pontos do termo (menor é melhor): 0 começa o código ou o nome, 1 começa uma palavra, 2 contém, 3 só no grupo. */
function pontosDoTermo(termo: string, campos: readonly string[], grupo: string): number | null {
  let melhor: number | null = null;
  for (const campo of campos) {
    const i = campo.indexOf(termo);
    if (i === -1) continue;
    const p = i === 0 ? 0 : /[\s.\-/]/.test(campo[i - 1] ?? "") ? 1 : 2;
    melhor = melhor === null ? p : Math.min(melhor, p);
  }
  if (melhor === null && grupo.includes(termo)) return 3;
  return melhor;
}

/**
 * Filtra por código, nome e grupo sem diferenciar acento nem caixa. Todos os termos digitados precisam casar;
 * melhores resultados primeiro (empate mantém a ordem original); devolve no máximo `limite` itens e o total.
 */
export function filtrarOpcoes(opcoes: readonly OpcaoCombobox[], consulta: string, limite = LIMITE_DE_ITENS): ResultadoFiltro {
  const termos = normalizarTexto(consulta).split(/\s+/).filter(Boolean);
  if (!termos.length) return { itens: opcoes.slice(0, limite), total: opcoes.length };
  const casadas: Array<{ opcao: OpcaoCombobox; pontos: number; ordem: number }> = [];
  opcoes.forEach((opcao, ordem) => {
    const campos = [normalizarTexto(opcao.codigo ?? ""), normalizarTexto(opcao.rotulo)];
    const grupo = normalizarTexto(opcao.grupo ?? "");
    let pontos = 0;
    for (const termo of termos) {
      const p = pontosDoTermo(termo, campos, grupo);
      if (p === null) return;
      pontos += p;
    }
    casadas.push({ opcao, pontos, ordem });
  });
  casadas.sort((a, b) => a.pontos - b.pontos || a.ordem - b.ordem);
  return { itens: casadas.slice(0, limite).map((c) => c.opcao), total: casadas.length };
}

// ------------------------------------------------------------------------------------------------ marcação
const registro = new Map<string, OpcoesCombobox>();
const controladores = new WeakMap<HTMLElement, Combobox>();
let sequencia = 0;

/** HTML do campo. O comportamento é ligado sob demanda, na primeira interação ou em `comboboxDe`. */
export function combobox(o: OpcoesCombobox): Safe {
  const id = `cbx${++sequencia}`;
  if (registro.size > 400) registro.delete(registro.keys().next().value as string); // renders antigos
  registro.set(id, { ...o });
  const atual = o.opcoes.find((x) => x.id === (o.valor ?? ""));
  const acao = o.acaoFinal && o.valor === o.acaoFinal.valor ? o.acaoFinal : undefined;
  const valor = atual?.id ?? acao?.valor ?? "";
  const texto = atual ? textoDaOpcao(atual) : (acao?.rotulo ?? "");
  return html`<div class="cbx" data-cbx="${id}">
    <input type="hidden" name="${o.nome}" value="${valor}"${attr("disabled", o.desabilitado)}>
    <input class="cbx-in" id="f-${o.nome}" type="text" role="combobox" aria-label="${o.rotulo}" aria-haspopup="listbox" aria-expanded="false" aria-autocomplete="list" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${o.vazio ?? "Selecione…"}" value="${texto}"${attr("disabled", o.desabilitado)}${o.obrigatorio ? raw(' aria-required="true"') : ""}>
    <span class="cbx-seta" aria-hidden="true"></span>
  </div>`;
}

/** Controlador do campo `nome` dentro de `raiz` (formulário, gaveta ou página), ou `null` se não existir. */
export function comboboxDe(raiz: ParentNode, nome: string): Combobox | null {
  const oculto = raiz.querySelector<HTMLInputElement>(`.cbx input[type="hidden"][name="${nome}"]`);
  const caixa = oculto?.closest<HTMLElement>(".cbx");
  return caixa ? controladorDe(caixa) : null;
}

function controladorDe(caixa: HTMLElement): Combobox | null {
  const existente = controladores.get(caixa);
  if (existente) return existente;
  const cfg = registro.get(caixa.dataset.cbx ?? "");
  const oculto = caixa.querySelector<HTMLInputElement>('input[type="hidden"]');
  const campo = caixa.querySelector<HTMLInputElement>(".cbx-in");
  if (!cfg || !oculto || !campo) return null;
  const c = new Combobox(caixa, oculto, campo, cfg);
  controladores.set(caixa, c);
  return c;
}

const estreita = (): boolean => typeof matchMedia === "function" && matchMedia(CONSULTA_ESTREITA).matches;

// ------------------------------------------------------------------------------------------- controlador
export class Combobox {
  private opcoes: OpcaoCombobox[];
  private valor: string;
  private modo: "lista" | "folha" | null = null;
  private consulta = "";
  private itens: OpcaoCombobox[] = [];
  private ativo = -1;
  private lista: HTMLElement | null = null; // portal (lista) ou folha
  private caixaDeItens: HTMLElement | null = null; // elemento role=listbox
  private estado: HTMLElement | null = null; // região "polite"
  private busca: HTMLInputElement | null = null; // campo de busca da folha
  private camada: CamadaAberta | null = null;
  private limpezas: Array<() => void> = [];
  private readonly id: string;

  constructor(
    readonly raiz: HTMLElement,
    private readonly oculto: HTMLInputElement,
    private readonly campo: HTMLInputElement,
    private readonly cfg: OpcoesCombobox,
  ) {
    this.id = raiz.dataset.cbx ?? "cbx";
    this.opcoes = [...cfg.opcoes];
    this.valor = oculto.value;
  }

  get aberto(): boolean {
    return this.modo !== null;
  }

  // ----------------------------------------------------------------------------------------- valor e opções
  private textoDe(valor: string): string {
    if (!valor) return "";
    if (this.cfg.acaoFinal && valor === this.cfg.acaoFinal.valor) return this.cfg.acaoFinal.rotulo;
    const o = this.opcoes.find((x) => x.id === valor);
    return o ? textoDaOpcao(o) : "";
  }

  private aplicar(valor: string, emitir: boolean): void {
    const mudou = valor !== this.valor;
    this.valor = valor;
    this.oculto.value = valor;
    this.campo.value = this.textoDe(valor);
    if (mudou && emitir) this.oculto.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Define o valor por código (a tela escolheu por outro campo). Id desconhecido limpa o campo. */
  definirValor(id: string | null, o: { silencioso?: boolean } = {}): void {
    const novo = id && this.textoDe(id) ? id : "";
    this.aplicar(novo, !o.silencioso);
  }

  /** Troca a lista. Mantém a escolha se o item continua disponível; senão limpa o campo e avisa com `change`. */
  definirOpcoes(opcoes: readonly OpcaoCombobox[], o: { valor?: string | null; silencioso?: boolean } = {}): void {
    this.opcoes = [...opcoes];
    const quer = o.valor !== undefined ? (o.valor ?? "") : this.valor;
    this.aplicar(this.textoDe(quer) ? quer : "", !o.silencioso);
    if (this.modo) this.desenhar();
  }

  definirDesabilitado(desabilitado: boolean): void {
    if (desabilitado) this.fechar(false);
    this.campo.disabled = desabilitado;
    this.oculto.disabled = desabilitado;
  }

  // ------------------------------------------------------------------------------------------ abrir e fechar
  /** Em tela estreita o campo só abre a folha: não deve levantar o teclado por trás dela. */
  preparar(): void {
    const e = estreita();
    this.campo.readOnly = e;
    if (e) this.campo.inputMode = "none";
    else this.campo.removeAttribute("inputmode");
  }

  abrir(): void {
    if (this.modo || this.campo.disabled) return;
    this.preparar();
    this.consulta = "";
    if (estreita()) this.abrirFolha();
    else this.abrirLista();
  }

  fechar(restaurar = true, viaVoltar = false): void {
    if (!this.modo) return;
    const eraFolha = this.modo === "folha";
    this.modo = null;
    this.limpezas.splice(0).forEach((f) => f());
    this.lista?.remove();
    this.lista = this.caixaDeItens = this.estado = this.busca = null;
    const camada = this.camada;
    this.camada = null;
    if (camada && !viaVoltar) camada.fechar();
    document.documentElement.classList.remove("cbx-travado");
    this.campo.setAttribute("aria-expanded", "false");
    this.campo.removeAttribute("aria-controls");
    this.campo.removeAttribute("aria-activedescendant");
    if (restaurar && !eraFolha) this.restaurarTexto();
    if (eraFolha) this.campo.focus({ preventScroll: true });
  }

  /** Sair do campo: texto vazio limpa a escolha; texto solto volta ao rótulo escolhido. */
  private restaurarTexto(): void {
    if (this.campo.value.trim() === "") this.aplicar("", true);
    else this.campo.value = this.textoDe(this.valor);
  }

  private ouvir<K extends keyof DocumentEventMap>(alvo: Document, tipo: K, fn: (e: DocumentEventMap[K]) => void, captura = false): void {
    alvo.addEventListener(tipo, fn as EventListener, captura);
    this.limpezas.push(() => alvo.removeEventListener(tipo, fn as EventListener, captura));
  }

  /** `Esc` em fase de captura: fecha só a lista e impede que a gaveta (ouvinte em bolha) feche junto. */
  private interceptarEsc(): void {
    this.ouvir(
      document,
      "keydown",
      (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.fechar(true);
        this.campo.focus({ preventScroll: true });
      },
      true,
    );
  }

  // ------------------------------------------------------------------------------------------------ lista
  private abrirLista(): void {
    this.modo = "lista";
    const lista = document.createElement("div");
    lista.className = "cbx-lista";
    lista.innerHTML = `<div class="cbx-itens" role="listbox" id="${this.id}-lista" aria-label="${esc(this.cfg.rotulo)}"></div><div class="cbx-mais" aria-hidden="true"></div><div class="cbx-estado visualmente-oculto" role="status" aria-live="polite"></div>`;
    document.body.appendChild(lista);
    this.lista = lista;
    this.caixaDeItens = lista.querySelector(".cbx-itens");
    this.estado = lista.querySelector(".cbx-estado");
    // Manter o foco no campo: clicar na lista não pode tirar o foco (senão ela fecharia antes do clique).
    lista.addEventListener("mousedown", (e) => e.preventDefault());
    lista.addEventListener("click", (e) => this.aoClicar(e));
    lista.addEventListener("mousemove", (e) => this.aoPassar(e));
    this.campo.setAttribute("aria-expanded", "true");
    this.campo.setAttribute("aria-controls", `${this.id}-lista`);
    this.interceptarEsc();
    const reposicionar = (): void => (this.campo.isConnected ? this.posicionar() : this.fechar(false));
    window.addEventListener("scroll", reposicionar, true);
    window.addEventListener("resize", reposicionar);
    this.limpezas.push(() => {
      window.removeEventListener("scroll", reposicionar, true);
      window.removeEventListener("resize", reposicionar);
    });
    this.campo.select();
    this.desenhar();
    this.posicionar();
  }

  /** Ancora a lista ao campo; abre para cima se faltar espaço embaixo. */
  private posicionar(): void {
    const lista = this.lista;
    if (!lista || this.modo !== "lista") return;
    const r = this.campo.getBoundingClientRect();
    const abaixo = window.innerHeight - r.bottom - 12;
    const acima = r.top - 12;
    const paraBaixo = abaixo >= 200 || abaixo >= acima;
    lista.style.left = `${Math.max(8, r.left)}px`;
    lista.style.width = `${r.width}px`;
    lista.style.maxHeight = `${Math.max(120, Math.min(ALTURA_MAXIMA_LISTA, paraBaixo ? abaixo : acima))}px`;
    if (paraBaixo) {
      lista.style.top = `${r.bottom + 4}px`;
      lista.style.bottom = "auto";
    } else {
      lista.style.bottom = `${window.innerHeight - r.top + 4}px`;
      lista.style.top = "auto";
    }
  }

  // ------------------------------------------------------------------------------------------------ folha
  private abrirFolha(): void {
    this.modo = "folha";
    const folha = document.createElement("div");
    folha.className = "cbx-folha";
    folha.setAttribute("role", "dialog");
    folha.setAttribute("aria-modal", "true");
    folha.setAttribute("aria-label", this.cfg.rotulo);
    folha.innerHTML = `<header><button type="button" class="cbx-voltar" aria-label="Fechar"><span aria-hidden="true">‹</span></button><h2>${esc(this.cfg.rotulo)}</h2></header>
      <div class="cbx-busca"><input class="cbx-busca-in" type="search" role="combobox" aria-expanded="true" aria-controls="${this.id}-lista" aria-autocomplete="list" aria-label="Buscar em ${esc(this.cfg.rotulo)}" placeholder="Buscar…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="search" enterkeyhint="done"></div>
      <div class="cbx-itens" role="listbox" id="${this.id}-lista" aria-label="${esc(this.cfg.rotulo)}"></div>
      <div class="cbx-mais" aria-hidden="true"></div><div class="cbx-estado visualmente-oculto" role="status" aria-live="polite"></div>`;
    document.body.appendChild(folha);
    document.documentElement.classList.add("cbx-travado");
    this.lista = folha;
    this.caixaDeItens = folha.querySelector(".cbx-itens");
    this.estado = folha.querySelector(".cbx-estado");
    const busca = folha.querySelector<HTMLInputElement>(".cbx-busca-in")!;
    this.busca = busca;
    this.campo.setAttribute("aria-expanded", "true");

    // Voltar do aparelho fecha só a folha (o roteador reconhece a camada e não navega).
    this.camada = abrirCamada(() => this.fechar(true, true));

    folha.querySelector(".cbx-voltar")!.addEventListener("click", () => this.fechar(true));
    folha.addEventListener("click", (e) => this.aoClicar(e));
    busca.addEventListener("input", () => {
      this.consulta = busca.value;
      this.desenhar();
    });
    busca.addEventListener("keydown", (e) => this.aoTeclar(e));
    folha.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      // foco preso: Voltar e busca
      const alvos = [folha.querySelector<HTMLElement>(".cbx-voltar")!, busca];
      const i = alvos.indexOf(document.activeElement as HTMLElement);
      const prox = alvos[(i + (e.shiftKey ? -1 : 1) + alvos.length) % alvos.length]!;
      e.preventDefault();
      prox.focus();
    });
    this.interceptarEsc();

    // Altura e posição seguem a área realmente visível (teclado virtual); `100dvh` é a reserva do CSS.
    const vv = window.visualViewport;
    if (vv) {
      const ajustar = (): void => {
        folha.style.height = `${vv.height}px`;
        folha.style.top = `${vv.offsetTop}px`;
      };
      ajustar();
      vv.addEventListener("resize", ajustar);
      vv.addEventListener("scroll", ajustar);
      this.limpezas.push(() => {
        vv.removeEventListener("resize", ajustar);
        vv.removeEventListener("scroll", ajustar);
      });
    }
    // Mudou para tela larga com a folha aberta (girar o aparelho): fecha.
    const aoRedimensionar = (): void => {
      if (!estreita()) this.fechar(true);
    };
    window.addEventListener("resize", aoRedimensionar);
    this.limpezas.push(() => window.removeEventListener("resize", aoRedimensionar));

    this.desenhar();
    busca.focus();
  }

  // ----------------------------------------------------------------------------------------------- desenho
  private desenhar(): void {
    const caixa = this.caixaDeItens;
    if (!caixa) return;
    const { itens, total } = filtrarOpcoes(this.opcoes, this.consulta);
    this.itens = itens;
    const acao = this.cfg.acaoFinal;
    const linhas = itens.map(
      (o, i) =>
        `<div class="cbx-op" role="option" id="${this.id}-op-${i}" data-i="${i}" aria-selected="${o.id === this.valor}">${o.codigo ? `<span class="cbx-cod">${esc(o.codigo)}</span>` : ""}<span class="cbx-tx">${esc(o.rotulo)}${o.grupo ? `<small class="cbx-gr">${esc(o.grupo)}</small>` : ""}</span></div>`,
    );
    if (!itens.length) linhas.push(`<div class="cbx-vazio" role="presentation">Nenhum resultado</div>`);
    if (acao) {
      linhas.push(`<div class="cbx-op cbx-acao" role="option" id="${this.id}-op-${itens.length}" data-i="${itens.length}" aria-selected="${acao.valor === this.valor}"><span class="cbx-tx">${esc(acao.rotulo)}</span></div>`);
    }
    caixa.innerHTML = linhas.join("");
    const mais = this.lista?.querySelector<HTMLElement>(".cbx-mais");
    if (mais) mais.textContent = total > itens.length ? `Mostrando ${itens.length} de ${total}. Digite para refinar.` : "";
    if (this.estado) this.estado.textContent = total ? `${total} ${total === 1 ? "resultado" : "resultados"}` : "Nenhum resultado";
    const selecionado = this.consulta ? -1 : itens.findIndex((o) => o.id === this.valor);
    this.ativo = selecionado >= 0 ? selecionado : itens.length || acao ? 0 : -1;
    this.marcarAtivo(selecionado >= 0);
  }

  private get quantidade(): number {
    return this.itens.length + (this.cfg.acaoFinal ? 1 : 0);
  }

  private marcarAtivo(rolar = true): void {
    const caixa = this.caixaDeItens;
    if (!caixa) return;
    caixa.querySelectorAll<HTMLElement>(".cbx-op").forEach((el) => {
      const ativo = Number(el.dataset.i) === this.ativo;
      if (ativo) el.setAttribute("data-ativo", "true");
      else el.removeAttribute("data-ativo");
      if (ativo && rolar) el.scrollIntoView?.({ block: "nearest" });
    });
    const dono = this.busca ?? this.campo;
    if (this.ativo >= 0) dono.setAttribute("aria-activedescendant", `${this.id}-op-${this.ativo}`);
    else dono.removeAttribute("aria-activedescendant");
  }

  // ------------------------------------------------------------------------------------------------ eventos
  private aoClicar(e: Event): void {
    const el = (e.target as Element).closest<HTMLElement>(".cbx-op");
    if (el) this.escolherIndice(Number(el.dataset.i));
  }

  private aoPassar(e: Event): void {
    const el = (e.target as Element).closest<HTMLElement>(".cbx-op");
    const i = el ? Number(el.dataset.i) : -1;
    if (i >= 0 && i !== this.ativo) {
      this.ativo = i;
      this.marcarAtivo(false);
    }
  }

  private escolherIndice(i: number): void {
    const acao = this.cfg.acaoFinal;
    if (acao && i === this.itens.length) this.escolher(acao.valor);
    else {
      const o = this.itens[i];
      if (o) this.escolher(o.id);
    }
  }

  private escolher(valor: string): void {
    this.aplicar(valor, true);
    this.fechar(false);
    this.campo.focus({ preventScroll: true });
  }

  /** Teclas do campo (lista) ou da busca (folha). */
  aoTeclar(e: KeyboardEvent): void {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!this.modo) return this.abrir();
        const n = this.quantidade;
        if (!n) return;
        this.ativo = e.key === "ArrowDown" ? (this.ativo + 1) % n : (this.ativo - 1 + n) % n;
        this.marcarAtivo();
        return;
      }
      case "Enter":
        e.preventDefault(); // nunca envia o formulário
        if (this.modo && this.ativo >= 0) this.escolherIndice(this.ativo);
        else if (!this.modo && estreita()) this.abrir();
        return;
      case " ":
        if (estreita() && !this.modo) {
          e.preventDefault();
          this.abrir();
        }
        return;
      case "Tab":
        if (this.modo === "lista") this.fechar(true);
        return;
    }
  }

  aoDigitar(): void {
    if (estreita()) return;
    if (!this.modo) this.abrir();
    this.consulta = this.campo.value;
    this.desenhar();
  }
}

// ------------------------------------------------------------------------- ligação por delegação (uma vez)
let instalado = false;

function campoDoEvento(e: Event): HTMLInputElement | null {
  const alvo = e.target;
  return alvo instanceof Element ? alvo.closest<HTMLInputElement>(".cbx-in") : null;
}

function instalar(): void {
  if (instalado || typeof document === "undefined") return;
  instalado = true;
  const de = (e: Event): Combobox | null => {
    const campo = campoDoEvento(e);
    const caixa = campo?.closest<HTMLElement>(".cbx");
    return caixa ? controladorDe(caixa) : null;
  };
  // Antes do foco, para que em tela estreita o campo já esteja somente leitura (sem teclado virtual).
  document.addEventListener("pointerdown", (e) => de(e)?.preparar());
  document.addEventListener("focusin", (e) => de(e)?.preparar());
  document.addEventListener("click", (e) => {
    const alvo = e.target instanceof Element ? e.target : null;
    const seta = alvo?.closest<HTMLElement>(".cbx-seta");
    if (seta) {
      const c = controladorDe(seta.closest<HTMLElement>(".cbx")!);
      if (c?.aberto) c.fechar(true);
      else {
        c?.abrir();
        seta.closest<HTMLElement>(".cbx")?.querySelector<HTMLInputElement>(".cbx-in")?.focus({ preventScroll: true });
      }
      return;
    }
    de(e)?.abrir();
  });
  document.addEventListener("input", (e) => de(e)?.aoDigitar());
  document.addEventListener("keydown", (e) => de(e)?.aoTeclar(e));
  document.addEventListener("focusout", (e) => {
    const c = de(e);
    if (c && c.aberto && !(e.relatedTarget instanceof Element && e.relatedTarget.closest(".cbx-folha"))) {
      // folha aberta: o foco foi para a busca de propósito
      if (!document.querySelector(".cbx-folha")) c.fechar(true);
    }
  });
}

instalar();
