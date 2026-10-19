import { html, raw, type Safe } from "@/core/html";
import { compararTexto, hoje } from "@/core/formato";
import { dados, defineDono, eu, nomeMembro, podeEscrever } from "@/state/estado";
import { campo, sel, type Opcao } from "./campos";
import { combobox } from "./combobox";

export const botaoSalvar = (rotulo = "Salvar"): Safe => (podeEscrever() ? html`<button class="btn primary" data-salvar>${rotulo}</button>` : html``);

export const botaoExcluir = (mostrar: boolean): Safe =>
  mostrar && podeEscrever() ? html`<button class="btn danger" data-excluir>Excluir</button>` : html``;

export const espaco = raw('<span class="sp"></span>');

/** Opções de pessoas da equipe para selects de responsável. */
export const opcoesEquipe = (vazio = "Sem responsável", marcarEu = false): Opcao[] => [
  ["", vazio],
  ...dados.equipe.filter((m) => m.ativo).map((m) => [m.id, m.nome + (marcarEu && m.id === eu.id ? " (você)" : "")] as const),
];

/** Registro que a pessoa vê mas não pode alterar (escopo de acesso: `pode_editar` vem do servidor). */
export const soLeitura = (registro?: { pode_editar?: boolean } | null): boolean => registro?.pode_editar === false;

/** Aviso no rodapé da gaveta no lugar do botão Salvar, quando o registro é só para leitura. */
export const avisoSoLeitura = (): Safe =>
  html`<span class="aviso-leitura" role="note">Somente leitura: só o responsável, o líder dele ou um administrador altera este registro.</span>`;

/**
 * Campo de dono (responsável). Admin e líderes escolhem entre as pessoas que podem atribuir; os demais veem
 * o dono atual sem poder trocá-lo — em registro novo, são eles mesmos. O servidor confere a mesma regra.
 */
export function seletorDono(rotulo: string, valor: string | null | undefined, novo: boolean, nome = "responsavel_id"): Safe {
  const atual = novo ? (valor ?? eu.id) : (valor ?? "");
  if (!defineDono()) {
    const texto = atual ? `${nomeMembro(atual) || "Outra pessoa"}${atual === eu.id ? " (você)" : ""}` : "Sem responsável";
    return campo(
      rotulo,
      html`<input type="hidden" name="${nome}" value="${atual}"><div class="campo-fixo" title="Só o líder da equipe ou um administrador troca o responsável.">${texto}</div>`,
    );
  }
  const ops: Opcao[] = [["", "Sem responsável"], ...dados.atribuiveis.map((p) => [p.id, p.nome + (p.id === eu.id ? " (você)" : "")] as const)];
  if (atual && !ops.some(([v]) => v === atual)) ops.push([atual, nomeMembro(atual) || "Pessoa fora da sua equipe"]);
  return campo(rotulo, sel(nome, ops, atual));
}

export const opcoesClientes = (vazio = "Selecione…"): Opcao[] => [
  ["", vazio],
  ...[...dados.referenciasClientes].sort((a, b) => compararTexto(a.nome, b.nome)).map((c) => [c.id, c.nome] as const),
];

/** Combobox de clientes (lista pesquisável), com "+ Novo cliente…" para quem pode cadastrar (cadastro rápido). */
export function comboboxClientes(valor?: string | null, vazio = "Selecione…"): Safe {
  const opcoes = [...dados.referenciasClientes].sort((a, b) => compararTexto(a.nome, b.nome)).map((c) => ({ id: c.id, rotulo: c.nome }));
  return combobox({ nome: "cliente_id", rotulo: "Cliente", opcoes, valor, vazio, cadastroRapido: { tipo: "cliente" } });
}

/** Campo "Cliente" dos formulários do comercial (negócio, orçamento, projeto, faturamento). */
export function seletorCliente(valor?: string | null): Safe {
  return campo("Cliente", comboboxClientes(valor));
}

/** Hoje, para valores padrão de datas. */
export const dataHoje = hoje;
