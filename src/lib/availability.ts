import { TZDate } from "@date-fns/tz";

export interface Interval {
  start: Date;
  end: Date;
}

export interface WorkingInterval {
  weekday: number; // 0 = domingo
  start_time: string; // "HH:MM" ou "HH:MM:SS"
  end_time: string;
}

export interface SlotQuery {
  /** Dia no calendário local do negócio, "YYYY-MM-DD". */
  date: string;
  timeZone: string;
  durationMin: number;
  slotIntervalMin: number;
  workingHours: WorkingInterval[];
  /** Agendamentos ativos e bloqueios que se sobrepõem ao dia. */
  busy: Interval[];
  now: Date;
  minAdvanceHours: number;
  maxAdvanceDays: number;
}

const MINUTE = 60_000;

function parseTime(t: string): [number, number] {
  const [h, m] = t.split(":").map(Number);
  return [h, m];
}

export function parseDateKey(date: string): [number, number, number] {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Data inválida: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Início e fim (exclusivo) de um dia local no fuso do negócio. */
export function dayBounds(date: string, timeZone: string): Interval {
  const [y, mo, d] = parseDateKey(date);
  return {
    start: new Date(new TZDate(y, mo - 1, d, 0, 0, 0, timeZone).getTime()),
    end: new Date(new TZDate(y, mo - 1, d + 1, 0, 0, 0, timeZone).getTime()),
  };
}

/** "YYYY-MM-DD" do instante no fuso do negócio. */
export function toDateKey(date: Date, timeZone: string): string {
  const z = new TZDate(date.getTime(), timeZone);
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Horários de início livres para um serviço em um dia. */
export function computeSlots(q: SlotQuery): Date[] {
  const [y, mo, d] = parseDateKey(q.date);
  const weekday = new TZDate(y, mo - 1, d, 12, 0, 0, q.timeZone).getDay();
  const earliest = new Date(q.now.getTime() + q.minAdvanceHours * 60 * MINUTE);
  const latest = new Date(q.now.getTime() + q.maxAdvanceDays * 24 * 60 * MINUTE);
  const durationMs = q.durationMin * MINUTE;
  const slots: Date[] = [];

  const intervals = q.workingHours
    .filter((w) => w.weekday === weekday)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  for (const w of intervals) {
    const [sh, sm] = parseTime(w.start_time);
    const [eh, em] = parseTime(w.end_time);
    const open = new TZDate(y, mo - 1, d, sh, sm, 0, q.timeZone).getTime();
    const close = new TZDate(y, mo - 1, d, eh, em, 0, q.timeZone).getTime();

    for (let t = open; t + durationMs <= close; t += q.slotIntervalMin * MINUTE) {
      const candidate = { start: new Date(t), end: new Date(t + durationMs) };
      if (candidate.start < earliest || candidate.start > latest) continue;
      if (q.busy.some((b) => overlaps(candidate, b))) continue;
      slots.push(candidate.start);
    }
  }
  return slots;
}

/** O horário cabe inteiro dentro de um intervalo de expediente? */
export function fitsWorkingHours(
  start: Date,
  durationMin: number,
  timeZone: string,
  workingHours: WorkingInterval[],
): boolean {
  const dateKey = toDateKey(start, timeZone);
  const [y, mo, d] = parseDateKey(dateKey);
  const weekday = new TZDate(y, mo - 1, d, 12, 0, 0, timeZone).getDay();
  const end = start.getTime() + durationMin * MINUTE;
  return workingHours
    .filter((w) => w.weekday === weekday)
    .some((w) => {
      const [sh, sm] = parseTime(w.start_time);
      const [eh, em] = parseTime(w.end_time);
      const open = new TZDate(y, mo - 1, d, sh, sm, 0, timeZone).getTime();
      const close = new TZDate(y, mo - 1, d, eh, em, 0, timeZone).getTime();
      return start.getTime() >= open && end <= close;
    });
}
