/**
 * Camadas que ocupam a tela por cima da navegação (hoje: a folha de seleção do combobox no celular).
 *
 * O botão Voltar do aparelho deve fechar só a camada, e não a gaveta nem a tela. Cada camada aberta empilha uma
 * entrada de histórico com o mesmo endereço; o roteador pergunta aqui, a cada `popstate`, se o evento é de uma
 * camada (`voltarEhDeCamada`) e, se for, não navega nem consulta a guarda de saída.
 */
export interface CamadaAberta {
  /** Fecha a camada pela interface: desfaz a entrada de histórico sem acionar o roteador. */
  fechar(): void;
}

const pilha: Array<{ aoVoltar: () => void }> = [];
/** `popstate` causados por `fechar()`: já tratados pela própria camada, o roteador deve ignorá-los. */
let ignorar = 0;

export function abrirCamada(aoVoltar: () => void): CamadaAberta {
  history.pushState({ camada: true }, "", location.href);
  const camada = { aoVoltar };
  pilha.push(camada);
  return {
    fechar(): void {
      const i = pilha.indexOf(camada);
      if (i < 0) return; // já fechada pelo Voltar
      pilha.splice(i, 1);
      ignorar++;
      history.back();
    },
  };
}

/** Chamado pelo roteador a cada `popstate`. `true` quando o evento pertence a uma camada. */
export function voltarEhDeCamada(): boolean {
  if (ignorar > 0) {
    ignorar--;
    return true;
  }
  const camada = pilha.pop();
  if (!camada) return false;
  camada.aoVoltar();
  return true;
}

/** Só para testes: zera a pilha e o contador. */
export function reiniciarCamadas(): void {
  pilha.length = 0;
  ignorar = 0;
}
