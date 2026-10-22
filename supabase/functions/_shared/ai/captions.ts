import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { AI_MODEL, anthropic, FALLBACK_BETA } from "./client.ts";

const CaptionSchema = z.object({
  legendas: z
    .array(z.object({ estilo: z.string(), texto: z.string() }))
    .describe("três opções de legenda com estilos diferentes"),
  hashtags: z.array(z.string()).describe("hashtags sem o #"),
});

export type CaptionResult = z.infer<typeof CaptionSchema>;

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export function isSupportedImage(type: string): type is ImageType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(type);
}

export async function generateCaptions(input: {
  businessName: string;
  description: string;
  tone: string;
  image?: { base64: string; mediaType: ImageType };
}): Promise<CaptionResult> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.image.mediaType, data: input.image.base64 },
    });
  }
  content.push({
    type: "text",
    text:
      `Crie legendas para um post de Instagram do estúdio de unhas "${input.businessName}".\n` +
      `Sobre o trabalho: ${input.description || "(veja a foto)"}\n` +
      `Tom desejado: ${input.tone}.\n\n` +
      `Gere 3 legendas em português do Brasil com estilos diferentes (ex.: curta e direta, descritiva, com chamada para agendar). ` +
      `Descreva técnica, cores e formato quando der para identificar. Termine as chamadas para ação convidando a agendar pelo link da bio ou pelo WhatsApp. ` +
      `Sugira de 10 a 15 hashtags relevantes do nicho de unhas no Brasil.`,
  });

  const response = await anthropic().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "medium", format: zodOutputFormat(CaptionSchema) },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Não foi possível gerar legendas para esta imagem. Tente outra descrição.");
  }
  return response.parsed_output;
}
