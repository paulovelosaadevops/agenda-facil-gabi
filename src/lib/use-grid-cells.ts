import { dayBounds, dayGrid, overlapsAny } from "@shared/availability.ts";
import { formatInTz } from "@shared/format.ts";
import { loadBusy, loadWorkingHours } from "@shared/slots.ts";
import type { Business } from "@shared/types.ts";
import { supabase } from "./supabase";
import { useQuery } from "./use-query";

export type CellStatus = "free" | "booked" | "blocked";

export interface GridCell {
  label: string; // "09:30"
  start: Date;
  end: Date;
  status: CellStatus;
}

/** Grade do expediente de cada dia (só horários que ainda não começaram), com o que já ocupa cada um. */
export function useGridCells(business: Business, dates: string[]) {
  const tz = business.timezone;
  return useQuery(async () => {
    if (!dates.length) return {} as Record<string, GridCell[]>;
    const range = { start: dayBounds(dates[0], tz).start, end: dayBounds(dates[dates.length - 1], tz).end };
    const [hours, { busy, blocks }] = await Promise.all([loadWorkingHours(supabase, business.id), loadBusy(supabase, business.id, range)]);
    const now = new Date();
    return Object.fromEntries(
      dates.map((date) => [
        date,
        dayGrid(date, tz, hours, business.slot_interval_min)
          .filter((cell) => cell.start > now)
          .map((cell): GridCell => ({
            ...cell,
            label: formatInTz(cell.start, "HH:mm", tz),
            status: overlapsAny(cell, blocks) ? "blocked" : overlapsAny(cell, busy) ? "booked" : "free",
          })),
      ]),
    );
  }, [business.id, tz, business.slot_interval_min, dates.join()]);
}
