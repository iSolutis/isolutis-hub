/**
 * CPF/CNPJ: máscara enquanto se digita (dirigida pelo tipo selecionado) e formatação de exibição.
 * A máscara é só apresentação — o servidor guarda apenas dígitos e valida os dígitos verificadores.
 */

import { reaplicarMascara } from "./mascara";

export { reaplicarMascara } from "./mascara";

export type TipoDocumento = "CPF" | "CNPJ";

const LIMITE: Record<TipoDocumento, number> = { CPF: 11, CNPJ: 14 };

export const PLACEHOLDER_DOCUMENTO: Record<TipoDocumento, string> = { CPF: "000.000.000-00", CNPJ: "00.000.000/0000-00" };

/** Comprimento do CNPJ formatado; o limite por tipo é imposto pela máscara (um `maxlength` menor cortaria colagens com espaços). */
export const MAXLENGTH_DOCUMENTO = 18;

/** Converte o tipo de pessoa (`PF`/`PJ`) ou de inscrição (`CPF`/`CNPJ`) no tipo de documento. */
export const tipoDoDocumento = (tipo: string | null | undefined): TipoDocumento => (tipo === "PF" || tipo === "CPF" ? "CPF" : "CNPJ");

/** Máscara parcial de CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00); descarta não dígitos e o excedente do tipo. */
export function mascararDocumento(valor: string, tipo: TipoDocumento): string {
  const d = valor.replace(/\D/g, "").slice(0, LIMITE[tipo]);
  if (tipo === "CPF") return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** 11.222.333/0001-81 · 529.982.247-25 (documentos guardados só com dígitos); outro tamanho volta como veio. */
export function formatarDocumento(doc: string | null | undefined): string {
  if (!doc) return "—";
  if (doc.length === 14) return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (doc.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc;
}

/**
 * Valor do campo ao abrir um cadastro salvo: mascarado pelo tipo gravado. Se o documento tem mais dígitos
 * que o tipo admite (dado legado), mostra-o inteiro, sem cortar — o servidor recusará ao salvar.
 */
export function valorInicialDoDocumento(doc: string | null | undefined, tipo: TipoDocumento): string {
  const d = (doc ?? "").replace(/\D/g, "");
  if (!d) return "";
  return d.length > LIMITE[tipo] ? formatarDocumento(d) : mascararDocumento(d, tipo);
}

/**
 * Liga a máscara a um campo de documento cujo tipo vem de outra escolha do formulário (ex.: tipo de pessoa).
 * Chame `atualizarTipo()` quando essa escolha mudar: ajusta o exemplo e remascara o que já foi digitado.
 */
export function ligarMascaraDeDocumento(campo: HTMLInputElement, tipo: () => TipoDocumento): { atualizarTipo(): void } {
  campo.maxLength = MAXLENGTH_DOCUMENTO;
  campo.placeholder = PLACEHOLDER_DOCUMENTO[tipo()];
  campo.addEventListener("input", () => reaplicarMascara(campo, (v) => mascararDocumento(v, tipo())));
  return {
    atualizarTipo() {
      campo.placeholder = PLACEHOLDER_DOCUMENTO[tipo()];
      campo.value = mascararDocumento(campo.value, tipo());
    },
  };
}
