// Webhook do provedor de WhatsApp: POST /functions/v1/whatsapp-webhook?slug=SEU-SLUG&token=WHATSAPP_WEBHOOK_SECRET
import { requireEnv } from "../_shared/env.ts";
import { adminClient, handler, HttpError, json, runInBackground } from "../_shared/http.ts";
import { handleInbound } from "../_shared/inbound.ts";
import { getProvider } from "../_shared/messaging/index.ts";
import type { Business } from "../_shared/types.ts";

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(
  handler(async (req) => {
    const url = new URL(req.url);
    if (!sameSecret(url.searchParams.get("token") ?? "", requireEnv("WHATSAPP_WEBHOOK_SECRET"))) {
      throw new HttpError(401, "unauthorized");
    }

    const db = adminClient();
    const { data: business } = await db
      .from("businesses")
      .select("*")
      .eq("slug", url.searchParams.get("slug") ?? "")
      .maybeSingle<Business>();
    if (!business) throw new HttpError(404, "not found");

    const provider = getProvider();
    const messages = await provider.parseWebhook(req);

    // Responde rápido ao provedor; a IA responde em segundo plano.
    await runInBackground(
      (async () => {
        for (const msg of messages) {
          try {
            await handleInbound(db, business, msg, { deliver: true, provider: provider.name });
          } catch (err) {
            console.error("Falha ao processar mensagem do WhatsApp", err);
          }
        }
      })(),
    );

    return json({ received: messages.length });
  }),
);
