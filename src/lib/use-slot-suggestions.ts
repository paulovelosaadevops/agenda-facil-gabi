import { useEffect, useState } from "react";
import { formatInTz } from "@shared/format.ts";
import { getAvailableSlots } from "@shared/slots.ts";
import type { Business } from "@shared/types.ts";
import { supabase } from "./supabase";

/** Horários livres ("HH:MM") de um serviço num dia, para sugerir no formulário do painel. */
export function useSlotSuggestions(business: Business, serviceId: string, date: string) {
  // Guarda para qual serviço/dia são os horários: ao trocar o dia não mostra os do dia anterior.
  const [result, setResult] = useState<{ key: string; slots: string[] }>();
  const key = `${serviceId}|${date}`;

  useEffect(() => {
    if (!serviceId || !date) return;
    let active = true;
    // No painel ela pode encaixar em cima da hora e marcar com qualquer antecedência (o limite de dias é só das clientes).
    getAvailableSlots(supabase, { ...business, min_advance_hours: 0, max_advance_days: 3650 }, serviceId, date)
      .then((list) => {
        if (active) setResult({ key, slots: list.map((s) => formatInTz(s, "HH:mm", business.timezone)) });
      })
      .catch(() => {
        if (active) setResult({ key, slots: [] });
      });
    return () => {
      active = false;
    };
  }, [serviceId, date, business, key]);

  return serviceId && result?.key === key ? result.slots : undefined;
}
