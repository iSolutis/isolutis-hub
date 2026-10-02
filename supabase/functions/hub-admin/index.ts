// Edge Function "hub-admin": gestão de usuários do Hub Comercial iSolutis.
// Roda no Supabase, onde a chave secreta já está disponível (SUPABASE_SERVICE_ROLE_KEY);
// a página nunca vê essa chave. Só atende quem estiver em hub_membros com admin = true.
//
// Ações (POST com JSON):
//   { acao: "listar" }
//   { acao: "salvar", email, nome, admin?, senha? }   cria ou atualiza; senha opcional na edição
//   { acao: "remover", email }
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // quem está pedindo?
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: quem, error: erroQuem } = await sb.auth.getUser(token);
    if (erroQuem || !quem?.user?.email) return json({ erro: "Sua sessão expirou. Saia e entre de novo no Hub." }, 401);
    const meuEmail = quem.user.email.toLowerCase();
    const { data: eu } = await sb.from("hub_membros").select("admin").eq("email", meuEmail).maybeSingle();
    if (!eu?.admin) return json({ erro: "Só administradores podem gerenciar usuários." }, 403);

    const corpo = await req.json().catch(() => ({}));
    const acao = String(corpo.acao || "");

    // todos os logins do Supabase, indexados por e-mail
    const logins = async () => {
      const mapa = new Map<string, any>();
      for (let pagina = 1; pagina < 20; pagina++) {
        const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 });
        if (error) throw error;
        data.users.forEach((u) => u.email && mapa.set(u.email.toLowerCase(), u));
        if (data.users.length < 200) break;
      }
      return mapa;
    };

    if (acao === "listar") {
      const [{ data: membros, error }, mapa] = await Promise.all([sb.from("hub_membros").select("*"), logins()]);
      if (error) throw error;
      const usuarios = (membros || []).map((m: any) => {
        const u = mapa.get(m.email.toLowerCase());
        return {
          email: m.email, nome: m.nome, admin: !!m.admin,
          temLogin: !!u, confirmado: !!u?.email_confirmed_at,
          ultimoAcesso: u?.last_sign_in_at || null, criadoEm: u?.created_at || null,
        };
      });
      // logins que existem no Supabase mas não estão na equipe (não acessam nada)
      const foraDaEquipe = [...mapa.keys()].filter((e) => !(membros || []).some((m: any) => m.email.toLowerCase() === e));
      return json({ usuarios, foraDaEquipe });
    }

    if (acao === "salvar") {
      const email = String(corpo.email || "").trim().toLowerCase();
      const nome = String(corpo.nome || "").trim();
      const senha = corpo.senha ? String(corpo.senha) : "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ erro: "E-mail inválido." }, 400);
      if (!nome) return json({ erro: "Informe o nome." }, 400);
      if (senha && senha.length < 8) return json({ erro: "A senha precisa ter pelo menos 8 caracteres." }, 400);
      if (email === meuEmail && corpo.admin === false) return json({ erro: "Você não pode tirar o seu próprio acesso de administrador." }, 400);

      const mapa = await logins();
      const existente = mapa.get(email);
      if (!existente) {
        if (!senha) return json({ erro: "Para um usuário novo, defina uma senha." }, 400);
        const { error } = await sb.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { senha_definida: true } });
        if (error) throw error;
      } else if (senha) {
        const { error } = await sb.auth.admin.updateUserById(existente.id, {
          password: senha, email_confirm: true,
          user_metadata: { ...(existente.user_metadata || {}), senha_definida: true },
        });
        if (error) throw error;
      }
      const { error: erroMembro } = await sb.from("hub_membros").upsert({ email, nome, admin: !!corpo.admin });
      if (erroMembro) throw erroMembro;
      return json({ ok: true, criado: !existente, senhaAlterada: !!senha });
    }

    if (acao === "remover") {
      const email = String(corpo.email || "").trim().toLowerCase();
      if (email === meuEmail) return json({ erro: "Você não pode remover a si mesma." }, 400);
      const { error } = await sb.from("hub_membros").delete().eq("email", email);
      if (error) throw error;
      const u = (await logins()).get(email);
      if (u) { const { error: e2 } = await sb.auth.admin.deleteUser(u.id); if (e2) throw e2; }
      return json({ ok: true });
    }

    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ erro: "Erro no servidor: " + ((e as Error)?.message || String(e)) }, 500);
  }
});
