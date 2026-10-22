// "Adicionar ao calendário": evento .ics (iPhone, Android, Google, Outlook) e link assinado para baixá-lo.
import { getEnv, requireEnv } from "./env.ts";

export type CalendarAudience = "cliente" | "gabi";

export interface CalendarEvent {
  uid: string;
  start: Date;
  end: Date;
  title: string;
  description?: string;
  location?: string | null;
  cancelled?: boolean;
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// Texto no formato iCalendar: escapa vírgula, ponto e vírgula, barra e quebra de linha.
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");

export function buildIcs(event: CalendarEvent): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gabi Marqui Nail Designer//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}@agenda-facil`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(event.end)}`,
    `SUMMARY:${icsText(event.title)}`,
    event.description ? `DESCRIPTION:${icsText(event.description)}` : "",
    event.location ? `LOCATION:${icsText(event.location)}` : "",
    `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    // Aviso do próprio calendário 2h antes.
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

/** Assinatura do link (HMAC-SHA256): sem ela ninguém abre o evento de outro agendamento. */
export async function calendarToken(appointmentId: string, audience: CalendarAudience): Promise<string> {
  const secret = getEnv("CALENDAR_SECRET") ?? requireEnv("CRON_SECRET");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${appointmentId}:${audience}`)));
  return btoa(String.fromCharCode(...sig.slice(0, 18))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Link público e assinado do .ics (função "calendar"). */
export async function calendarUrl(appointmentId: string, audience: CalendarAudience): Promise<string> {
  // No Supabase local, SUPABASE_URL é o endereço interno do Docker: PUBLIC_SUPABASE_URL dá o endereço acessível.
  const base = (getEnv("PUBLIC_SUPABASE_URL") ?? requireEnv("SUPABASE_URL")).replace(/\/$/, "");
  const token = await calendarToken(appointmentId, audience);
  return `${base}/functions/v1/calendar?a=${appointmentId}&p=${audience}&t=${token}`;
}
