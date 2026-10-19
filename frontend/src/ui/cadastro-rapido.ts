/**
 * Cadastro rápido: criar o item que falta num campo de relação sem sair da tela em preenchimento.
 *
 * Cada entidade (cliente, parceiro, conta bancária…) registra aqui, no seu próprio módulo, um formulário reduzido
 * (só campos obrigatórios ou chave). O combobox com `cadastroRapido` oferece "+ Novo …" no fim da lista e chama
 * `abrirCadastroRapido`, que abre o formulário numa gaveta empilhada e devolve o item criado já como opção do campo.
 * Só um nível: dentro da gaveta de cadastro rápido nenhum campo oferece outro cadastro rápido.
 */
import { $ } from "@/core/dom";
import { html, type Safe } from "@/core/html";
import { podeEscrever } from "@/state/estado";
import type { OpcaoCombobox } from "./combobox";
import { abrirGaveta } from "./gaveta";
import { comTrava, gravar } from "./gravacao";

/** O que a tela de origem sabe e o formulário reduzido aproveita. */
export interface ContextoCadastro {
  /** Texto digitado na busca do campo (vira o nome/título). */
  sugestao?: string;
  /** Tipo do título ou da recorrência de origem: P = a pagar, R = a receber. */
  tipoConta?: string;
  /** A conta do plano escolhida na origem é de aporte de sócio (só aceita sócios). */
  aporte?: boolean;
  /** Cliente já escolhido na origem. */
  clienteId?: string;
}

export interface DefinicaoCadastroRapido<E, T> {
  /** "Novo parceiro", "Nova conta bancária": título da gaveta e base do rótulo "+ Novo parceiro…". */
  novo: string;
  /** Mensagem de sucesso ("Parceiro cadastrado"). */
  mensagem: string;
  /** Coleções globais a recarregar depois de criar. */
  recarregar: string[];
  /** Quem pode criar a partir desta origem (o servidor continua sendo a autoridade). */
  pode(ctx: ContextoCadastro): boolean;
  campos(ctx: ContextoCadastro): Safe;
  ligar?(form: HTMLFormElement, ctx: ContextoCadastro): void;
  /** Lê e valida; `null` = faltou algo (já avisou). */
  ler(form: HTMLFormElement, ctx: ContextoCadastro): E | null;
  criar(entrada: E): Promise<T>;
  opcao(criado: T): OpcaoCombobox;
  /** O item criado serve no campo de origem (ex.: parceiro com o papel que o título exige)? */
  aceito?(criado: T, ctx: ContextoCadastro): boolean;
}

export interface CriadoNoCadastro {
  opcao: OpcaoCombobox;
  aceito: boolean;
  item: unknown;
}

const definicoes = new Map<string, DefinicaoCadastroRapido<unknown, unknown>>();
let emCadastro = false;

export function registrarCadastroRapido<E, T>(tipo: string, def: DefinicaoCadastroRapido<E, T>): void {
  definicoes.set(tipo, def as DefinicaoCadastroRapido<unknown, unknown>);
}

/** O campo deve oferecer o cadastro rápido agora? */
export function cadastroRapidoDisponivel(tipo: string, ctx: ContextoCadastro = {}): boolean {
  const def = definicoes.get(tipo);
  return !!def && !emCadastro && podeEscrever() && def.pode(ctx);
}

/** Rótulo da opção no fim da lista: "+ Novo parceiro…" ou, com texto digitado, "+ Cadastrar “Acme”…". */
export function rotuloCadastroRapido(tipo: string, consulta = ""): string {
  const termo = consulta.trim();
  if (termo) return `+ Cadastrar “${termo}”…`;
  return `+ ${definicoes.get(tipo)?.novo ?? "Novo"}…`;
}

/** Abre o formulário reduzido numa gaveta empilhada. Resolve com o item criado ou `null` se a pessoa desistiu. */
export function abrirCadastroRapido(tipo: string, ctx: ContextoCadastro = {}): Promise<CriadoNoCadastro | null> {
  const def = definicoes.get(tipo);
  if (!def || emCadastro) return Promise.resolve(null);
  emCadastro = true;
  return new Promise((resolver) => {
    let resultado: CriadoNoCadastro | null = null;
    abrirGaveta({
      empilhar: true,
      titulo: def.novo,
      corpo: html`<div class="fields">${def.campos(ctx)}</div>`,
      rodape: html`<button class="btn primary" data-salvar>Salvar</button>`,
      aoFechar: () => {
        emCadastro = false;
        resolver(resultado);
      },
      montar: (form, fechar, camada) => {
        def.ligar?.(form, ctx);
        const salvar = $<HTMLButtonElement>("[data-salvar]", camada)!;
        salvar.addEventListener("click", () =>
          void comTrava(salvar, async () => {
            const entrada = def.ler(form, ctx);
            if (entrada === null) return null;
            const criado = await gravar({ recarregar: def.recarregar, mensagem: def.mensagem, operacao: () => def.criar(entrada) });
            if (criado === null) return null;
            resultado = { opcao: def.opcao(criado), aceito: def.aceito?.(criado, ctx) ?? true, item: criado };
            fechar();
            return criado;
          }),
        );
      },
    });
  });
}
