import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSlots, dayBounds, type Interval } from "./availability.ts";
import type { Business, Service, WorkingHours } from "./types.ts";

export class BookingError extends Error {}

export interface BusyTimes {
  /** Agendamentos ativos como [início, fim + intervalo) — o mesmo que o banco usa na restrição. */
  busy: Interval[];
  /** Folgas e bloqueios. */
  blocks: Interval[];
}

export async function loadBusy(db: SupabaseClient, businessId: string, range: Interval, ignoreId?: string): Promise<BusyTimes> {
  const [appts, off] = await Promise.all([
    db
      .from("appointments")
      .select("id, starts_at, blocked_until")
      .eq("business_id", businessId)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", range.end.toISOString())
      .gt("blocked_until", range.start.toISOString()),
    db
      .from("time_off")
      .select("starts_at, ends_at")
      .eq("business_id", businessId)
      .lt("starts_at", range.end.toISOString())
      .gt("ends_at", range.start.toISOString()),
  ]);
  if (appts.error) throw appts.error;
  if (off.error) throw off.error;
  return {
    busy: appts.data
      .filter((a) => a.id !== ignoreId)
      .map((a) => ({ start: new Date(a.starts_at), end: new Date(a.blocked_until) })),
    blocks: off.data.map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
  };
}

export async function loadWorkingHours(db: SupabaseClient, businessId: string): Promise<WorkingHours[]> {
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
  if (!data || data.archived) throw new BookingError("Serviço não encontrado.");
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
  const [workingHours, { busy, blocks }] = await Promise.all([
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
    blocks,
    bufferMin: business.buffer_min ?? 0,
    now,
    minAdvanceHours: business.min_advance_hours,
    maxAdvanceDays: business.max_advance_days,
    latestEnd: business.latest_end_time ?? undefined,
  });
}
