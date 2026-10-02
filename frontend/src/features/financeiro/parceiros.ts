import { $ } from "@/core/dom";
import { html, raw, type Safe } from "@/core/html";
import { registrarVista } from "@/state/nucleo";
import { ui } from "@/state/estado";
import { registrarAcao } from "@/ui/acoes";
import { campo, fv, inp, sel } from "@/ui/campos";
import { tentar } from "@/ui/erros";
import { abrirGaveta } from "@/ui/gaveta";
import { espaco } from "@/ui/formularios";
import { gravar } from "@/ui/gravacao";
import { avisar } from "@/ui/toast";
import { apiFinanceiro, type Municipio, type Parceiro, type ParceiroEntrada } from "./api";
import { acoesDaLinha, confirmarExclusao, formatarCep, formatarDocumento, GRUPO } from "./comum";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

const tela: { parceiros: Parceiro[] | null } = { parceiros: null };

async function carregar(): Promise<void> {
  tela.parceiros = await apiFinanceiro.parceiros.listar();
}

function vista(): Safe {
  if (!tela.parceiros) return html`<div class="head"><div><h1>Parceiros de negócio</h1></div></div><p class="sub">Carregando…</p>`;
  const q = ui.buscaFin.toLowerCase();
  const digitos = q.replace(/\D/g, "");
  const lista = tela.parceiros.filter((p) => !q || p.nome.toLowerCase().includes(q) || (digitos && p.cpf_cnpj.includes(digitos)));
  return html`<div class="head"><div><h1>Parceiros de negócio</h1><p>Clientes, fornecedores e demais pessoas e empresas com quem a iSolutis negocia.</p></div>
    <div class="tools"><input class="search" data-busca="buscaFin" type="search" placeholder="Buscar por nome ou CPF/CNPJ" value="${ui.buscaFin}"><button class="btn primary" data-act="novoParceiro">Novo parceiro</button></div></div>
  ${
    tela.parceiros.length
      ? html`<div class="tbl-wrap"><table><thead><tr><th>Nome</th><th>Documento</th><th>Município</th><th>Endereço</th><th></th></tr></thead><tbody>
      ${lista.map((p) => html`<tr><td><b>${p.nome}</b><div class="sub">${p.tipo_pessoa === "PJ" ? "Pessoa jurídica" : "Pessoa física"}</div></td><td class="num">${formatarDocumento(p.cpf_cnpj)}</td><td>${p.municipio_nome}/${p.uf}</td><td>${p.endereco ?? "—"}${p.cep ? html`<div class="sub num">${formatarCep(p.cep)}</div>` : ""}</td><td class="r">${acoesDaLinha("parceiro", p.id)}</td></tr>`)}
      ${!lista.length ? html`<tr><td colspan="5" class="sub">Nenhum parceiro encontrado para “${ui.buscaFin}”.</td></tr>` : ""}
    </tbody></table></div>`
      : html`<div class="empty"><b>Nenhum parceiro cadastrado</b>Cadastre quem paga e quem recebe da empresa para lançar títulos financeiros.<br><button class="btn primary" data-act="novoParceiro">Cadastrar o primeiro parceiro</button></div>`
  }`;
}

registrarVista({ id: "fin-parceiros", nome: "Parceiro de Negócio", grupo: GRUPO, somenteAdmin: true, carregar, depende: ["financeiro"], desenhar: vista });

function formParceiro(p?: Parceiro): void {
  const opcoesUf = (uf: string): Safe => html`<select name="uf" id="f-uf"><option value="">UF</option>${UFS.map((u) => html`<option value="${u}"${raw(u === uf ? " selected" : "")}>${u}</option>`)}</select>`;
  abrirGaveta({
    titulo: p ? p.nome : "Novo parceiro",
    corpo: html`<div class="fields">
      ${campo("Tipo de pessoa", sel("tipo_pessoa", [["PJ", "Pessoa jurídica (CNPJ)"], ["PF", "Pessoa física (CPF)"]], p?.tipo_pessoa ?? "PJ"))}
      ${campo("CPF / CNPJ", inp("cpf_cnpj", p ? formatarDocumento(p.cpf_cnpj) : "", 'inputmode="numeric" maxlength="18"'))}
      ${campo("Nome / Razão social", inp("nome", p?.nome, 'maxlength="150"'), true)}
      ${campo("Endereço", inp("endereco", p?.endereco, 'maxlength="150" placeholder="Rua, número, bairro"'), true)}
      ${campo("CEP", inp("cep", formatarCep(p?.cep), 'inputmode="numeric" maxlength="9" placeholder="00000-000"'))}
      <div class="field"><label for="f-uf">UF</label>${opcoesUf(p?.uf ?? "")}</div>
      ${campo("Município", html`<select name="municipio_id" id="f-municipio_id"><option value="">Escolha a UF primeiro</option></select>`, true)}
    </div>`,
    rodape: html`<button class="btn primary" data-salvar>Salvar</button>${espaco}`,
    montar: (f, fechar, L) => {
      const uf = f.elements.namedItem("uf") as HTMLSelectElement;
      const municipio = f.elements.namedItem("municipio_id") as HTMLSelectElement;
      const carregarMunicipios = async (selecionado?: string): Promise<void> => {
        municipio.innerHTML = '<option value="">Carregando…</option>';
        const lista: Municipio[] | null = uf.value ? await tentar(() => apiFinanceiro.municipios(uf.value)) : [];
        municipio.innerHTML = String(
          html`<option value="">${uf.value ? "Selecione o município" : "Escolha a UF primeiro"}</option>${(lista ?? []).map((m) => html`<option value="${m.id}"${raw(m.id === selecionado ? " selected" : "")}>${m.nome}</option>`)}`,
        );
      };
      uf.addEventListener("change", () => void carregarMunicipios());
      if (p) void carregarMunicipios(p.municipio_id);

      $("[data-salvar]", L)?.addEventListener("click", async () => {
        if (!fv(f, "cpf_cnpj")) return void avisar("Informe o CPF ou CNPJ.");
        if (!fv(f, "nome")) return void avisar("Informe o nome do parceiro.");
        if (!fv(f, "municipio_id")) return void avisar("Escolha o município.");
        const corpo: ParceiroEntrada = {
          tipo_pessoa: fv(f, "tipo_pessoa") as "PJ" | "PF", cpf_cnpj: fv(f, "cpf_cnpj"), nome: fv(f, "nome"),
          endereco: fv(f, "endereco") || null, cep: fv(f, "cep") || null, municipio_id: fv(f, "municipio_id"),
        };
        await gravar({
          recarregar: ["financeiro"], mensagem: "Parceiro salvo", fechar,
          operacao: () => (p ? apiFinanceiro.parceiros.atualizar(p.id, corpo) : apiFinanceiro.parceiros.criar(corpo)),
        });
      });
    },
  });
}

const porId = (id?: string): Parceiro | undefined => tela.parceiros?.find((p) => p.id === id);

registrarAcao("novoParceiro", () => formParceiro());
registrarAcao("parceiroEditar", (alvo) => {
  const p = porId(alvo.dataset.id);
  if (p) formParceiro(p);
});
registrarAcao("parceiroExcluir", (alvo) => {
  const p = porId(alvo.dataset.id);
  if (p) confirmarExclusao({ titulo: "Excluir parceiro", mensagem: `Excluir o parceiro “${p.nome}”? Parceiros com títulos lançados não podem ser excluídos.`, sucesso: "Parceiro excluído", operacao: () => apiFinanceiro.parceiros.excluir(p.id) });
});

