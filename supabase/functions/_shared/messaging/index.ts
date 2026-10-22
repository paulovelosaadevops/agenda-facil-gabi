import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../env.ts";
import type { Business } from "../types.ts";
import { consoleProvider } from "./console.ts";
import type { MessagingProvider } from "./types.ts";

export type { InboundMessage, MessagingProvider } from "./types.ts";

const providers: Record<string, MessagingProvider> = {
  console: consoleProvider,
};

export function getProvider(): MessagingProvider {
  const name = getEnv("MESSAGING_PROVIDER") ?? "console";
  const provider = providers[name];
  if (!provider) throw new Error(`Provedor de mensagens desconhecido: ${name}`);
  return provider;
}

export interface OutboundMessage {
  business: Business;
  phone: string;
  body: string;
  clientId?: string | null;
  kind: "chat" | "confirmation" | "reminder";
}

/** Envia pelo provedor configurado e registra no histórico. */
export async function sendMessage(db: SupabaseClient, msg: OutboundMessage) {
  const provider = getProvider();
  const { providerMessageId } = await provider.sendText(msg.phone, msg.body);
  const { error } = await db.from("messages").insert({
    business_id: msg.business.id,
    client_id: msg.clientId ?? null,
    phone: msg.phone,
    direction: "out",
    body: msg.body,
    kind: msg.kind,
    provider: provider.name,
    provider_message_id: providerMessageId ?? null,
  });
  if (error) console.error("Falha ao registrar mensagem enviada", error);
}
