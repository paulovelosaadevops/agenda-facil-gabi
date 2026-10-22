import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { dayBounds, toDateKey } from "@shared/availability.ts";
import type { AppointmentWithRefs, Business, MaintenanceAlert } from "@shared/types.ts";
import { supabase } from "./supabase";
import { useQuery } from "./use-query";

const SELECT = "*, clients(id, name, phone), services(id, name, duration_min)";

/** Dados da tela Início: agenda de hoje, próximo atendimento e números do mês. */
export function useDashboard(business: Business) {
  const tz = business.timezone;
  return useQuery(async () => {
    const now = new Date();
    const today = dayBounds(toDateKey(now, tz), tz);
    const local = new TZDate(now.getTime(), tz);
    const monthStart = new Date(new TZDate(local.getFullYear(), local.getMonth(), 1, 0, 0, 0, tz).getTime());
    const base = () => supabase.from("appointments").select(SELECT).eq("business_id", business.id);

    const [todayRes, nextRes, monthRes, weekRes, birthdaysRes, maintenanceRes, newClientsRes] = await Promise.all([
      base().gte("starts_at", today.start.toISOString()).lt("starts_at", today.end.toISOString()).order("starts_at").returns<AppointmentWithRefs[]>(),
      base().in("status", ["pending", "confirmed"]).gte("starts_at", now.toISOString()).order("starts_at").limit(1).returns<AppointmentWithRefs[]>(),
      // Mês: atendimentos realizados (faturamento e ticket médio).
      supabase
        .from("appointments")
        .select("price_cents")
        .eq("business_id", business.id)
        .eq("status", "completed")
        .gte("starts_at", monthStart.toISOString()),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .in("status", ["pending", "confirmed"])
        .gte("starts_at", now.toISOString())
        .lt("starts_at", addDays(today.start, 7).toISOString()),
      supabase.from("clients").select("id, name, birthday").eq("business_id", business.id).not("birthday", "is", null),
      // Retornos de manutenção cujo aviso já chegou (próximos e atrasados).
      supabase
        .from("maintenance_alerts")
        .select("*")
        .eq("business_id", business.id)
        .lte("notify_at", now.toISOString())
        .order("due_at")
        .returns<MaintenanceAlert[]>(),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .gte("created_at", monthStart.toISOString()),
    ]);
    if (todayRes.error) throw todayRes.error;

    const month = local.getMonth() + 1;
    return {
      now,
      hour: local.getHours(),
      today: todayRes.data,
      next: nextRes.data?.[0],
      monthRevenue: (monthRes.data ?? []).reduce((sum, a) => sum + a.price_cents, 0),
      monthDone: monthRes.data?.length ?? 0,
      newClients: newClientsRes.count ?? 0,
      maintenance: maintenanceRes.data ?? [],
      upcoming: weekRes.count ?? 0,
      birthdays: (birthdaysRes.data ?? [])
        .filter((c) => Number(c.birthday!.slice(5, 7)) === month)
        .sort((a, b) => a.birthday!.slice(8).localeCompare(b.birthday!.slice(8))),
    };
  });
}
