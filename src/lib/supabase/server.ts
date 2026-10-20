import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { env } from "@/lib/env";

/** Cliente com a sessão da usuária logada (respeita RLS). */
export async function createSupabaseServer() {
  // A sessão depende do relógio (expiração do token): nunca pode rodar no pré-render.
  await connection();
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado de um Server Component: o proxy renova a sessão, pode ignorar.
        }
      },
    },
  });
}

/**
 * Cliente com service role: ignora RLS. Use só em fluxos de servidor sem usuária logada
 * (página pública, webhook do WhatsApp, cron) e sempre filtrando por business_id.
 */
export function createSupabaseAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
