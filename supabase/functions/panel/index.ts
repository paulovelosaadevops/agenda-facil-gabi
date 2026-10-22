// Ações do painel que precisam do servidor: confirmação no WhatsApp, IA e simulador.
// O resto do painel fala direto com o banco (protegido por RLS).
import Anthropic from "@anthropic-ai/sdk";
import { TZDate } from "@date-fns/tz";
import { z } from "zod";
import { generateCaptions, isSupportedImage } from "../_shared/ai/captions.ts";
import { parseDateKey } from "../_shared/availability.ts";
import { BookingError, createBooking, upsertClientProfile } from "../_shared/booking.ts";
import { getEnv } from "../_shared/env.ts";
import { normalizePhone } from "../_shared/format.ts";
import { calendarUrl } from "../_shared/calendar.ts";
import { pushToOwner } from "../_shared/push.ts";
import { handler, HttpError, json, readJson, requireOwner } from "../_shared/http.ts";
import { handleInbound } from "../_shared/inbound.ts";
import { SIMULATOR_PHONE } from "../_shared/simulator.ts";

const MAX_IMAGE_BASE64 = 7_000_000; // ~5 MB de imagem

const Request = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-appointment"),
    clientId: z.string().uuid().optional(),
    // Cliente nova: todos os dados são obrigatórios (regra do estúdio).
    newClient: z
      .object({
        name: z.string().trim().min(2, "Informe o nome da cliente."),
        phone: z.string(),
        whatsapp: z.boolean(),
        instagram: z.string().trim().min(2, "Informe o Instagram da cliente."),
        email: z.string().trim().email("E-mail da cliente inválido."),
      })
      .optional(),
    serviceId: z.string().uuid("Escolha um serviço."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário."),
    notes: z.string().trim().max(1000).default(""),
    notify: z.boolean().default(true),
  }),
  z.object({ action: z.literal("calendar-url"), appointmentId: z.string().uuid() }),
  z.object({ action: z.literal("push-test") }),
  z.object({ action: z.literal("simulator-send"), text: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal("simulator-reset") }),
  z.object({
    action: z.literal("captions"),
    description: z.string().trim().max(1000).default(""),
    tone: z.string().max(80).default("delicado e elegante"),
    image: z.object({ base64: z.string().max(MAX_IMAGE_BASE64, "A foto deve ter até 5 MB."), mediaType: z.string() }).optional(),
  }),
]);

function aiError(err: unknown): never {
  if (err instanceof Anthropic.AuthenticationError) throw new HttpError(502, "Chave da API da Anthropic inválida.");
  if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, "Muitas requisições à IA agora. Tente de novo em instantes.");
  if (err instanceof Anthropic.APIError) throw new HttpError(502, `A IA está indisponível no momento (erro ${err.status}).`);
  throw err;
}

function requireAi() {
  if (!getEnv("ANTHROPIC_API_KEY")) throw new HttpError(503, "A IA ainda não foi configurada no servidor (ANTHROPIC_API_KEY).");
}

Deno.serve(
  handler(async (req) => {
    const { db, business } = await requireOwner(req);
    const parsed = Request.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const input = parsed.data;

    switch (input.action) {
      case "create-appointment": {
        let clientId = input.clientId;
        if (!clientId) {
          const phone = input.newClient && normalizePhone(input.newClient.phone);
          if (!input.newClient || !phone) throw new HttpError(400, "Escolha uma cliente ou preencha os dados da cliente nova.");
          try {
            clientId = (await upsertClientProfile(db, business.id, { ...input.newClient, phone })).id;
          } catch (err) {
            if (err instanceof BookingError) throw new HttpError(409, err.message);
            throw err;
          }
        } else {
          // Garante que a cliente é deste estúdio (o admin client ignora RLS).
          const { data } = await db.from("clients").select("id").eq("id", clientId).eq("business_id", business.id).maybeSingle();
          if (!data) throw new HttpError(404, "Cliente não encontrada.");
        }
        const [y, m, d] = parseDateKey(input.date);
        const [hh, mm] = input.time.split(":").map(Number);
        try {
          const { appointment } = await createBooking(db, {
            business,
            serviceId: input.serviceId,
            clientId,
            startsAt: new Date(new TZDate(y, m - 1, d, hh, mm, 0, business.timezone).getTime()),
            source: "panel",
            notes: input.notes,
            enforceRules: false, // a profissional pode encaixar fora do expediente
            notifyClient: input.notify,
          });
          return json({ id: appointment.id });
        } catch (err) {
          if (err instanceof BookingError) throw new HttpError(409, err.message);
          throw err;
        }
      }

      case "calendar-url": {
        // Só agendamentos do próprio estúdio (a RLS da dona garante).
        const { data: appt } = await db.from("appointments").select("id").eq("id", input.appointmentId).eq("business_id", business.id).maybeSingle();
        if (!appt) throw new HttpError(404, "Agendamento não encontrado.");
        return json({ url: await calendarUrl(appt.id, "gabi") });
      }

      case "push-test": {
        const sent = await pushToOwner(db, business.id, {
          title: "Notificações ativadas",
          body: "Você vai receber aqui cada agendamento novo feito pelo link.",
          url: "/inicio/notificacoes",
          tag: "teste",
        });
        return json({ sent });
      }

      case "simulator-send": {
        requireAi();
        if (!business.ai_enabled) throw new HttpError(400, "A atendente está desligada em Ajustes › Atendente virtual.");
        try {
          const reply = await handleInbound(
            db,
            business,
            { from: SIMULATOR_PHONE, text: input.text, name: "Cliente de teste" },
            { deliver: false, provider: "simulator" },
          );
          return json({ reply });
        } catch (err) {
          aiError(err);
        }
      }

      case "simulator-reset": {
        await db.from("messages").delete().eq("business_id", business.id).eq("phone", SIMULATOR_PHONE);
        return json({ ok: true });
      }

      case "captions": {
        requireAi();
        if (!input.image && !input.description) throw new HttpError(400, "Envie uma foto ou descreva o trabalho.");
        if (input.image && !isSupportedImage(input.image.mediaType)) throw new HttpError(400, "Use foto JPG, PNG, WEBP ou GIF.");
        try {
          const result = await generateCaptions({
            businessName: business.name,
            description: input.description,
            tone: input.tone,
            image: input.image && isSupportedImage(input.image.mediaType)
              ? { base64: input.image.base64, mediaType: input.image.mediaType }
              : undefined,
          });
          return json(result);
        } catch (err) {
          aiError(err);
        }
      }
    }
  }),
);
