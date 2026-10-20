export interface InboundMessage {
  /** Telefone do remetente, só dígitos com DDI. */
  from: string;
  /** Nome do perfil do WhatsApp, quando o provedor informa. */
  name?: string;
  text: string;
  providerMessageId?: string;
}

/**
 * Contrato que todo provedor de WhatsApp implementa.
 * Para adicionar Meta Cloud API, Evolution API, Z-API etc., crie um arquivo neste diretório
 * implementando esta interface e registre-o em ./index.ts.
 */
export interface MessagingProvider {
  readonly name: string;
  sendText(to: string, body: string): Promise<{ providerMessageId?: string }>;
  /** Converte o corpo do webhook do provedor em mensagens recebidas (pode ser vazio: status, recibos...). */
  parseWebhook(request: Request): Promise<InboundMessage[]>;
}
