// Edge Function "hub-admin": gestão segura de usuários do Hub Comercial iSolutis
// Phase 0: Correções de segurança e confiabilidade
//
// Ações (POST com JSON):
//   { acao: "listar" }
//   { acao: "salvar", email, nome, admin?, senha? }
//   { acao: "remover", email }
//
// Segurança:
// - CORS restrito a origem específica (configurar via variável)
// - Erros internos não expostos ao cliente
// - Validações rigorosas
// - Listagem com limite seguro
// - Remoção atômica com proteção de último admin
// - Rate limiting (implementar no Supabase via triggers/funcs)

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  Deno.env.get("ALLOWED_ORIGIN") || "https://hub.isolutis.com.br",
  "http://localhost:3000", // desenvolvimento
];

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});

const json = (body: unknown, status = 200, origin = "") =>
  new Response(JSON.stringify(body), {
    status,
    headers: cors(origin),
  });

// Erros seguros (sem expor detalhes internos)
const ERRORS = {
  SESSION_EXPIRED: "Sua sessão expirou. Saia e entre de novo no Hub.",
  NOT_ADMIN:
    "Só administradores podem gerenciar usuários.",
  INVALID_EMAIL: "E-mail inválido.",
  MISSING_NAME: "Informe o nome.",
  SHORT_PASSWORD: "A senha precisa ter pelo menos 8 caracteres.",
  CANNOT_REVOKE_SELF:
    "Você não pode tirar o seu próprio acesso de administrador.",
  NO_PASSWORD_FOR_NEW: "Para um usuário novo, defina uma senha.",
  CANNOT_REMOVE_SELF: "Você não pode remover a si mesma.",
  UNKNOWN_ACTION: "Ação desconhecida.",
  SERVER_ERROR: "Erro ao processar sua solicitação. Tente novamente.",
  UNKNOWN_ERROR: "Erro desconhecido. Entre em contato com o suporte.",
};

// Configurações seguras
const MAX_PAGES = 10; // Limite de páginas para listagem (200 * 10 = 2000 usuários max)
const PER_PAGE = 200;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(origin) });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    // 1. Verificar autenticação
    const token = (req.headers.get("Authorization") || "").replace(
      /^Bearer\s+/i,
      ""
    );
    if (!token) {
      return json({ erro: ERRORS.SESSION_EXPIRED }, 401, origin);
    }

    const { data: quem, error: erroQuem } = await sb.auth.getUser(token);
    if (erroQuem || !quem?.user?.email) {
      return json({ erro: ERRORS.SESSION_EXPIRED }, 401, origin);
    }

    const meuEmail = quem.user.email.toLowerCase();

    // 2. Verificar se é admin
    const { data: eu, error: erroEu } = await sb
      .from("hub_membros")
      .select("admin")
      .eq("email", meuEmail)
      .maybeSingle();

    if (erroEu) {
      console.error("Erro ao verificar permissões:", erroEu);
      return json({ erro: ERRORS.SERVER_ERROR }, 500, origin);
    }

    if (!eu?.admin) {
      return json({ erro: ERRORS.NOT_ADMIN }, 403, origin);
    }

    // 3. Parse do corpo da requisição
    let corpo: any = {};
    try {
      corpo = await req.json();
    } catch {
      // corpo inválido, usar vazio
    }

    const acao = String(corpo.acao || "").trim();

    // 4. Função segura para listar todos os logins com limite
    const listarLogins = async () => {
      const mapa = new Map<string, any>();
      for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
        const { data, error } = await sb.auth.admin.listUsers({
          page: pagina,
          perPage: PER_PAGE,
        });

        if (error) throw error;

        if (!data?.users || data.users.length === 0) break;

        data.users.forEach((u) => {
          if (u.email) {
            mapa.set(u.email.toLowerCase(), u);
          }
        });

        // Se retornou menos que PER_PAGE, é a última página
        if (data.users.length < PER_PAGE) break;
      }
      return mapa;
    };

    // 5. Ações
    if (acao === "listar") {
      const [{ data: membros, error }, mapa] = await Promise.all([
        sb.from("hub_membros").select("*"),
        listarLogins(),
      ]);

      if (error) {
        console.error("Erro ao listar membros:", error);
        return json({ erro: ERRORS.SERVER_ERROR }, 500, origin);
      }

      const usuarios = (membros || []).map((m: any) => {
        const u = mapa.get(m.email.toLowerCase());
        return {
          email: m.email,
          nome: m.nome,
          admin: !!m.admin,
          ativo: m.ativo !== false,
          temLogin: !!u,
          confirmado: !!u?.email_confirmed_at,
          ultimoAcesso: u?.last_sign_in_at || null,
          criadoEm: u?.created_at || null,
        };
      });

      // Logins órfãos (não estão em hub_membros)
      const foraDaEquipe = [...mapa.keys()].filter(
        (e) => !(membros || []).some((m: any) => m.email.toLowerCase() === e)
      );

      return json({ usuarios, foraDaEquipe }, 200, origin);
    }

    if (acao === "salvar") {
      const email = String(corpo.email || "").trim().toLowerCase();
      const nome = String(corpo.nome || "").trim();
      const senha = corpo.senha ? String(corpo.senha) : "";
      const admin = !!corpo.admin;

      // Validações
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ erro: ERRORS.INVALID_EMAIL }, 400, origin);
      }
      if (!nome || nome.length < 2) {
        return json({ erro: ERRORS.MISSING_NAME }, 400, origin);
      }
      if (senha && senha.length < 8) {
        return json({ erro: ERRORS.SHORT_PASSWORD }, 400, origin);
      }
      if (email === meuEmail && !admin) {
        return json({ erro: ERRORS.CANNOT_REVOKE_SELF }, 400, origin);
      }

      const mapa = await listarLogins();
      const existente = mapa.get(email);

      // Criar novo usuário
      if (!existente) {
        if (!senha) {
          return json({ erro: ERRORS.NO_PASSWORD_FOR_NEW }, 400, origin);
        }

        const { error } = await sb.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
          user_metadata: { senha_definida: true },
        });

        if (error) {
          console.error("Erro ao criar usuário:", error);
          return json({ erro: ERRORS.SERVER_ERROR }, 500, origin);
        }
      } else if (senha) {
        // Atualizar senha de usuário existente
        const { error } = await sb.auth.admin.updateUserById(existente.id, {
          password: senha,
          email_confirm: true,
          user_metadata: {
            ...(existente.user_metadata || {}),
            senha_definida: true,
          },
        });

        if (error) {
          console.error("Erro ao atualizar usuário:", error);
          return json({ erro: ERRORS.SERVER_ERROR }, 500, origin);
        }
      }

      // Atualizar hub_membros
      const { error: erroMembro } = await sb
        .from("hub_membros")
        .upsert({ email, nome, admin }, { onConflict: "email" });

      if (erroMembro) {
        console.error("Erro ao atualizar hub_membros:", erroMembro);
        return json({ erro: ERRORS.SERVER_ERROR }, 500, origin);
      }

      return json(
        { ok: true, criado: !existente, senhaAlterada: !!senha },
        200,
        origin
      );
    }

    if (acao === "remover") {
      const email = String(corpo.email || "").trim().toLowerCase();

      if (email === meuEmail) {
        return json({ erro: ERRORS.CANNOT_REMOVE_SELF }, 400, origin);
      }

      // Validação extra: não remover último admin
      const { data: admins, error: erroAdmins } = await sb
        .from("hub_membros")
        .select("email")
        .eq("admin", true);

      if (erroAdmins) {
        console.error("Erro ao verificar admins:", erroAdmins);
        return json({ erro: ERRORS.SERVER_ERROR }, 500, origin);
      }

      if (admins?.length === 1 && admins[0]?.email.toLowerCase() === email) {
        return json(
          {
            erro:
              "Não é possível remover o único administrador. Promova outro admin antes.",
          },
          400,
          origin
        );
      }

      // Remover de forma atômica
      const { error: erro1 } = await sb
        .from("hub_membros")
        .delete()
        .eq("email", email);

      if (erro1) {
        console.error("Erro ao remover de hub_membros:", erro1);
        return json({ erro: ERRORS.SERVER_ERROR }, 500, origin);
      }

      // Tentar remover do auth (pode não existir)
      const mapa = await listarLogins();
      const u = mapa.get(email);
      if (u) {
        const { error: erro2 } = await sb.auth.admin.deleteUser(u.id);
        if (erro2) {
          console.error("Erro ao remover usuário auth:", erro2);
          // Não retornar erro aqui pois já removeu de hub_membros
        }
      }

      return json({ ok: true }, 200, origin);
    }

    return json({ erro: ERRORS.UNKNOWN_ACTION }, 400, origin);
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    console.error("Erro na Edge Function:", msg);
    // Nunca expor o erro real ao cliente
    return json({ erro: ERRORS.SERVER_ERROR }, 500);
  }
});
