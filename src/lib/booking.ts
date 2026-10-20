import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSlots, dayBounds, fitsWorkingHours, type Interval } from "@/lib/availability";
import { formatInTz } from "@/lib/format";
import { sendMessage } from "@/lib/messaging";
import type { AppointmentSource, Business, Client, Service, WorkingHours } from "@/lib/types";

export class BookingError extends Error {}

async function loadBusy(db: SupabaseClient, businessId: string, range: Interval, ignoreId?: string): Promise<Interval[]> {
  const [appts, off] = await Promise.all([
    db
      .from("appointments")
      .select("id, starts_at, ends_at")
      .eq("business_id", businessId)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", range.end.toISOString())
      .gt("ends_at", range.start.toISOString()),
    db
      .from("time_off")
      .select("starts_at, ends_at")
      .eq("business_id", businessId)
      .lt("starts_at", range.end.toISOString())
      .gt("ends_at", range.start.toISOString()),
  ]);
  if (appts.error) throw appts.error;
  if (off.error) throw off.error;
  return [...appts.data.filter((a) => a.id !== ignoreId), ...off.data].map((r) => ({
    start: new Date(r.starts_at),
    end: new Date(r.ends_at),
  }));
}

async function loadWorkingHours(db: SupabaseClient, businessId: string): Promise<WorkingHours[]> {
  const { data, error } = await db.from("working_hours").select("*").eq("business_id", businessId);
  if (error) throw error;
  return data;
}

export async function getService(db: SupabaseClient, businessId: string, serviceId: string): Promise<Service> {
  const { data, error } = await db
    .from("services")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", serviceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new BookingError("Serviço não encontrado.");
  return data;
}

/** Horários livres de um serviço em um dia ("YYYY-MM-DD", calendário local do negócio). */
export async function getAvailableSlots(
  db: SupabaseClient,
  business: Business,
  serviceId: string,
  date: string,
  now = new Date(),
): Promise<Date[]> {
  const service = await getService(db, business.id, serviceId);
  const range = dayBounds(date, business.timezone);
  const [workingHours, busy] = await Promise.all([
    loadWorkingHours(db, business.id),
    loadBusy(db, business.id, range),
  ]);
  return computeSlots({
    date,
    timeZone: business.timezone,
    durationMin: service.duration_min,
    slotIntervalMin: business.slot_interval_min,
    workingHours,
    busy,
    now,
    minAdvanceHours: business.min_advance_hours,
    maxAdvanceDays: business.max_advance_days,
  });
}

export async function findOrCreateClient(
  db: SupabaseClient,
  businessId: string,
  phone: string,
  name: string,
): Promise<Client> {
  const { data: existing, error } = await db
    .from("clients")
    .select("*")
    .eq("business_id", businessId)
    .eq("phone", phone)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data, error: insertError } = await db
    .from("clients")
    .insert({ business_id: businessId, phone, name: name.trim() || "Cliente" })
    .select()
    .single();
  if (insertError) throw insertError;
  return data;
}

export interface CreateBookingInput {
  business: Business;
  serviceId: string;
  clientId: string;
  startsAt: Date;
  source: AppointmentSource;
  notes?: string;
  /** Painel pode encaixar fora do expediente/antecedência; cliente e IA não. */
  enforceRules: boolean;
  notifyClient: boolean;
}

export async function createBooking(db: SupabaseClient, input: CreateBookingInput) {
  const { business } = input;
  const service = await getService(db, business.id, input.serviceId);
  if (!service.active && input.enforceRules) throw new BookingError("Este serviço não está disponível.");

  const startsAt = input.startsAt;
  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);

  if (input.enforceRules) {
    const now = Date.now();
    if (startsAt.getTime() < now + business.min_advance_hours * 3_600_000) {
      throw new BookingError(`Agendamentos precisam de pelo menos ${business.min_advance_hours}h de antecedência.`);
    }
    if (startsAt.getTime() > now + business.max_advance_days * 86_400_000) {
      throw new BookingError(`Só é possível agendar com até ${business.max_advance_days} dias de antecedência.`);
    }
    const workingHours = await loadWorkingHours(db, business.id);
    if (!fitsWorkingHours(startsAt, service.duration_min, business.timezone, workingHours)) {
      throw new BookingError("Esse horário está fora do expediente.");
    }
  }

  const busy = await loadBusy(db, business.id, { start: startsAt, end: endsAt });
  if (busy.length) throw new BookingError("Esse horário acabou de ser ocupado. Escolha outro.");

  const { data, error } = await db
    .from("appointments")
    .insert({
      business_id: business.id,
      client_id: input.clientId,
      service_id: service.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "confirmed",
      source: input.source,
      price_cents: service.price_cents,
      notes: input.notes ?? "",
    })
    .select("*, clients(id, name, phone)")
    .single();

  if (error) {
    // 23P01 = violação da restrição de exclusão (horário sobreposto em corrida).
    if (error.code === "23P01") throw new BookingError("Esse horário acabou de ser ocupado. Escolha outro.");
    throw error;
  }

  if (input.notifyClient && data.clients) {
    const when = formatInTz(startsAt, "EEEE, dd/MM 'às' HH:mm", business.timezone);
    await sendMessage(db, {
      business,
      clientId: data.clients.id,
      phone: data.clients.phone,
      kind: "confirmation",
      body:
        `Olá, ${data.clients.name.split(" ")[0]}! 💅 Seu horário de *${service.name}* com ${business.name} ` +
        `está confirmado para ${when}.` +
        (business.address ? `\n📍 ${business.address}` : "") +
        `\n\nSe precisar remarcar, é só responder esta mensagem.`,
    }).catch((err) => console.error("Falha ao enviar confirmação", err));
  }

  return { appointment: data, service };
}
