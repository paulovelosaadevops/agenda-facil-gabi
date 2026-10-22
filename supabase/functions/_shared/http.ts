import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { z } from "zod";
import { getEnv, requireEnv } from "./env.ts";
import type { Business, Client } from "./types.ts";

// Mensagens de validação em português.
z.config(z.locales.pt());

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Envolve o handler: responde ao preflight CORS e converte erros em JSON. */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "Erro inesperado. Tente novamente." }, 500);
    }
  };
}

function serviceKey(): string {
  const legacy = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  // Formato novo: dicionário JSON de chaves secretas.
  const keys = JSON.parse(requireEnv("SUPABASE_SECRET_KEYS")) as Record<string, string>;
  return keys.default ?? Object.values(keys)[0];
}

/** Cliente com service role: ignora RLS, então sempre filtre por business_id. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Valida o JWT da usuária e devolve o negócio dela. */
export async function requireOwner(req: Request): Promise<{ db: SupabaseClient; user: User; business: Business }> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Faça login novamente.");
  const db = adminClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sessão expirada. Faça login novamente.");

  const { data: business } = await db
    .from("businesses")
    .select("*")
    .eq("owner_id", data.user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle<Business>();
  if (!business) throw new HttpError(404, "Estúdio não encontrado.");
  return { db, user: data.user, business };
}

/** O estúdio (o app atende um único estúdio: o da Gabi). */
export async function loadStudio(db: SupabaseClient, slug?: string): Promise<Business> {
  let query = db.from("businesses").select("*").order("created_at").limit(1);
  if (slug) query = query.eq("slug", slug);
  const { data } = await query.maybeSingle<Business>();
  if (!data) throw new HttpError(404, "Estúdio não encontrado.");
  return data;
}

/** Valida o JWT de uma cliente e devolve a ficha dela. */
export async function requireClient(req: Request): Promise<{ db: SupabaseClient; user: User; client: Client; business: Business }> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const db = adminClient();
  // Sem login, o supabase-js envia a chave pública como token: não é um usuário.
  const { data } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!data.user) throw new HttpError(401, "Entre na sua conta para agendar.");

  const { data: client } = await db.from("clients").select("*").eq("user_id", data.user.id).maybeSingle<Client>();
  if (!client) throw new HttpError(403, "Conta de cliente não encontrada.");
  const { data: business } = await db.from("businesses").select("*").eq("id", client.business_id).single<Business>();
  if (!business) throw new HttpError(404, "Estúdio não encontrado.");
  return { db, user: data.user, client, business };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Corpo da requisição inválido.");
  }
}

/**
 * Executa trabalho depois de responder. Em produção usa EdgeRuntime.waitUntil;
 * localmente o runtime encerra ao responder, então espera o trabalho terminar.
 */
export async function runInBackground(work: Promise<unknown>): Promise<void> {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (runtime && getEnv("SB_REGION")) runtime.waitUntil(work);
  else await work;
}
