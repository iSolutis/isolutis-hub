## Decisions

- **Logomarca no banco (`bytea`)**, não em disco: o deploy roda em um serviço sem volume compartilhado e a imagem é pequena (≤ 512 KB). A API devolve a logo como data URL no `GET /empresas/ativa` — a CSP já permite `img-src data:` e o `<img>` não precisaria de token para baixar. A coluna é `deferred` no ORM: só é lida quando a resposta precisa dela.
- **Tipo pelo conteúdo**: assinaturas PNG/JPEG/WebP conferidas nos bytes; o tipo declarado pelo cliente é ignorado. SVG fica de fora (pode conter script).
- **Paleta = duas cores** (`{"primaria", "destaque"}` em `jsonb`, nula = padrão). O front deriva os tokens de `tokens.css` (`--navy`, `--navy-deep`, `--teal*`, `--accent*`, `--bar-*`, `--side-*`) para claro e escuro e injeta um `<style id="paleta-empresa">` depois de `tokens.css` (CSP permite estilos inline). Onde a cor vira texto ou fundo do menu, ela é escurecida até o contraste WCAG mínimo (4,5:1 texto; 7:1 menu).
- **Escopo por empresa, edição por administrador**: identidade é da marca, não preferência pessoal; o tema claro/escuro continua sendo de cada pessoa.
- **Sem piscar**: a última identidade de cada empresa fica em `localStorage` (`hub.identidade.<empresa>`) e é aplicada antes da resposta do servidor; é apagada ao sair da sessão.
- **Documentos**: `services.empresa.identidade()` monta um `Identidade` (nome, subtítulo, documento, contato, endereço, logo) consumido pelos templates; sem dados, cai no padrão iSolutis.

## Risks / Trade-offs

- [Logo de 512 KB em cada `GET /empresas/ativa`] → chamado uma vez por abertura e por mudança; cache local evita depender dele para pintar.
- [Cores de marca muito claras] → ajustadas para contraste; a tela avisa.
- [Rodapé dos documentos muda para empresas sem cadastro] → mostra o nome da empresa; o texto fixo da iSolutis só aparece se nada estiver cadastrado.

## Migration Plan

`alembic upgrade head` (0012). Rollback: `alembic downgrade 0011` remove colunas, checks e índice (dados novos descartados).
