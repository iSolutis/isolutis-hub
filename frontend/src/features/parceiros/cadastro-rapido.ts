/**
 * Cadastro rápido de parceiro (títulos e recorrências) e de cliente (negócios, orçamentos, projetos, faturamento e
 * tarefas): só nome, tipo de pessoa, documento e, no parceiro, os papéis. O resto se completa no cadastro completo.
 */
import { api } from "@/api/endpoints";
import { podeEscrever, temPermissao } from "@/state/estado";
import { registrarCadastroRapido, type ContextoCadastro } from "@/ui/cadastro-rapido";
import { formatarDocumento } from "@/ui/documento";
import { tentar } from "@/ui/erros";
import { apiFinanceiro, type Papel, type Parceiro } from "../financeiro/api";
import { PAPEIS_QUE_RECEBEM_PAGAMENTO, parceirosParaTitulo } from "../financeiro/comum";
import { camposReduzidosDoParceiro, lerCamposDoParceiro, ligarCamposDoParceiro, PAPEL_SOCIO, type CamposLidos } from "./campos";

/** Papéis que o usuário pode atribuir (dependem do papel dele na empresa); a tela de origem carrega ao abrir. */
let papeisDisponiveis: Papel[] = [];

/** Carrega os papéis atribuíveis; chame junto com as listas de apoio do formulário que oferece o cadastro rápido. */
export async function prepararCadastroDeParceiro(): Promise<void> {
  if (!temPermissao("financeiro") || !podeEscrever()) return void (papeisDisponiveis = []);
  papeisDisponiveis = (await tentar(() => apiFinanceiro.parceiros.papeis())) ?? [];
}

/** Papéis que servem na origem: conta de aporte só aceita sócio; título a pagar, quem recebe pagamento. */
function papeisCompativeis(ctx: ContextoCadastro): Papel[] {
  if (ctx.aporte) return papeisDisponiveis.filter((p) => p.codigo === PAPEL_SOCIO);
  if (ctx.tipoConta === "P") return papeisDisponiveis.filter((p) => (PAPEIS_QUE_RECEBEM_PAGAMENTO as readonly string[]).includes(p.codigo));
  return papeisDisponiveis;
}

/** Papel já marcado ao abrir: sócio no aporte, fornecedor a pagar, cliente a receber (se o usuário puder atribuí-lo). */
function papelSugerido(ctx: ContextoCadastro): string | undefined {
  const compativeis = papeisCompativeis(ctx).map((p) => p.codigo);
  const preferido = ctx.aporte ? PAPEL_SOCIO : ctx.tipoConta === "P" ? "fornecedor" : "cliente";
  return compativeis.includes(preferido) ? preferido : compativeis[0];
}

export const opcaoDoParceiro = (p: Pick<Parceiro, "id" | "nome" | "cpf_cnpj">) => ({ id: p.id, rotulo: `${p.nome} · ${formatarDocumento(p.cpf_cnpj)}` });

registrarCadastroRapido<CamposLidos, Parceiro>("parceiro", {
  novo: "Novo parceiro",
  mensagem: "Parceiro cadastrado",
  recarregar: ["financeiro"],
  pode: (ctx) => temPermissao("financeiro") && papeisCompativeis(ctx).length > 0,
  campos: (ctx) => {
    const papel = papelSugerido(ctx);
    return camposReduzidosDoParceiro({ nome: ctx.sugestao, papeis: papel ? [papel] : [] }, papeisDisponiveis);
  },
  ligar: (form) => ligarCamposDoParceiro(form),
  ler: (form) => lerCamposDoParceiro(form),
  criar: (dados) => apiFinanceiro.parceiros.criar(dados),
  opcao: opcaoDoParceiro,
  aceito: (criado, ctx) => parceirosParaTitulo([criado], ctx.tipoConta ?? "R", !!ctx.aporte).length > 0,
});

type ClienteEntrada = Parameters<typeof api.clientes.criar>[0];
type ClienteCriado = Awaited<ReturnType<typeof api.clientes.criar>>;

registrarCadastroRapido<ClienteEntrada, ClienteCriado>("cliente", {
  novo: "Novo cliente",
  mensagem: "Cliente cadastrado",
  recarregar: ["clientes"],
  pode: () => temPermissao("comercial"),
  campos: (ctx) => camposReduzidosDoParceiro({ nome: ctx.sugestao }),
  ligar: (form) => ligarCamposDoParceiro(form),
  ler: (form) => {
    const lido = lerCamposDoParceiro(form, "cliente");
    if (!lido) return null;
    // Como na tela de clientes: o servidor deduz o tipo de pessoa pelo documento e o papel é sempre "cliente".
    return Object.fromEntries(Object.entries(lido).filter(([k]) => k !== "tipo_pessoa" && k !== "papeis" && k !== "participacao_percentual")) as ClienteEntrada;
  },
  criar: (dados) => api.clientes.criar(dados),
  opcao: (c) => ({ id: c.id, rotulo: c.nome }),
});
