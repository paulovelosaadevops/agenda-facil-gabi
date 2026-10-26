import { addDays } from "date-fns";
import { toDateKey } from "@shared/availability.ts";
import { formatInTz, whatsappLink } from "@shared/format.ts";
import type { AppointmentWithRefs } from "@shared/types.ts";

/** WhatsApp com o pedido de confirmação já escrito ("amanhã, quinta-feira, 23/10 às 14:00"). */
export function confirmationRequestLink(appt: AppointmentWithRefs, timeZone: string, now = new Date()): string | undefined {
  if (!appt.clients) return undefined;
  const key = toDateKey(new Date(appt.starts_at), timeZone);
  const day = key === toDateKey(now, timeZone) ? "hoje, " : key === toDateKey(addDays(now, 1), timeZone) ? "amanhã, " : "";
  const when = `${day}${formatInTz(appt.starts_at, "EEEE, dd/MM 'às' HH:mm", timeZone)}`;
  return whatsappLink(
    appt.clients.phone,
    `Olá, ${appt.clients.name.split(" ")[0]}! Aqui é a Gabi. Passando para confirmar seu horário de ${appt.services?.name ?? "atendimento"} ` +
      `${day ? "" : "marcado para "}${when}. Posso contar com você?`,
  );
}
