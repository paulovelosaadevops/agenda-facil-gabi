import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { handleInbound } from "@/lib/inbound";
import { getProvider } from "@/lib/messaging";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

// A resposta da IA roda depois do 200, mas ainda dentro do tempo da função.
export const maxDuration = 60;

function validToken(token: string | null): boolean {
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(env.webhookSecret());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Webhook do provedor de WhatsApp: POST /api/whatsapp/{slug}?token=WHATSAPP_WEBHOOK_SECRET */
export async function POST(request: Request, ctx: RouteContext<"/api/whatsapp/[slug]">) {
  if (!validToken(new URL(request.url).searchParams.get("token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = await ctx.params;
  const db = createSupabaseAdmin();
  const { data: business } = await db.from("businesses").select("*").eq("slug", slug).maybeSingle<Business>();
  if (!business) return NextResponse.json({ error: "not found" }, { status: 404 });

  const provider = getProvider();
  const messages = await provider.parseWebhook(request);

  // Responde rápido ao provedor; a IA processa em seguida.
  after(async () => {
    for (const msg of messages) {
      try {
        await handleInbound(db, business, msg, { deliver: true, provider: provider.name });
      } catch (err) {
        console.error("Falha ao processar mensagem do WhatsApp", err);
      }
    }
  });

  return NextResponse.json({ received: messages.length });
}
