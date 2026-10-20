"use server";

import { z } from "zod";
import { BookingError, createBooking, findOrCreateClient, getAvailableSlots } from "@/lib/booking";
import { formatInTz, normalizePhone } from "@/lib/format";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

// Fluxo público: não há usuária logada, então usa service role e sempre filtra pelo negócio do slug.

async function loadBusiness(slug: string) {
  const db = createSupabaseAdmin();
  const { data } = await db.from("businesses").select("*").eq("slug", slug).maybeSingle<Business>();
  if (!data) throw new BookingError("Estúdio não encontrado.");
  return { db, business: data };
}

export async function fetchSlots(slug: string, serviceId: string, date: string): Promise<{ slots?: string[]; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !z.string().uuid().safeParse(serviceId).success) return { error: "Dados inválidos." };
  try {
    const { db, business } = await loadBusiness(slug);
    const slots = await getAvailableSlots(db, business, serviceId, date);
    return { slots: slots.map((s) => s.toISOString()) };
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    throw err;
  }
}

const BookSchema = z.object({
  serviceId: z.string().uuid(),
  startsAt: z.string().datetime(),
  name: z.string().trim().min(2, "Informe seu nome.").max(80),
  phone: z.string(),
  notes: z.string().trim().max(500).default(""),
});

export type BookResult = { ok: true; when: string } | { ok: false; error: string };

export async function book(slug: string, input: z.input<typeof BookSchema>): Promise<BookResult> {
  const parsed = BookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { ok: false, error: "WhatsApp inválido. Informe DDD + número." };

  try {
    const { db, business } = await loadBusiness(slug);
    const client = await findOrCreateClient(db, business.id, phone, parsed.data.name);
    const startsAt = new Date(parsed.data.startsAt);
    await createBooking(db, {
      business,
      serviceId: parsed.data.serviceId,
      clientId: client.id,
      startsAt,
      source: "public",
      notes: parsed.data.notes,
      enforceRules: true,
      notifyClient: true,
    });
    return { ok: true, when: formatInTz(startsAt, "EEEE, dd/MM 'às' HH:mm", business.timezone) };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message };
    throw err;
  }
}
