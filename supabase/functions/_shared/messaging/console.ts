import type { InboundMessage, MessagingProvider } from "./types.ts";

/**
 * Provedor de desenvolvimento: não envia nada, só registra no log do servidor.
 * O webhook aceita JSON simples: { "from": "5511999998888", "name": "Ana", "text": "Oi" }.
 */
export const consoleProvider: MessagingProvider = {
  name: "console",
  async sendText(to, body) {
    console.log(`\n[whatsapp:console] -> ${to}\n${body}\n`);
    return { providerMessageId: `console-${Date.now()}` };
  },
  async parseWebhook(request) {
    const body = (await request.json()) as Partial<InboundMessage>;
    if (!body.from || !body.text) return [];
    return [{ from: body.from, name: body.name, text: body.text }];
  },
};
