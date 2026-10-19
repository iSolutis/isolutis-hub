// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { formatarDocumento, ligarMascaraDeDocumento, mascararDocumento, reaplicarMascara, tipoDoDocumento, valorInicialDoDocumento, type TipoDocumento } from "./documento";

describe("mascararDocumento", () => {
  it("CNPJ e CPF completos", () => {
    expect(mascararDocumento("11222333000181", "CNPJ")).toBe("11.222.333/0001-81");
    expect(mascararDocumento("52998224725", "CPF")).toBe("529.982.247-25");
  });

  it("máscara parcial sem separadores sobrando", () => {
    expect(mascararDocumento("112223", "CNPJ")).toBe("11.222.3");
    expect(mascararDocumento("5299", "CPF")).toBe("529.9");
    expect(mascararDocumento("", "CPF")).toBe("");
  });

  it("descarta dígitos além do limite do tipo", () => {
    expect(mascararDocumento("529.982.247-25999", "CPF")).toBe("529.982.247-25");
    expect(mascararDocumento("112223330001819", "CNPJ")).toBe("11.222.333/0001-81");
  });

  it("aceita valor colado formatado ou com espaços", () => {
    expect(mascararDocumento("11.222.333/0001-81", "CNPJ")).toBe("11.222.333/0001-81");
    expect(mascararDocumento("11 222 333 0001 81", "CNPJ")).toBe("11.222.333/0001-81");
  });

  it("remascara ao trocar o tipo", () => {
    expect(mascararDocumento("11.222.333/0001-81", "CPF")).toBe("112.223.330-00");
    expect(mascararDocumento("529.982.247-25", "CNPJ")).toBe("52.998.224/725");
  });
});

describe("tipoDoDocumento", () => {
  it("converte tipo de pessoa e de inscrição", () => {
    expect(tipoDoDocumento("PF")).toBe("CPF");
    expect(tipoDoDocumento("CPF")).toBe("CPF");
    expect(tipoDoDocumento("PJ")).toBe("CNPJ");
    expect(tipoDoDocumento("CNPJ")).toBe("CNPJ");
    expect(tipoDoDocumento(undefined)).toBe("CNPJ");
  });
});

describe("formatarDocumento", () => {
  it("formata por quantidade de dígitos", () => {
    expect(formatarDocumento("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarDocumento("52998224725")).toBe("529.982.247-25");
    expect(formatarDocumento("123")).toBe("123");
    expect(formatarDocumento(null)).toBe("—");
    expect(formatarDocumento("")).toBe("—");
  });
});

describe("valorInicialDoDocumento", () => {
  it("mascara pelo tipo gravado", () => {
    expect(valorInicialDoDocumento("52998224725", "CPF")).toBe("529.982.247-25");
    expect(valorInicialDoDocumento("11222333000181", "CNPJ")).toBe("11.222.333/0001-81");
    expect(valorInicialDoDocumento(null, "CNPJ")).toBe("");
  });

  it("não corta dígitos de um documento legado maior que o tipo", () => {
    expect(valorInicialDoDocumento("11222333000181", "CPF")).toBe("11.222.333/0001-81");
  });
});

function campoFocado(valor: string, cursor: number): HTMLInputElement {
  const campo = document.createElement("input");
  document.body.append(campo);
  campo.value = valor;
  campo.focus();
  campo.setSelectionRange(cursor, cursor);
  return campo;
}

describe("reaplicarMascara", () => {
  it("mantém o cursor após o dígito editado no meio do número", () => {
    // "529.982.247-25" com um "1" inserido depois de "529." → cursor logo após o "1"
    const campo = campoFocado("529.1982.247-25", 5);
    reaplicarMascara(campo, (v) => mascararDocumento(v, "CPF"));
    expect(campo.value).toBe("529.198.224-72");
    expect(campo.selectionStart).toBe(5);
  });

  it("ao apagar um dígito no meio, o cursor fica logo após o dígito anterior", () => {
    // apagou o "9" de "982": "529.82.247-25", cursor depois de "529."
    const campo = campoFocado("529.82.247-25", 4);
    reaplicarMascara(campo, (v) => mascararDocumento(v, "CPF"));
    expect(campo.value).toBe("529.822.472-5");
    expect(campo.selectionStart).toBe(3);
  });
});

describe("ligarMascaraDeDocumento", () => {
  it("mascara ao digitar e segue o tipo selecionado", () => {
    let tipo: TipoDocumento = "CNPJ";
    const campo = campoFocado("", 0);
    const mascara = ligarMascaraDeDocumento(campo, () => tipo);
    expect(campo.placeholder).toBe("00.000.000/0000-00");

    campo.value = "11222333000181";
    campo.dispatchEvent(new Event("input"));
    expect(campo.value).toBe("11.222.333/0001-81");

    tipo = "CPF";
    mascara.atualizarTipo();
    expect(campo.placeholder).toBe("000.000.000-00");
    expect(campo.value).toBe("112.223.330-00");
  });
});
