/**
 * Aparência: paleta de cores da empresa. O administrador escolhe uma paleta sugerida ou duas cores próprias
 * (primária e destaque); a interface inteira muda na hora como pré-visualização e só passa a valer para a
 * equipe ao salvar. Sair sem salvar desfaz a pré-visualização.
 */
import { api } from "@/api/endpoints";
import { html, raw, type Safe } from "@/core/html";
import { registrarGuarda, registrarVista, render, vistaAtual } from "@/state/nucleo";
import { registrarAcao } from "@/ui/acoes";
import { cabecalhoDePagina, carregando, estadoDeErro } from "@/ui/componentes";
import { confirmar } from "@/ui/confirmar";
import { tentar } from "@/ui/erros";
import { icone } from "@/ui/icones";
import { aplicarPaleta, corValida, identidadeLembrada, lembrarIdentidade, PALETA_PADRAO, PALETAS_SUGERIDAS, type Paleta } from "@/ui/identidade";
import { toast } from "@/ui/toast";

const tela: {
  empresaId: string;
  logo: string | null;
  salva: Paleta | null;
  escolha: Paleta;
  erro: string;
  carregado: boolean;
  salvando: boolean;
} = { empresaId: "", logo: null, salva: null, escolha: PALETA_PADRAO, erro: "", carregado: false, salvando: false };

const mesma = (a: Paleta | null, b: Paleta | null): boolean =>
  (a ?? PALETA_PADRAO).primaria === (b ?? PALETA_PADRAO).primaria && (a ?? PALETA_PADRAO).destaque === (b ?? PALETA_PADRAO).destaque;

const alterada = (): boolean => tela.carregado && !mesma(tela.escolha, tela.salva);

async function carregar(): Promise<void> {
  try {
    const empresa = await api.empresas.ativa();
    Object.assign(tela, { empresaId: empresa.id, logo: empresa.logo ?? null, salva: empresa.paleta ?? null, escolha: empresa.paleta ?? PALETA_PADRAO, erro: "", carregado: true });
  } catch (e) {
    tela.erro = e instanceof Error ? e.message : "Não foi possível carregar a paleta da empresa.";
  }
  registrarGuarda(
    async () =>
      vistaAtual() !== "aparencia" ||
      !alterada() ||
      (await confirmar({ titulo: "Descartar as cores escolhidas?", texto: "A nova paleta ainda não foi salva. Saindo agora, o Hub volta às cores atuais.", confirmar: "Descartar", cancelar: "Continuar aqui" })),
    () => aplicarPaleta(tela.salva), // saiu da tela: desfaz a pré-visualização
  );
}

const amostra = (p: Paleta): Safe =>
  html`<span class="paleta-amostra" aria-hidden="true"><i style="background:${p.primaria}"></i><i style="background:${p.destaque}"></i></span>`;

function seletorDeCor(nome: "primaria" | "destaque", rotulo: string, ajuda: string): Safe {
  const valor = tela.escolha[nome];
  return html`<div class="field cor-campo">
    <label for="cor-${nome}">${rotulo}</label>
    <div class="cor-entrada">
      <input type="color" id="cor-${nome}" data-cor="${nome}" value="${valor}" aria-describedby="cor-${nome}-ajuda">
      <input type="text" data-cor-hex="${nome}" value="${valor}" maxlength="7" spellcheck="false" aria-label="${rotulo} em hexadecimal">
    </div>
    <p class="sub" id="cor-${nome}-ajuda">${ajuda}</p>
  </div>`;
}

function vista(): Safe {
  const cabecalho = cabecalhoDePagina({ titulo: "Aparência", descricao: "Paleta de cores do Hub para toda a equipe desta empresa. O tema claro ou escuro continua sendo escolha de cada pessoa." });
  if (tela.erro) return html`${cabecalho}${estadoDeErro({ mensagem: tela.erro, acaoRepetir: "recarregarAparencia" })}`;
  if (!tela.carregado) return html`${cabecalho}${carregando("Carregando a paleta…")}`;
  return html`${cabecalho}
    <div class="fp-secs aparencia">
      <section class="panel fp-sec" aria-labelledby="ap-sugeridas">
        <header><h2 id="ap-sugeridas">Paletas sugeridas</h2><p class="sub">Escolha uma para ver o Hub com ela agora mesmo.</p></header>
        <div class="corpo"><div class="paletas" role="radiogroup" aria-label="Paletas sugeridas">${PALETAS_SUGERIDAS.map(
          (s, i) => html`<button type="button" class="paleta-opcao" role="radio" aria-checked="${String(mesma(s.paleta, tela.escolha))}" data-act="escolherPaleta" data-valor="${i}">${amostra(s.paleta)}<span>${s.nome}</span>${mesma(s.paleta, tela.escolha) ? icone("check") : ""}</button>`,
        )}</div></div>
      </section>
      <section class="panel fp-sec" aria-labelledby="ap-propria">
        <header><h2 id="ap-propria">Cores próprias</h2><p class="sub">Use as cores da sua marca. Tons muito claros são escurecidos onde viram texto, para manter a leitura.</p></header>
        <div class="corpo"><div class="fields">
          ${seletorDeCor("primaria", "Cor primária", "Menu lateral, botões principais e títulos.")}
          ${seletorDeCor("destaque", "Cor de destaque", "Item selecionado, links, gráficos e indicadores.")}
        </div>
        <div class="previa-paleta" aria-label="Pré-visualização">
          <div class="previa-lateral"><b>Menu</b><span class="ativo">Item selecionado</span><span>Outro item</span></div>
          <div class="previa-conteudo"><b>Pré-visualização</b><p class="sub">Assim ficam os elementos principais.</p>
            <div class="fila"><button type="button" class="btn primary" tabindex="-1">Botão principal</button><span class="pill teal-mid">Selecionado</span><span class="previa-link">Link</span></div>
            <div class="previa-barra"><i></i></div>
          </div>
        </div></div>
      </section>
      <div class="fp-acoes${alterada() ? " dirty" : ""}"><span class="sujo" role="status">Paleta não salva (pré-visualização)</span><span class="sp"></span>
        ${tela.salva ? html`<button type="button" class="btn ghost" data-act="restaurarPaleta">Voltar à paleta padrão</button>` : ""}
        <button type="button" class="btn ghost" data-act="descartarPaleta"${raw(alterada() ? "" : " disabled")}>Descartar</button>
        <button type="button" class="btn primary" data-act="salvarPaleta"${raw(alterada() && !tela.salvando ? "" : " disabled")}>${tela.salvando ? "Salvando…" : "Salvar paleta"}</button>
      </div>
    </div>`;
}

registrarVista({ id: "aparencia", nome: "Aparência", permissao: "administracao", carregar, desenhar: vista });

function escolher(p: Paleta): void {
  tela.escolha = { ...p };
  aplicarPaleta(tela.escolha);
  render();
}

function lembrar(): void {
  if (!tela.empresaId) return;
  const anterior = identidadeLembrada(tela.empresaId);
  lembrarIdentidade(tela.empresaId, { logo: anterior?.logo ?? tela.logo, paleta: tela.salva });
}

if (typeof document !== "undefined") {
  // Seletor de cor: pré-visualiza enquanto arrasta, sem redesenhar a tela (o seletor nativo continua aberto).
  document.addEventListener("input", (e) => {
    const campo = e.target as HTMLInputElement;
    const nome = (campo.dataset?.cor ?? campo.dataset?.corHex) as keyof Paleta | undefined;
    if (!nome || !campo.closest?.(".aparencia")) return;
    const valor = campo.value.trim().toLowerCase();
    if (!corValida(valor)) return;
    tela.escolha = { ...tela.escolha, [nome]: valor };
    aplicarPaleta(tela.escolha);
    const par = document.querySelector<HTMLInputElement>(campo.dataset.cor ? `[data-cor-hex="${nome}"]` : `[data-cor="${nome}"]`);
    if (par) par.value = valor;
  });
  // Ao soltar o seletor (ou sair do campo de texto), redesenha para atualizar a lista e os botões.
  document.addEventListener("change", (e) => {
    const campo = e.target as HTMLInputElement;
    if ((campo.dataset?.cor || campo.dataset?.corHex) && campo.closest?.(".aparencia")) render();
  });
}

registrarAcao("escolherPaleta", (alvo) => {
  const sugerida = PALETAS_SUGERIDAS[Number(alvo.dataset.valor)];
  if (sugerida) escolher(sugerida.paleta);
});

registrarAcao("descartarPaleta", () => escolher(tela.salva ?? PALETA_PADRAO));

registrarAcao("salvarPaleta", async () => {
  if (!alterada() || tela.salvando) return;
  tela.salvando = true;
  render();
  const padrao = mesma(tela.escolha, PALETA_PADRAO);
  const ok = await tentar(async () => {
    if (padrao) await api.empresas.restaurarPaleta();
    else await api.empresas.salvarPaleta(tela.escolha);
    return true;
  });
  tela.salvando = false;
  if (ok !== null) {
    tela.salva = padrao ? null : { ...tela.escolha };
    lembrar();
    toast("Paleta salva. A equipe passa a ver o Hub com estas cores.");
  }
  render();
});

registrarAcao("restaurarPaleta", async () => {
  if ((await tentar(() => api.empresas.restaurarPaleta())) === null) return;
  tela.salva = null;
  lembrar();
  escolher(PALETA_PADRAO);
  toast("O Hub voltou à paleta padrão.");
});

registrarAcao("recarregarAparencia", async () => {
  await carregar();
  aplicarPaleta(tela.escolha);
  render();
});
