import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { toDateKey } from "@shared/availability.ts";
import { formatInTz } from "@shared/format.ts";
import type { Service } from "@shared/types.ts";
import { callFunction } from "./supabase";
import { useQuery } from "./use-query";

export type PublicService = Pick<Service, "id" | "name" | "description" | "duration_min" | "price_cents" | "combo_service_ids" | "category">;

export interface StudioInfo {
  business: { name: string; slug: string; address: string | null; phone: string | null; timezone: string; max_advance_days: number };
  services: PublicService[];
}

/** Dados públicos do estúdio e serviços visíveis (vale com ou sem login). */
export function useStudioInfo() {
  return useQuery(() => callFunction<StudioInfo>("public-booking", { action: "info" }));
}

export interface DayOption {
  key: string;
  weekday: string;
  day: string;
  month: string;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Próximos dias que podem ser agendados (até `limit`), no fuso do estúdio. */
export function buildDays(timeZone: string, maxAdvanceDays: number, limit = 30): DayOption[] {
  const now = new Date();
  return Array.from({ length: Math.min(limit, maxAdvanceDays + 1) }, (_, i) => {
    const date = addDays(now, i);
    return {
      key: toDateKey(date, timeZone),
      weekday: i === 0 ? "Hoje" : WEEKDAYS[new TZDate(date.getTime(), timeZone).getDay()],
      day: formatInTz(date, "d", timeZone),
      month: formatInTz(date, "MMMM 'de' yyyy", timeZone),
    };
  });
}
