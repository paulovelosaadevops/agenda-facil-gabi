import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = "claude-opus-5-5";

// Se o modelo principal recusar por política, a API refaz a chamada num modelo de reserva.
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;

/** Lê ANTHROPIC_API_KEY (ou outra credencial do ambiente) na primeira chamada. */
export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}
