/**
 * Cadastros por papel: Fornecedores, Funcionários e Sócios são a mesma tela de parceiros (o cadastro único com
 * papéis) filtrada por um papel. Cada uma tem URL, permissão e ação "Novo ..." próprias; o formulário abre com o
 * papel da tela marcado e deixa marcar outros, porque um parceiro pode ter vários. "Mostrar todos os parceiros"
 * lista quem tem outros papéis, o que permite acrescentar um papel a um cadastro existente (ex.: um cliente que
 * também é sócio). Clientes continuam na tela própria (`features/clientes.ts`), com negócios e faturamento.
 */
import { $ } from "@/core/dom";
import { html, type Safe } from "@/core/html";
import { formatarPercentual } from "@/core/formato";
import type { Permissao } from "@/api/tipos";
import { podeEscrever, ui } from "@/state/estado";
import { registrarVista, render } from "@/state/nucleo";
import { registrarAcao } from "@/ui/acoes";
import { barraDeFerramentas, cabecalhoDePagina, carregando, chip, estadoVazio } from "@/ui/componentes";
import { abrirGaveta } from "@/ui/gaveta";
import { espaco } from "@/ui/formularios";
import { gravar } from "@/ui/gravacao";
import { botaoNovo } from "../comum";
import { apiFinanceiro, type Papel, type Parceiro } from "../financeiro/api";
import { acoesDaLinha, confirmarExclusao, formatarCep, formatarDocumento } from "../financeiro/comum";
import { camposDoParceiro, ligarCamposDoParceiro, lerCamposDoParceiro, PAPEL_SOCIO } from "./campos";

export const GRUPO_CADASTROS = "Cadastros";

interface Config {
  /** Id da vista (e da URL). */
  id: string;
  nome: string;
  /** Código do papel de parceiro que a tela lista. */
  papel: string;
  permissao: Permissao;
  descricao: string;
  /** Ação registrada do botão "Novo ..." (também usada pelo "+ Novo" e pela paleta). */
  acaoNovo: string;
  rotuloNovo: string;
  vazio: string;
  icone: string;
}

interface Estado {
  parceiros: Parceiro[] | null;
  papeis: Papel[];
  todos: boolean;
}

function registrarTela(c: Config): void {
  const tela: Estado = { parceiros: null, papeis: [], todos: false };
  const nomeDoPapel = (codigo: string): string => tela.papeis.find((p) => p.codigo === codigo)?.nome ?? codigo;

  async function carregar(): Promise<void> {
    const [parceiros, papeis] = await Promise.all([apiFinanceiro.parceiros.listar(), apiFinanceiro.parceiros.papeis()]);
    tela.parceiros = parceiros;
    tela.papeis = papeis;
  }

  const doPapel = (): Parceiro[] => (tela.parceiros ?? []).filter((p) => p.papeis.includes(c.papel));

  /** Soma das participações (só faz sentido na tela de sócios). */
  const distribuido = (): number => doPapel().reduce((soma, p) => soma + (p.participacao_percentual ?? 0), 0);

  function vista(): Safe {
    if (!tela.parceiros) return html`${cabecalhoDePagina({ titulo: c.nome, descricao: c.descricao })}${carregando()}`;
    const base = tela.todos ? tela.parceiros : doPapel();
    const q = ui.buscaFin.toLowerCase();
    const digitos = q.replace(/\D/g, "");
    const lista = base.filter((p) => !q || p.nome.toLowerCase().includes(q) || (digitos !== "" && (p.cpf_cnpj ?? "").includes(digitos)));
    const ehSocio = c.papel === PAPEL_SOCIO;
    const cabecalho = cabecalhoDePagina({ titulo: c.nome, descricao: c.descricao, acoes: botaoNovo(c.acaoNovo, c.rotuloNovo) });
    if (!doPapel().length && !tela.todos) {
      return html`${cabecalho}${estadoVazio({
        icone: c.icone,
        titulo: `Nenhum cadastro em ${c.nome.toLowerCase()}`,
        texto: c.vazio,
        acao: podeEscrever() ? html`<button class="btn primary" data-act="${c.acaoNovo}">${c.rotuloNovo}</button>` : undefined,
      })}<p class="sub"><button class="btn" data-act="${c.id}Todos">Mostrar todos os parceiros</button></p>`;
    }
    const aviso =
      ehSocio && distribuido() < 100
        ? html`<div class="banner" role="status">Participação distribuída: <b class="num">${formatarPercentual(distribuido())}</b>. Faltam <b class="num">${formatarPercentual(100 - distribuido())}</b> para os 100%.</div>`
        : "";
    const filtros = chip({ rotulo: "Mostrar todos os parceiros", acao: `${c.id}Todos`, pressionado: tela.todos });
    return html`${cabecalho}${aviso}
      ${barraDeFerramentas({ busca: { chave: "buscaFin", valor: ui.buscaFin, placeholder: "Buscar por nome ou CPF/CNPJ", rotulo: `Buscar em ${c.nome.toLowerCase()}` }, filtros, contagem: `${lista.length} ${lista.length === 1 ? "parceiro" : "parceiros"}` })}
      <div class="tbl-wrap"><table><thead><tr><th>Nome</th><th>Papéis</th>${ehSocio ? html`<th class="r">Participação</th>` : ""}<th>Documento</th><th>Município</th><th>Endereço</th><th></th></tr></thead><tbody>
      ${lista.map(
        (p) => html`<tr><td><b>${p.nome}</b><div class="sub">${p.tipo_pessoa === "PJ" ? "Pessoa jurídica" : "Pessoa física"}</div></td><td>${p.papeis.map((codigo) => html`<span class="pill">${nomeDoPapel(codigo)}</span> `)}</td>${ehSocio ? html`<td class="r num">${p.participacao_percentual != null ? formatarPercentual(p.participacao_percentual) : "—"}</td>` : ""}<td class="num">${formatarDocumento(p.cpf_cnpj)}</td><td>${p.municipio_nome ? `${p.municipio_nome}/${p.uf}` : "—"}</td><td>${p.endereco ?? "—"}${p.cep ? html`<div class="sub num">${formatarCep(p.cep)}</div>` : ""}</td><td class="r">${acoesDaLinha(c.id, p.id)}</td></tr>`,
      )}
      ${!lista.length ? html`<tr><td colspan="${ehSocio ? 7 : 6}" class="sub">Nenhum parceiro encontrado.</td></tr>` : ""}
      </tbody></table></div>`;
  }

  registrarVista({ id: c.id, nome: c.nome, grupo: GRUPO_CADASTROS, permissao: c.permissao, carregar, depende: ["financeiro", "clientes"], desenhar: vista });

  function formulario(p?: Parceiro): void {
    const valores = p ?? { papeis: [c.papel] };
    abrirGaveta({
      titulo: p ? p.nome : c.rotuloNovo,
      corpo: camposDoParceiro(valores, tela.papeis),
      rodape: html`<button class="btn primary" data-salvar>Salvar</button>${espaco}`,
      montar: (f, fechar, L) => {
        ligarCamposDoParceiro(f, valores);
        $("[data-salvar]", L)?.addEventListener("click", async () => {
          const corpo = lerCamposDoParceiro(f);
          if (!corpo) return;
          await gravar({
            recarregar: ["financeiro", "clientes"],
            mensagem: "Parceiro salvo",
            fechar,
            operacao: () => (p ? apiFinanceiro.parceiros.atualizar(p.id, { ...corpo, versao: p.versao }) : apiFinanceiro.parceiros.criar(corpo)),
          });
        });
      },
    });
  }

  const porId = (id?: string): Parceiro | undefined => tela.parceiros?.find((p) => p.id === id);

  registrarAcao(`${c.id}Todos`, () => {
    tela.todos = !tela.todos;
    render();
  });
  registrarAcao(c.acaoNovo, () => formulario());
  registrarAcao(`${c.id}Editar`, (alvo) => {
    const p = porId(alvo.dataset.id);
    if (p) formulario(p);
  });
  registrarAcao(`${c.id}Excluir`, (alvo) => {
    const p = porId(alvo.dataset.id);
    if (!p) return;
    confirmarExclusao({
      titulo: "Excluir parceiro",
      mensagem: `Excluir o parceiro “${p.nome}”? Parceiros com títulos lançados não podem ser excluídos.`,
      sucesso: "Parceiro excluído",
      operacao: () => apiFinanceiro.parceiros.excluir(p.id),
    });
  });
}

// Fornecedores seguem a permissão `financeiro`; funcionários e sócios são dados sensíveis e ficam com a `administracao`.
registrarTela({
  id: "fornecedores", nome: "Fornecedores", papel: "fornecedor", permissao: "financeiro", icone: "fornecedores",
  descricao: "Quem presta serviços ou vende para a empresa e recebe pagamentos",
  acaoNovo: "novoFornecedor", rotuloNovo: "Novo fornecedor",
  vazio: "Cadastre quem a empresa paga para lançar títulos a pagar.",
}); // fmt: skip
registrarTela({
  id: "funcionarios", nome: "Funcionários", papel: "funcionario", permissao: "administracao", icone: "funcionarios",
  descricao: "Pessoas que trabalham na empresa (cadastro, sem acesso ao sistema)",
  acaoNovo: "novoFuncionario", rotuloNovo: "Novo funcionário",
  vazio: "Cadastre a equipe para lançar pagamentos como salários. O acesso ao sistema é gerenciado em Equipe.",
}); // fmt: skip
registrarTela({
  id: "socios", nome: "Sócios", papel: PAPEL_SOCIO, permissao: "administracao", icone: "socios",
  descricao: "Quem tem participação na empresa; os aportes entram como títulos a receber",
  acaoNovo: "novoSocio", rotuloNovo: "Novo sócio",
  vazio: "Cadastre os sócios com a participação de cada um na empresa.",
}); // fmt: skip
