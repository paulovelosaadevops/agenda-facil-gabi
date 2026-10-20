"use server";

import { TZDate } from "@date-fns/tz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseDateKey } from "@/lib/availability";
import { requireBusiness } from "@/lib/auth";
import { BookingError, createBooking, findOrCreateClient, getAvailableSlots } from "@/lib/booking";
import { formatInTz, normalizePhone } from "@/lib/format";
import type { AppointmentStatus } from "@/lib/types";

export type AppointmentState = { error?: string; ok?: boolean } | undefined;

const Schema = z.object({
  client_id: z.string().optional(),
  new_client_name: z.string().trim().optional(),
  new_client_phone: z.string().optional(),
  service_id: z.string().uuid("Escolha um serviço."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário."),
  notes: z.string().trim().default(""),
  notify: z.string().optional(),
});

export async function createAppointment(_: AppointmentState, form: FormData): Promise<AppointmentState> {
  const parsed = Schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const { db, business } = await requireBusiness();

  let clientId = input.client_id;
  if (!clientId) {
    const phone = normalizePhone(input.new_client_phone ?? "");
    if (!input.new_client_name || !phone) return { error: "Escolha uma cliente ou informe nome e WhatsApp válidos." };
    clientId = (await findOrCreateClient(db, business.id, phone, input.new_client_name)).id;
  }

  const [y, m, d] = parseDateKey(input.date);
  const [hh, mm] = input.time.split(":").map(Number);
  const startsAt = new Date(new TZDate(y, m - 1, d, hh, mm, 0, business.timezone).getTime());

  try {
    await createBooking(db, {
      business,
      serviceId: input.service_id,
      clientId,
      startsAt,
      source: "panel",
      notes: input.notes,
      enforceRules: false, // a profissional pode encaixar fora do expediente
      notifyClient: input.notify === "on",
    });
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    throw err;
  }

  revalidatePath("/painel", "layout");
  return { ok: true };
}

/** Horários livres ("HH:MM") para sugerir no formulário. A profissional ainda pode digitar outro. */
export async function suggestSlots(serviceId: string, date: string): Promise<string[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !z.string().uuid().safeParse(serviceId).success) return [];
  const { db, business } = await requireBusiness();
  try {
    // Sem antecedência mínima: no painel ela pode encaixar em cima da hora.
    const slots = await getAvailableSlots(db, { ...business, min_advance_hours: 0 }, serviceId, date);
    return slots.map((s) => formatInTz(s, "HH:mm", business.timezone));
  } catch (err) {
    if (err instanceof BookingError) return [];
    throw err;
  }
}

const STATUSES: AppointmentStatus[] = ["pending", "confirmed", "completed", "cancelled", "no_show"];

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  if (!STATUSES.includes(status)) throw new Error("Status inválido");
  const { db, business } = await requireBusiness();
  const { error } = await db.from("appointments").update({ status }).eq("id", id).eq("business_id", business.id);
  if (error) {
    // Reativar um horário que já foi ocupado por outro agendamento.
    if (error.code === "23P01") return { error: "Esse horário já foi ocupado por outro agendamento." };
    return { error: error.message };
  }
  revalidatePath("/painel", "layout");
  return { ok: true };
}
