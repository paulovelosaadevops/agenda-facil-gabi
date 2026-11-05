// Agendamento pelas clientes. Ver serviços e horários é público; agendar exige a cliente identificada:
// com senha ou, pelo link, com o código enviado ao e-mail (login sem senha), que cria a conta na primeira vez.
import { z } from "zod";
import { BookingError, createBooking, getAvailableSlots } from "../_shared/booking.ts";
import { calendarUrl } from "../_shared/calendar.ts";
import { formatInTz, normalizePhone } from "../_shared/format.ts";
import { ensureClientAccount, type NewClientData } from "../_shared/client-account.ts";
import { adminClient, handler, HttpError, json, loadStudio, publicClient, readJson, requireClient } from "../_shared/http.ts";

const Request = z.discriminatedUnion("action", [
  z.object({ action: z.literal("info"), slug: z.string().optional() }),
  z.object({
    action: z.literal("slots"),
    slug: z.string().optional(),
    serviceId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    action: z.literal("book"),
    serviceId: z.string().uuid(),
    startsAt: z.string().datetime(),
    notes: z.string().trim().max(500).default(""),
    // Dados de quem é nova (ou ficou sem ficha): criam a ficha se ainda não existir.
    profile: z
      .object({
        name: z.string().trim().min(3).max(120),
        phone: z.string().trim().min(8).max(20),
        whatsapp: z.boolean(),
        instagram: z.string().trim().min(2).max(60),
      })
      .optional(),
  }),
  // O e-mail já é de uma cliente com conta? Decide se o link pede só o código ou também os dados.
  z.object({ action: z.literal("lookup"), email: z.string().trim().toLowerCase().email() }),
  // Login sem autocadastro: o servidor garante a conta (cria/liga à ficha) e envia o código por e-mail.
  z.object({
    action: z.literal("request-code"),
    email: z.string().trim().toLowerCase().email(),
    // Primeira vez: dados obrigatórios (D2). Quem já tem ficha (inclusive cadastrada pela Nail) não precisa.
    profile: z
      .object({
        name: z.string().trim().min(3).max(120),
        phone: z.string().trim().min(8).max(20),
        whatsapp: z.boolean(),
        instagram: z.string().trim().min(2).max(60),
      })
      .optional(),
  }),
  z.object({ action: z.literal("my-calendar"), appointmentId: z.string().uuid() }),
]);

Deno.serve(
  handler(async (req) => {
    const parsed = Request.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const input = parsed.data;

    try {
      if (input.action === "my-calendar") {
        // Painel da cliente: só os horários dela.
        const { client } = await requireClient(req);
        const { data: appt } = await adminClient()
          .from("appointments")
          .select("id")
          .eq("id", input.appointmentId)
          .eq("client_id", client.id)
          .maybeSingle();
        if (!appt) throw new HttpError(404, "Agendamento não encontrado.");
        return json({ url: await calendarUrl(appt.id, "cliente") });
      }

      if (input.action === "lookup") {
        // Só responde se existe e se tem senha: nenhum dado da cliente sai daqui.
        const db = adminClient();
        const { data: client } = await db
          .from("clients")
          .select("user_id")
          .eq("email", input.email)
          .not("user_id", "is", null)
          .limit(1)
          .maybeSingle();
        if (!client) return json({ exists: false, hasPassword: false });
        const { data } = await db.auth.admin.getUserById(client.user_id);
        return json({ exists: true, hasPassword: Boolean(data.user?.user_metadata?.has_password) });
      }

      if (input.action === "request-code") {
        const db = adminClient();
        let profile: NewClientData | undefined;
        if (input.profile) {
          const phone = normalizePhone(input.profile.phone);
          if (!phone) throw new HttpError(400, "Telefone inválido. Use DDD + número.");
          profile = { ...input.profile, phone, instagram: input.profile.instagram.replace(/^@?/, "@") };
        }
        const result = await ensureClientAccount(db, await loadStudio(db), input.email, profile);
        if (result.needsProfile) return json({ needsProfile: true });

        // A conta já existe (criada acima): o código nunca cria conta (shouldCreateUser: false).
        const { error } = await publicClient().auth.signInWithOtp({ email: input.email, options: { shouldCreateUser: false } });
        if (error) {
          if (/rate|seconds|security purposes/i.test(error.message)) throw new HttpError(429, "Aguarde alguns segundos para pedir outro código.");
          throw new HttpError(502, "Não foi possível enviar o código. Confira o e-mail e tente de novo.");
        }
        return json({ needsProfile: false, sent: true });
      }

      if (input.action === "book") {
        const profile = input.profile && { ...input.profile, phone: normalizePhone(input.profile.phone) ?? input.profile.phone };
        const { db, client, business } = await requireClient(req, profile);
        const startsAt = new Date(input.startsAt);
        const { calendar } = await createBooking(db, {
          business,
          serviceId: input.serviceId,
          clientId: client.id,
          startsAt,
          source: "public",
          notes: input.notes,
          enforceRules: true,
          onePerDay: true,
          notifyClient: true,
        });
        return json({ ok: true, when: formatInTz(startsAt, "EEEE, dd/MM 'às' HH:mm", business.timezone), calendarUrl: calendar.cliente });
      }

      const db = adminClient();

      const business = await loadStudio(db, input.slug);

      if (input.action === "info") {
        const { data: services } = await db
          .from("services")
          .select("id, name, description, duration_min, price_cents, combo_service_ids, category, feet")
          .eq("business_id", business.id)
          .eq("active", true)
          .eq("archived", false)
          .order("name");
        const { name, slug, address, phone, timezone, max_advance_days } = business;
        return json({ business: { name, slug, address, phone, timezone, max_advance_days }, services: services ?? [] });
      }

      const slots = await getAvailableSlots(db, business, input.serviceId, input.date);
      return json({ slots: slots.map((s) => s.toISOString()) });
    } catch (err) {
      if (err instanceof BookingError) throw new HttpError(409, err.message);
      throw err;
    }
  }),
);
