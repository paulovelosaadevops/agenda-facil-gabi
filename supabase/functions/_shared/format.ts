import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "R$ 80,00" | "80" | "80,5" -> centavos */
export function parseMoney(input: string): number {
  const clean = input.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const value = Number.parseFloat(clean);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Formata um instante no fuso do negócio. */
export function formatInTz(date: Date | string, pattern: string, timeZone: string): string {
  return format(new Date(date), pattern, { in: tz(timeZone), locale: ptBR });
}

/**
 * Normaliza telefone para só dígitos com DDI 55.
 * "(11) 99999-8888" -> "5511999998888". Retorna null se inválido.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^[0-9]{12,15}$/.test(digits) ? digits : null;
}

/**
 * E-mail provisório (ex.: "beatriz.949837279@email-pendente.invalid"), usado em clientes cadastradas sem e-mail
 * até a Gabi atualizar. O domínio ".invalid" nunca existe: nada é enviado para ele.
 */
export function isPendingEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(".invalid");
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Expediente para exibir, juntando dias seguidos com os mesmos horários (semana começando na segunda):
 * [{ days: "Ter a Sex", periods: "08:00–12:00, 13:00–17:00" }, { days: "Sáb", periods: "..." }].
 */
export function summarizeWorkingHours(hours: { weekday: number; start_time: string; end_time: string }[]): { days: string; periods: string }[] {
  const periodsOf = (weekday: number) =>
    hours
      .filter((h) => h.weekday === weekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((h) => `${h.start_time.slice(0, 5)}–${h.end_time.slice(0, 5)}`)
      .join(", ");
  const groups: { first: number; last: number; count: number; periods: string }[] = [];
  for (const weekday of [1, 2, 3, 4, 5, 6, 0]) {
    const periods = periodsOf(weekday);
    if (!periods) continue;
    const group = groups[groups.length - 1];
    const follows = group && (group.last + 1) % 7 === weekday;
    if (group && follows && group.periods === periods) {
      group.last = weekday;
      group.count++;
    } else {
      groups.push({ first: weekday, last: weekday, count: 1, periods });
    }
  }
  return groups.map((g) => ({
    days:
      g.count === 1
        ? WEEKDAY_SHORT[g.first]
        : `${WEEKDAY_SHORT[g.first]} ${g.count === 2 ? "e" : "a"} ${WEEKDAY_SHORT[g.last]}`,
    periods: g.periods,
  }));
}

export function formatPhone(phone: string): string {
  const m = phone.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${phone}`;
}

/** Link do WhatsApp já com a mensagem escrita (abre a conversa pronta para enviar). */
export function whatsappLink(phone: string, text?: string): string {
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
