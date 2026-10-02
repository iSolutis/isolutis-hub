import { api } from "@/api/endpoints";
import type { Cliente } from "@/api/tipos";
import { $ } from "@/core/dom";
import { brl, compararTexto, pluralizar } from "@/core/formato";
import { esc, html, type Safe } from "@/core/html";
import { ORC_STATUS, ORIGENS, etapaNome } from "@/domain/constantes";
import { botaoWa, numeroWa } from "@/domain/whatsapp";
import { dados, podeEscrever, ui } from "@/state/estado";
import { registrarVista } from "@/state/nucleo";
import { registrarAcao } from "@/ui/acoes";
import { area, campo, fv, inp, sel } from "@/ui/campos";
import { registrarConsulta } from "@/ui/conflito";
import { registrarAbertura } from "@/ui/eventos";
import { abrirGaveta } from "@/ui/gaveta";
import { linhaAutoria } from "@/ui/autoria";
import { botaoExcluir, botaoSalvar, espaco } from "@/ui/formularios";
import { excluir, gravar } from "@/ui/gravacao";
import { toast } from "@/ui/toast";
import { botaoNovo } from "./comum";
import { formNegocio, valorNegocio } from "./negocios";

registrarConsulta("clientes", (id) => dados.clientes.find((c) => c.id === id));

function vista(): Safe {
  const q = ui.busca.toLowerCase();
  const lista = dados.clientes
    .filter((c) => !q || [c.nome, c.contato, c.cidade, c.segmento, c.email].join(" ").toLowerCase().includes(q))
    .sort((a, b) => compararTexto(a.nome, b.nome));
  const n = dados.clientes.length;
  return html`<div class="head"><div><h1>Clientes</h1><p>${n} ${pluralizar(n, "empresa cadastrada", "empresas cadastradas")}</p></div>
    <div class="tools"><input class="search" id="busca" data-busca="busca" type="search" placeholder="Buscar por nome, contato ou cidade" value="${ui.busca}">${botaoNovo("novoCliente", "Novo cliente")}</div></div>
  ${
    !n
      ? html`<div class="empty"><b>Nenhum cliente ainda</b>Cadastre as empresas com quem a iSolutis conversa: quem pediu diagnóstico, quem já é cliente de manutenção, quem veio por indicação.${podeEscrever() ? html`<br><button class="btn primary" data-act="novoCliente">Cadastrar o primeiro cliente</button>` : ""}</div>`
      : html`<div class="tbl-wrap"><table><thead><tr><th>Empresa</th><th>Contato</th><th>Cidade</th><th>Origem</th><th class="r">Negócios abertos</th><th class="r">Faturado</th></tr></thead><tbody>
    ${lista.map(
      (c) => html`<tr tabindex="0" data-open="cliente:${c.id}"><td><b>${c.nome}</b>${c.segmento ? html`<div class="sub">${c.segmento}</div>` : ""}</td>
        <td>${c.contato || "—"}${c.telefone ? html`<div class="sub num">${c.telefone}</div>` : ""}${numeroWa(c.telefone) ? html`<div>${botaoWa(c, "Conversar", undefined, "mini")}</div>` : ""}</td>
        <td>${c.cidade || "—"}</td><td>${c.origem || "—"}</td><td class="r num">${c.negocios_abertos}</td><td class="r num">${brl(c.faturado)}</td></tr>`,
    )}
    ${!lista.length ? html`<tr><td colspan="6" class="sub">Nenhum cliente encontrado para “${ui.busca}”.</td></tr>` : ""}
  </tbody></table></div>`
  }`;
}

registrarVista({
  id: "clientes",
  nome: "Clientes",
  contagem: () => dados.clientes.length,
  desenhar: vista,
});

const CAMPOS_TEXTO = ["cnpj", "segmento", "contato", "cargo", "telefone", "email", "cidade", "origem", "obs"] as const;

export function formCliente(c?: Cliente): void {
  const novo = !c;
  abrirGaveta({
    titulo: c ? c.nome : "Novo cliente",
    registro: c ? { recurso: "clientes", id: c.id, versao: c.versao } : null,
    autoria: linhaAutoria(c),
    corpo: html`<div class="fields">
      ${campo("Empresa", inp("nome", c?.nome, "required"), true)}
      ${campo("CNPJ", inp("cnpj", c?.cnpj, 'inputmode="numeric"'))}${campo("Segmento", inp("segmento", c?.segmento, 'placeholder="Ex.: distribuição, saúde, indústria"'))}
      ${campo("Contato principal", inp("contato", c?.contato))}${campo("Cargo", inp("cargo", c?.cargo))}
      ${campo("Telefone / WhatsApp", inp("telefone", c?.telefone, 'inputmode="tel"'))}${campo("E-mail", inp("email", c?.email, 'type="email"'))}
      ${campo("Cidade / UF", inp("cidade", c?.cidade))}${campo("Origem", sel("origem", [["", "—"], ...ORIGENS.map((o) => [o, o] as const)], c?.origem))}
      ${campo("Observações", area("obs", c?.obs), true)}</div>
      ${c ? html`<div class="related" id="relacionados">${relacionados(c)}</div>` : ""}`,
    rodape: html`${botaoSalvar()}${c ? botaoWa(c, "Conversar no WhatsApp") : ""}${c && podeEscrever() ? html`<button class="btn" data-novo-negocio>Novo negócio</button>` : ""}${espaco}${botaoExcluir(!!c)}`,
    montar: (f, fechar, L) => {
      if (c) void preencherFaturamento(c.id);
      $("[data-salvar]", L)?.addEventListener("click", async () => {
        const nome = fv(f, "nome");
        if (!nome) return void toast("Informe o nome da empresa.");
        const corpo = { nome, ...Object.fromEntries(CAMPOS_TEXTO.map((k) => [k, fv(f, k) || null])) } as Parameters<typeof api.clientes.criar>[0];
        await gravar({
          recarregar: ["clientes"],
          mensagem: "Cliente salvo",
          fechar,
          operacao: () => (novo ? api.clientes.criar(corpo) : api.clientes.atualizar(c.id, { ...corpo, versao: c.versao })),
        });
      });
      $("[data-excluir]", L)?.addEventListener("click", () => {
        if (c) void excluir({ recarregar: ["clientes"], mensagem: "Cliente excluído", fechar, operacao: () => api.clientes.excluir(c.id) });
      });
      $("[data-novo-negocio]", L)?.addEventListener("click", () => {
        if (c) formNegocio({ cliente_id: c.id, etapa: "lead" });
      });
    },
  });
}

/** Negócios e orçamentos do cliente (já em memória); o faturamento chega do servidor logo em seguida. */
function relacionados(c: Cliente): Safe {
  const ns = dados.negocios.filter((n) => n.cliente_id === c.id);
  const os = dados.orcamentos.filter((o) => o.cliente_id === c.id);
  return html`<h3>Negócios (${ns.length})</h3>${ns.length ? ns.map((n) => html`<div class="li" data-open="negocio:${n.id}"><span class="t">${n.titulo}</span><span class="sub">${etapaNome(n.etapa)} · ${valorNegocio(n)}</span></div>`) : html`<p class="sub">Nenhum.</p>`}
    <h3>Orçamentos (${os.length})</h3>${os.length ? os.map((o) => html`<div class="li" data-open="orcamento:${o.id}"><span class="t">Nº ${o.numero}</span><span class="sub">${ORC_STATUS[o.status_exibido]?.[0]} · ${brl(o.total_projeto)}</span></div>`) : html`<p class="sub">Nenhum.</p>`}
    <h3>Faturamento</h3><p class="sub" style="margin:0" id="relFat">Carregando…</p>`;
}

async function preencherFaturamento(id: string): Promise<void> {
  try {
    const r = await api.clientes.relacionados(id);
    const el = $("#relFat");
    if (el) el.innerHTML = `${r.lancamentos} ${esc(pluralizar(r.lancamentos, "lançamento", "lançamentos"))} · <b class="num">${esc(brl(r.recebido))}</b> recebido`;
  } catch {
    const el = $("#relFat");
    if (el) el.textContent = "Não foi possível carregar o faturamento.";
  }
}

registrarAcao("novoCliente", () => formCliente());
registrarAbertura("cliente", (id) => {
  const c = dados.clientes.find((x) => x.id === id);
  if (c) formCliente(c);
});


