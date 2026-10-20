"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { generateCaptions, isSupportedImage, type CaptionResult } from "@/lib/ai/captions";
import { requireBusiness } from "@/lib/auth";
import { env } from "@/lib/env";
import { handleInbound } from "@/lib/inbound";
import { SIMULATOR_PHONE } from "@/lib/simulator";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function aiErrorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Chave da API da Anthropic inválida.";
  if (err instanceof Anthropic.RateLimitError) return "Muitas requisições à IA agora. Tente de novo em instantes.";
  if (err instanceof Anthropic.APIError) return `A IA está indisponível no momento (erro ${err.status}).`;
  if (err instanceof Error) return err.message;
  return "Erro inesperado.";
}

export type CaptionState = { error?: string; result?: CaptionResult } | undefined;

export async function captionsAction(_: CaptionState, form: FormData): Promise<CaptionState> {
  const { business } = await requireBusiness();
  if (!env.aiConfigured()) return { error: "Configure ANTHROPIC_API_KEY no .env para usar a IA." };

  const description = String(form.get("description") ?? "").trim();
  const tone = String(form.get("tone") ?? "delicado e elegante");
  const file = form.get("photo");
  let image: Parameters<typeof generateCaptions>[0]["image"];

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) return { error: "A foto deve ter até 5 MB." };
    if (!isSupportedImage(file.type)) return { error: "Use foto JPG, PNG, WEBP ou GIF." };
    image = { base64: Buffer.from(await file.arrayBuffer()).toString("base64"), mediaType: file.type };
  }
  if (!image && !description) return { error: "Envie uma foto ou descreva o trabalho." };

  try {
    return { result: await generateCaptions({ businessName: business.name, description, tone, image }) };
  } catch (err) {
    return { error: aiErrorMessage(err) };
  }
}

export async function simulatorSend(text: string): Promise<{ error?: string }> {
  const { business } = await requireBusiness();
  if (!env.aiConfigured()) return { error: "Configure ANTHROPIC_API_KEY no .env para usar a IA." };
  if (!business.ai_enabled) return { error: "A IA está desligada em Configurações." };
  const body = text.trim().slice(0, 2000);
  if (!body) return {};

  try {
    await handleInbound(createSupabaseAdmin(), business, { from: SIMULATOR_PHONE, text: body, name: "Cliente de teste" }, {
      deliver: false,
      provider: "simulator",
    });
  } catch (err) {
    return { error: aiErrorMessage(err) };
  } finally {
    revalidatePath("/painel/ia");
  }
  return {};
}

export async function simulatorReset() {
  const { business } = await requireBusiness();
  await createSupabaseAdmin().from("messages").delete().eq("business_id", business.id).eq("phone", SIMULATOR_PHONE);
  revalidatePath("/painel/ia");
}
