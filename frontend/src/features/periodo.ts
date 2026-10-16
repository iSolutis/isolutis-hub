/** Seleção de ano e mês compartilhada pelas telas que filtram por ano e mês. */
import { ui } from "@/state/estado";
import { recarregarVista, render } from "@/state/nucleo";
import { registrarAcao } from "@/ui/acoes";

registrarAcao("mudarAno", async (alvo) => {
  ui.ano = Number((alvo as HTMLSelectElement).value);
  ui.mes = null;
  await recarregarVista();
});
registrarAcao("mes", (alvo) => {
  const m = Number(alvo.dataset.valor);
  ui.mes = ui.mes === m ? null : m;
  render();
});
registrarAcao("limparMes", () => {
  ui.mes = null;
  render();
});
