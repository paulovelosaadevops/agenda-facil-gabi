import type { SupabaseClient } from "@supabase/supabase-js";
import { replyToClient } from "./ai/assistant.ts";
import { getEnv } from "./env.ts";
import { sendMessage, type InboundMessage } from "./messaging/index.ts";
import type { Business } from "./types.ts";

/**
 * Registra a mensagem recebida e, se a IA estiver ligada, gera e envia a resposta.
 * `deliver: false` é usado pelo simulador do painel: grava a resposta sem enviar pelo provedor.
 * Espera um cliente Supabase com service role (não há usuária logada no webhook).
 */
export async function handleInbound(
  db: SupabaseClient,
  business: Business,
  msg: InboundMessage,
  opts: { deliver: boolean; provider: string },
): Promise<string | null> {
  const { data: client } = await db
    .from("clients")
    .select("id")
    .eq("business_id", business.id)
    .eq("phone", msg.from)
    .maybeSingle();

  const { error } = await db.from("messages").insert({
    business_id: business.id,
    client_id: client?.id ?? null,
    phone: msg.from,
    direction: "in",
    body: msg.text,
    provider: opts.provider,
    provider_message_id: msg.providerMessageId ?? null,
  });
  if (error) throw error;

  if (!business.ai_enabled || !getEnv("ANTHROPIC_API_KEY")) return null;

  const reply = await replyToClient({ db, business, phone: msg.from, profileName: msg.name });

  if (opts.deliver) {
    await sendMessage(db, { business, phone: msg.from, clientId: client?.id, body: reply, kind: "chat" });
  } else {
    const { error: outError } = await db.from("messages").insert({
      business_id: business.id,
      client_id: client?.id ?? null,
      phone: msg.from,
      direction: "out",
      body: reply,
      provider: opts.provider,
    });
    if (outError) throw outError;
  }
  return reply;
}
