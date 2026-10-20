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

export function formatPhone(phone: string): string {
  const m = phone.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${phone}`;
}
