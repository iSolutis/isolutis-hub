/**
 * Equipes (escopo de acesso): quem lidera quem. O líder enxerga e administra os registros dos membros da equipe
 * e, recursivamente, dos liderados deles; uma pessoa pode estar em várias equipes. Só administradores alteram.
 */
import { api } from "@/api/endpoints";
import type { Equipe } from "@/api/tipos";
import { compararTexto } from "@/core/formato";
import { html, raw, type Safe } from "@/core/html";
import { dados, nomeMembro } from "@/state/estado";
import { recarregar, registrarVista, render } from "@/state/nucleo";
import { registrarAcao } from "@/ui/acoes";
import { campo, fv, inp } from "@/ui/campos";
import { cabecalhoDePagina, carregando, estadoDeErro, estadoVazio } from "@/ui/componentes";
import { confirmar } from "@/ui/confirmar";
import { tentar } from "@/ui/erros";
import { botaoExcluir, espaco } from "@/ui/formularios";
import { abrirGaveta } from "@/ui/gaveta";
import { avisar, toast } from "@/ui/toast";

const tela: { equipes: Equipe[] | null; erro: string } = { equipes: null, erro: "" };

async function carregar(): Promise<void> {
  try {
    tela.equipes = await api.equipes.listar();
    tela.erro = "";
  } catch (e) {
    tela.erro = e instanceof Error ? e.message : "Não foi possível carregar as equipes.";
  }
}

const nomes = (ids: readonly string[]): string =>
  ids.map((id) => nomeMembro(id) || "Pessoa sem acesso").sort(compararTexto).join(", ") || "—";

function vista(): Safe {
  const cabecalho = cabecalhoDePagina({
    titulo: "Equipes e líderes",
    descricao: "Cada pessoa vê o que é dela; o líder vê também o que é dos membros da equipe (e dos liderados deles).",
    acoes: html`<button class="btn primary" data-act="novaEquipe">Nova equipe</button>`,
  });
  if (tela.erro) return html`${cabecalho}${estadoDeErro({ mensagem: tela.erro, acaoRepetir: "recarregarEquipes" })}`;
  if (!tela.equipes) return html`${cabecalho}${carregando("Carregando as equipes…")}`;
  if (!tela.equipes.length)
    return html`${cabecalho}${estadoVazio({
      icone: "equipe",
      titulo: "Nenhuma equipe ainda",
      texto: "Sem equipes, cada pessoa vê só o que é dela e o que não tem dono — líderes não enxergam o time. Crie as equipes e indique os líderes.",
      acao: html`<button class="btn primary" data-act="novaEquipe">Criar a primeira equipe</button>`,
    })}`;
  return html`${cabecalho}<div class="equipes">${tela.equipes.map(
    (e) => html`<article class="panel equipe-card" tabindex="0" data-act="editarEquipe" data-id="${e.id}">
      <h2>${e.nome}</h2>
      <dl><div><dt>Líderes</dt><dd>${nomes(e.lideres)}</dd></div><div><dt>Membros</dt><dd>${nomes(e.membros)}</dd></div></dl>
    </article>`,
  )}</div>`;
}

registrarVista({ id: "equipes", nome: "Equipes e líderes", permissao: "administracao", carregar, desenhar: vista });

function escolhas(nome: "lideres" | "membros", marcados: readonly string[]): Safe {
  const pessoas = dados.equipe.filter((m) => m.ativo).sort((a, b) => compararTexto(a.nome, b.nome));
  return html`<fieldset class="escolhas"><legend>${nome === "lideres" ? "Líderes" : "Membros"}</legend>${pessoas.map(
    (m) => html`<label class="check"><input type="checkbox" name="${nome}" value="${m.id}"${raw(marcados.includes(m.id) ? " checked" : "")}> ${m.nome}</label>`,
  )}</fieldset>`;
}

export function formEquipe(e?: Equipe): void {
  abrirGaveta({
    titulo: e ? e.nome : "Nova equipe",
    corpo: html`<div class="fields">${campo("Nome da equipe", inp("nome", e?.nome, 'maxlength="100" placeholder="Ex.: Comercial Sul"'), true)}</div>
      <p class="sub">Uma pessoa pode estar em várias equipes. Se um membro também lidera outra equipe, os líderes desta enxergam os dois níveis.</p>
      <div class="duas-colunas">${escolhas("lideres", e?.lideres ?? [])}${escolhas("membros", e?.membros ?? [])}</div>`,
    rodape: html`<button class="btn primary" data-salvar>Salvar</button>${espaco}${botaoExcluir(!!e)}`,
    montar: (f, fechar, L) => {
      const marcados = (nome: string): string[] => [...f.querySelectorAll<HTMLInputElement>(`input[name="${nome}"]:checked`)].map((i) => i.value);
      L.querySelector("[data-salvar]")?.addEventListener("click", async () => {
        const nome = fv(f, "nome");
        if (!nome) return void avisar("Dê um nome à equipe.");
        const lideres = marcados("lideres");
        if (!lideres.length) return void avisar("Escolha pelo menos um líder.");
        const corpo = { nome, lideres, membros: marcados("membros") };
        const salva = await tentar(() => (e ? api.equipes.atualizar(e.id, corpo) : api.equipes.criar(corpo)));
        if (!salva) return;
        toast("Equipe salva. O que cada um enxerga já foi atualizado.");
        fechar();
        await carregar();
        await recarregar("escopo");
      });
      L.querySelector("[data-excluir]")?.addEventListener("click", async () => {
        if (!e) return;
        const ok = await confirmar({ titulo: "Excluir a equipe?", texto: "Os líderes deixam de enxergar os registros dos membros por meio desta equipe.", confirmar: "Excluir", cancelar: "Manter" });
        if (!ok || (await tentar(() => api.equipes.excluir(e.id))) === null) return;
        toast("Equipe excluída.");
        fechar();
        await carregar();
        await recarregar("escopo");
      });
    },
  });
}

registrarAcao("novaEquipe", () => formEquipe());
registrarAcao("editarEquipe", (alvo) => formEquipe(tela.equipes?.find((x) => x.id === alvo.dataset.id)));
registrarAcao("recarregarEquipes", async () => {
  await carregar();
  render();
});
