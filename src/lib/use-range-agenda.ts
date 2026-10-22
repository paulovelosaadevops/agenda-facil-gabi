import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { dayBounds, toDateKey } from "@shared/availability.ts";
import type { AppointmentWithRefs, Business } from "@shared/types.ts";
import { supabase } from "./supabase";
import { useQuery } from "./use-query";

export type AgendaView = "dia" | "semana" | "mes";

/** Dias (YYYY-MM-DD) da semana (dom–sáb) ou do mês que contém `date`. */
export function rangeDays(view: AgendaView, date: string, timeZone: string): string[] {
  const noon = new Date(dayBounds(date, timeZone).start.getTime() + 12 * 3_600_000);
  const local = new TZDate(noon.getTime(), timeZone);
  if (view === "dia") return [date];
  if (view === "semana") {
    const sunday = addDays(noon, -local.getDay());
    return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(sunday, i), timeZone));
  }
  const first = new Date(new TZDate(local.getFullYear(), local.getMonth(), 1, 12, 0, 0, timeZone).getTime());
  const daysInMonth = new TZDate(local.getFullYear(), local.getMonth() + 1, 0, 12, 0, 0, timeZone).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => toDateKey(addDays(first, i), timeZone));
}

/** Agendamentos de um conjunto de dias, agrupados por dia. */
export function useRangeAgenda(business: Business, days: string[]) {
  const tz = business.timezone;
  return useQuery(async () => {
    const start = dayBounds(days[0], tz).start;
    const end = dayBounds(days[days.length - 1], tz).end;
    const { data, error } = await supabase
      .from("appointments")
      .select("*, clients(id, name, phone), services(id, name, duration_min)")
      .eq("business_id", business.id)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at")
      .returns<AppointmentWithRefs[]>();
    if (error) throw error;
    const byDay = new Map<string, AppointmentWithRefs[]>();
    for (const a of data) {
      const key = toDateKey(new Date(a.starts_at), tz);
      byDay.set(key, [...(byDay.get(key) ?? []), a]);
    }
    return { all: data, byDay };
  }, [days[0], days[days.length - 1]]);
}

export const isActive = (a: AppointmentWithRefs) => a.status !== "cancelled" && a.status !== "no_show";
