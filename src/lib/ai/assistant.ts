import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { TZDate } from "@date-fns/tz";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { parseDateKey, toDateKey } from "@/lib/availability";
import { BookingError, createBooking, findOrCreateClient, getAvailableSlots } from "@/lib/booking";
import { formatDuration, formatInTz, formatMoney } from "@/lib/format";
import type { Business, Service } from "@/lib/types";
import { AI_MODEL, anthropic, FALLBACK_BETA } from "./client";

const HISTORY_WINDOW_HOURS = 24;
const HISTORY_MAX_MESSAGES = 20;

const SYSTEM_PROMPT = `Você é a assistente virtual de atendimento de um estúdio de unhas (nail designer), conversando com clientes pelo WhatsApp.

Seu trabalho:
- Responder dúvidas sobre serviços, preços e duração usando a ferramenta listar_servicos. Nunca invente serviços, preços ou horários.
- Agendar: descubra o serviço e o dia desejados, consulte horarios_disponiveis, ofereça algumas opções e só chame agendar depois que a cliente escolher um horário específico. Se ainda não souber o nome da cliente, pergunte antes de agendar.
- Consultar e cancelar agendamentos da própria cliente (meus_agendamentos, cancelar_agendamento). Confirme com a cliente antes de cancelar.
- Para remarcar: agende o novo horário primeiro e depois cancele o antigo.
- Se pedirem algo fora disso (reclamação, orçamento de arte personalizada, assunto pessoal), diga com gentileza que a profissional vai responder pessoalmente assim que puder.

Estilo: português do Brasil, simpático e acolhedor, mensagens curtas como numa conversa de WhatsApp. Use no máximo um emoji por mensagem. Use *negrito* do WhatsApp para destacar data e horário; não use markdown com # ou listas longas.`;

interface ChatContext {
  db: SupabaseClient;
  business: Business;
  phone: string;
  profileName?: string;
}

function describeService(s: Service): string {
  return `- ${s.name} (id: ${s.id}) — ${formatMoney(s.price_cents)}, ${formatDuration(s.duration_min)}${s.description ? `. ${s.description}` : ""}`;
}

/** "2026-10-22T14:30" no fuso do negócio -> instante UTC. */
function parseLocalDateTime(value: string, timeZone: string): Date {
  const m = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new BookingError("Formato de horário inválido; use AAAA-MM-DDTHH:MM.");
  const [y, mo, d] = parseDateKey(m[1]);
  return new Date(new TZDate(y, mo - 1, d, Number(m[2]), Number(m[3]), 0, timeZone).getTime());
}

function buildTools(ctx: ChatContext) {
  const { db, business, phone } = ctx;
  const tzName = business.timezone;

  const listarServicos = betaZodTool({
    name: "listar_servicos",
    description: "Lista os serviços ativos do estúdio com id, preço, duração e descrição.",
    inputSchema: z.object({}),
    run: async () => {
      const { data, error } = await db
        .from("services")
        .select("*")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data.length ? data.map(describeService).join("\n") : "Nenhum serviço cadastrado.";
    },
  });

  const horariosDisponiveis = betaZodTool({
    name: "horarios_disponiveis",
    description:
      "Retorna os horários de início livres para um serviço em um dia. Consulte antes de oferecer horários à cliente.",
    inputSchema: z.object({
      servico_id: z.string().describe("id do serviço, obtido em listar_servicos"),
      data: z.string().describe("dia no formato AAAA-MM-DD"),
    }),
    run: async ({ servico_id, data }) => {
      try {
        const slots = await getAvailableSlots(db, business, servico_id, data);
        if (!slots.length) return `Sem horários livres em ${data}.`;
        return `Horários livres em ${data}: ${slots.map((s) => formatInTz(s, "HH:mm", tzName)).join(", ")}`;
      } catch (err) {
        if (err instanceof BookingError) return err.message;
        throw err;
      }
    },
  });

  const agendar = betaZodTool({
    name: "agendar",
    description: "Cria o agendamento da cliente desta conversa. Use só depois que ela escolher serviço e horário.",
    inputSchema: z.object({
      servico_id: z.string(),
      inicio: z.string().describe("data e hora local de início, formato AAAA-MM-DDTHH:MM"),
      nome_cliente: z.string().describe("nome da cliente"),
    }),
    run: async ({ servico_id, inicio, nome_cliente }) => {
      try {
        const client = await findOrCreateClient(db, business.id, phone, nome_cliente);
        const { appointment, service } = await createBooking(db, {
          business,
          serviceId: servico_id,
          clientId: client.id,
          startsAt: parseLocalDateTime(inicio, tzName),
          source: "whatsapp",
          enforceRules: true,
          notifyClient: false, // a própria resposta da conversa confirma
        });
        return `Agendado: ${service.name} em ${formatInTz(appointment.starts_at, "EEEE, dd/MM 'às' HH:mm", tzName)} (id ${appointment.id}).`;
      } catch (err) {
        if (err instanceof BookingError) return `Não foi possível agendar: ${err.message}`;
        throw err;
      }
    },
  });

  const meusAgendamentos = betaZodTool({
    name: "meus_agendamentos",
    description: "Lista os próximos agendamentos da cliente desta conversa.",
    inputSchema: z.object({}),
    run: async () => {
      const { data, error } = await db
        .from("appointments")
        .select("id, starts_at, status, services(name), clients!inner(phone)")
        .eq("business_id", business.id)
        .eq("clients.phone", phone)
        .in("status", ["pending", "confirmed"])
        .gte("starts_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      if (!data.length) return "A cliente não tem agendamentos futuros.";
      return data
        .map((a) => {
          const service = a.services as unknown as { name: string } | null;
          return `- ${service?.name ?? "Serviço"} em ${formatInTz(a.starts_at, "EEEE, dd/MM 'às' HH:mm", tzName)} (id ${a.id})`;
        })
        .join("\n");
    },
  });

  const cancelarAgendamento = betaZodTool({
    name: "cancelar_agendamento",
    description: "Cancela um agendamento futuro da cliente desta conversa. Confirme com ela antes.",
    inputSchema: z.object({ agendamento_id: z.string() }),
    run: async ({ agendamento_id }) => {
      // Só cancela se o agendamento for desta cliente (telefone da conversa).
      const { data: appt, error } = await db
        .from("appointments")
        .select("id, clients!inner(phone)")
        .eq("business_id", business.id)
        .eq("id", agendamento_id)
        .eq("clients.phone", phone)
        .in("status", ["pending", "confirmed"])
        .maybeSingle();
      if (error) throw error;
      if (!appt) return "Agendamento não encontrado para esta cliente.";
      const { error: updateError } = await db
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appt.id);
      if (updateError) throw updateError;
      return "Agendamento cancelado.";
    },
  });

  return [listarServicos, horariosDisponiveis, agendar, meusAgendamentos, cancelarAgendamento];
}

/** Histórico recente da conversa como turnos de texto (sem blocos de ferramenta). */
async function loadHistory(ctx: ChatContext): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const since = new Date(Date.now() - HISTORY_WINDOW_HOURS * 3_600_000).toISOString();
  const { data, error } = await ctx.db
    .from("messages")
    .select("direction, body")
    .eq("business_id", ctx.business.id)
    .eq("phone", ctx.phone)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(HISTORY_MAX_MESSAGES);
  if (error) throw error;

  const turns: Anthropic.Beta.BetaMessageParam[] = [];
  for (const row of data.reverse()) {
    const role = row.direction === "in" ? "user" : "assistant";
    const last = turns.at(-1);
    if (last && last.role === role) last.content = `${last.content}\n\n${row.body}`;
    else turns.push({ role, content: row.body });
  }
  while (turns[0]?.role === "assistant") turns.shift(); // a conversa precisa começar pela cliente
  return turns;
}

/**
 * Gera a resposta da IA para a última mensagem da cliente.
 * Espera que a mensagem recebida já tenha sido gravada em `messages`.
 */
export async function replyToClient(ctx: ChatContext): Promise<string> {
  const history = await loadHistory(ctx);
  if (history.at(-1)?.role !== "user") throw new Error("Nenhuma mensagem da cliente para responder.");

  const { data: client } = await ctx.db
    .from("clients")
    .select("name")
    .eq("business_id", ctx.business.id)
    .eq("phone", ctx.phone)
    .maybeSingle();

  const now = new Date();
  const tzName = ctx.business.timezone;
  const businessContext = [
    `Estúdio: ${ctx.business.name}.`,
    ctx.business.address ? `Endereço: ${ctx.business.address}.` : "",
    `Agora são ${formatInTz(now, "EEEE, dd/MM/yyyy HH:mm", tzName)} (hoje = ${toDateKey(now, tzName)}).`,
    client
      ? `A cliente já é cadastrada como "${client.name}".`
      : `Cliente nova${ctx.profileName ? `; o nome no perfil do WhatsApp é "${ctx.profileName}" (confirme antes de usar)` : ""}.`,
    ctx.business.ai_instructions ? `Instruções da profissional:\n${ctx.business.ai_instructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const finalMessage = await anthropic().beta.messages.toolRunner({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    // Conversa de atendimento: esforço baixo mantém respostas rápidas e baratas.
    output_config: { effort: "low" },
    max_iterations: 8,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: businessContext },
    ],
    tools: buildTools(ctx),
    messages: history,
  });

  if (finalMessage.stop_reason === "refusal") {
    return "Desculpe, não consegui ajudar com isso por aqui. A profissional vai te responder pessoalmente em breve. 💅";
  }

  const text = finalMessage.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || "Recebi sua mensagem! A profissional vai te responder em breve. 💅";
}
