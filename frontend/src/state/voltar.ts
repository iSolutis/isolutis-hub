/**
 * Camadas que ocupam a tela por cima da navegação (a folha de seleção do combobox no celular e a gaveta empilhada
 * do cadastro rápido).
 *
 * O botão Voltar do aparelho deve fechar só a camada, e não a gaveta nem a tela. Cada camada aberta empilha uma
 * entrada de histórico com o mesmo endereço; o roteador pergunta aqui, a cada `popstate`, se o evento é de uma
 * camada (`voltarEhDeCamada`) e, se for, não navega nem consulta a guarda de saída.
 */
export interface CamadaAberta {
  /** Fecha a camada pela interface: desfaz a entrada de histórico sem acionar o roteador. */
  fechar(): void;
}

interface Camada {
  aoVoltar: () => void;
  /** A entrada de histórico já foi criada (pode estar adiada, ver `adiadas`). */
  noHistorico: boolean;
}

const pilha: Camada[] = [];
/** `popstate` causados por `fechar()`: já tratados pela própria camada, o roteador deve ignorá-los. */
let ignorar = 0;
/**
 * Camadas abertas enquanto um `history.back()` de outra ainda não terminou (ex.: a folha do combobox fecha e a gaveta
 * de cadastro rápido abre em seguida). Criar a entrada antes desse retorno faria o retorno desfazê-la; por isso ela
 * só é criada quando o `popstate` pendente chega.
 */
const adiadas: Camada[] = [];

const empilharNoHistorico = (camada: Camada): void => {
  history.pushState({ camada: true }, "", location.href);
  camada.noHistorico = true;
};

export function abrirCamada(aoVoltar: () => void): CamadaAberta {
  const camada: Camada = { aoVoltar, noHistorico: false };
  pilha.push(camada);
  if (ignorar > 0) adiadas.push(camada);
  else empilharNoHistorico(camada);
  return {
    fechar(): void {
      const i = pilha.indexOf(camada);
      if (i < 0) return; // já fechada pelo Voltar
      pilha.splice(i, 1);
      if (!camada.noHistorico) {
        adiadas.splice(adiadas.indexOf(camada), 1);
        return;
      }
      ignorar++;
      history.back();
    },
  };
}

/** Chamado pelo roteador a cada `popstate`. `true` quando o evento pertence a uma camada. */
export function voltarEhDeCamada(): boolean {
  if (ignorar > 0) {
    ignorar--;
    if (ignorar === 0) adiadas.splice(0).forEach(empilharNoHistorico);
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
  adiadas.length = 0;
  ignorar = 0;
}
