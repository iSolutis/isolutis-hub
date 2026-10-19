import { idempotencia } from "@/api/http";
import { recarregar } from "@/state/nucleo";
import { gavetaAberta } from "./gaveta";
import { tentar } from "./erros";
import { toast } from "./toast";

interface OpcoesGravar<T> {
  /** Recursos a recarregar depois de gravar (ex.: ["clientes"]). */
  recarregar: string[];
  mensagem: string;
  operacao: () => Promise<T>;
  /** Fecha a gaveta ao terminar (omita para manter aberta). */
  fechar?: () => void;
}

/**
 * Só uma gravação por vez: um segundo clique, Enter ou toque enquanto a primeira não termina é ignorado.
 * `manual`: a tela envolveu o clique em `comTrava`; `auto`: `gravar` travou sozinho o botão Salvar da tela.
 */
let emAndamento: "manual" | "auto" | null = null;
const chaves = new WeakMap<Element, string>();

const novaChave = (): string => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

/**
 * Envolve o clique em Salvar: trava o botão com "Salvando…", ignora cliques repetidos e **sempre** devolve o botão ao
 * normal ao terminar (inclusive quando a gravação falha e o erro já foi mostrado). Os `POST` feitos dentro de `fn`
 * levam chave de idempotência; a chave só muda depois de sucesso, então tentar de novo após um erro de rede não
 * duplica o que a primeira tentativa já tenha gravado.
 * Devolve `undefined` quando ignorou o clique ou `fn` lançou.
 */
export function comTrava<T>(botao: HTMLButtonElement, fn: () => Promise<T>, texto = "Salvando…"): Promise<T | undefined> {
  return travar(botao, fn, texto, "manual");
}

async function travar<T>(botao: HTMLButtonElement, fn: () => Promise<T>, texto: string, origem: "manual" | "auto"): Promise<T | undefined> {
  if (emAndamento) return undefined;
  emAndamento = origem;
  const original = botao.innerHTML;
  const estavaDesabilitado = botao.disabled;
  botao.disabled = true;
  botao.classList.add("loading");
  botao.innerHTML = `<span class="spinner"></span> ${texto}`;
  const chave = chaves.get(botao) ?? novaChave();
  chaves.set(botao, chave);
  idempotencia.iniciar(chave);
  let sucesso = false;
  try {
    const r = await fn();
    // `null`/`false` = a operação avisou o erro por conta própria (ver `tentar`): mantém a chave para o reenvio
    sucesso = r !== null && r !== false;
    return r;
  } catch (e) {
    console.error(e);
    return undefined;
  } finally {
    idempotencia.encerrar();
    if (sucesso) chaves.delete(botao);
    botao.disabled = estavaDesabilitado;
    botao.classList.remove("loading");
    botao.innerHTML = original;
    emAndamento = null;
  }
}

async function nucleo<T>(o: OpcoesGravar<T>): Promise<T | null> {
  const resultado = await tentar(o.operacao);
  if (resultado === null) return null;
  const versao = (resultado as { versao?: number }).versao;
  if (gavetaAberta && versao) gavetaAberta.minhaVersao = versao;
  if (o.mensagem) toast(o.mensagem);
  o.fechar?.();
  void recarregar(...o.recarregar).catch(() => toast("Salvo. Atualize a tela para ver as listas em dia."));
  return resultado;
}

/**
 * Fluxo padrão de gravação: executa, avisa erro, fecha e confirma assim que o servidor responde e recarrega as
 * listas em seguida (sem fazer o usuário esperar por elas). Devolve o resultado ou null.
 * Chamada de dentro de `comTrava`, só executa; chamada solta, trava sozinha o botão Salvar da tela e ignora repetições.
 */
export async function gravar<T>(o: OpcoesGravar<T>): Promise<T | null> {
  if (emAndamento === "manual") return nucleo(o);
  if (emAndamento === "auto") return null;
  const botao = document.querySelector<HTMLButtonElement>("[data-salvar]:not(:disabled)");
  if (!botao) {
    emAndamento = "auto";
    try {
      return await nucleo(o);
    } finally {
      emAndamento = null;
    }
  }
  return (await travar(botao, () => nucleo(o), "Salvando…", "auto")) ?? null;
}

export async function excluir(o: { recarregar: string[]; mensagem: string; operacao: () => Promise<void>; fechar: () => void }): Promise<boolean> {
  if (gavetaAberta) gavetaAberta.excluidoPorMim = true;
  const ok = (await tentar(async () => (await o.operacao(), true))) !== null;
  if (!ok) {
    if (gavetaAberta) gavetaAberta.excluidoPorMim = false;
    return false;
  }
  await recarregar(...o.recarregar);
  toast(o.mensagem);
  o.fechar();
  return true;
}
