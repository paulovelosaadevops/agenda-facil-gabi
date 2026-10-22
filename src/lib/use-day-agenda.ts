import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { dayBounds, toDateKey } from "@shared/availability.ts";
import type { AppointmentWithRefs, Business } from "@shared/types.ts";
import { supabase } from "./supabase";
import { useQuery } from "./use-query";

/** Agendamentos de um dia + dias da semana que têm atendimento (bolinhas da faixa). */
export function useDayAgenda(business: Business, date: string) {
  const tz = business.timezone;
  return useQuery(async () => {
    const { start, end } = dayBounds(date, tz);
    const noon = new Date(start.getTime() + 12 * 3_600_000);
    const sunday = toDateKey(addDays(noon, -new TZDate(noon.getTime(), tz).getDay()), tz);
    const weekStart = dayBounds(sunday, tz).start;

    const [appts, week] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, clients(id, name, phone), services(id, name, duration_min)")
        .eq("business_id", business.id)
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString())
        .order("starts_at")
        .returns<AppointmentWithRefs[]>(),
      supabase
        .from("appointments")
        .select("starts_at")
        .eq("business_id", business.id)
        .in("status", ["pending", "confirmed", "completed"])
        .gte("starts_at", weekStart.toISOString())
        .lt("starts_at", addDays(weekStart, 7).toISOString()),
    ]);
    if (appts.error) throw appts.error;
    return {
      list: appts.data,
      busyDays: new Set((week.data ?? []).map((a) => toDateKey(new Date(a.starts_at), tz))),
    };
  }, [date]);
}
