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
  /** Agendamentos ativos, já com o intervalo no fim: [início, fim + intervalo). */
  busy: Interval[];
  /** Folgas e bloqueios (sem intervalo extra). */
  blocks?: Interval[];
  /** Intervalo obrigatório depois de cada atendimento, em minutos. */
  bufferMin?: number;
  now: Date;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  /**
   * Horário-limite para terminar ("HH:MM", ex.: "20:30"). Com ele, o expediente define só os horários de
   * início (a grade de cada período) e o atendimento pode passar do fim do período, desde que acabe até aqui.
   * Sem ele, o atendimento precisa terminar dentro do período.
   */
  latestEnd?: string;
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

/**
 * Primeiro conflito de um horário candidato, ou null.
 * O candidato leva o intervalo no fim ao ser comparado com agendamentos
 * (que também já trazem o intervalo deles): ninguém fica a menos de `buffer` do outro.
 */
export function findConflict(
  start: number,
  durationMs: number,
  bufferMs: number,
  busy: Interval[],
  blocks: Interval[],
): Interval | null {
  const withBuffer = { start: new Date(start), end: new Date(start + durationMs + bufferMs) };
  const plain = { start: new Date(start), end: new Date(start + durationMs) };
  return busy.find((b) => overlaps(withBuffer, b)) ?? blocks.find((b) => overlaps(plain, b)) ?? null;
}

/**
 * Horários de início livres para um serviço em um dia.
 * Anda pela grade do expediente; ao bater num agendamento, recomeça exatamente no fim dele
 * + intervalo (ex.: 09:00–11:00 com 30 min → próximo horário 11:30) e segue a grade dali.
 */
export function computeSlots(q: SlotQuery): Date[] {
  const [y, mo, d] = parseDateKey(q.date);
  const weekday = new TZDate(y, mo - 1, d, 12, 0, 0, q.timeZone).getDay();
  const earliest = q.now.getTime() + q.minAdvanceHours * 60 * MINUTE;
  const latest = q.now.getTime() + q.maxAdvanceDays * 24 * 60 * MINUTE;
  const durationMs = q.durationMin * MINUTE;
  const bufferMs = (q.bufferMin ?? 0) * MINUTE;
  const stepMs = q.slotIntervalMin * MINUTE;
  const blocks = q.blocks ?? [];
  const slots: Date[] = [];

  const intervals = q.workingHours
    .filter((w) => w.weekday === weekday)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const limit = q.latestEnd ? timeOnDay(y, mo, d, q.latestEnd, q.timeZone) : undefined;

  for (const w of intervals) {
    const open = timeOnDay(y, mo, d, w.start_time, q.timeZone);
    const close = timeOnDay(y, mo, d, w.end_time, q.timeZone);
    // Com limite: começa em qualquer horário da grade do período e termina até o limite.
    const fits = (t: number) => (limit ? t + stepMs <= close && t + durationMs <= limit : t + durationMs <= close);

    let t = open;
    while (fits(t)) {
      const conflict = findConflict(t, durationMs, bufferMs, q.busy, blocks);
      if (conflict) {
        // Pula para o fim do que está no caminho (agendamento já inclui o intervalo).
        t = Math.max(t + MINUTE, conflict.end.getTime());
        continue;
      }
      if (t >= earliest && t <= latest) slots.push(new Date(t));
      t += stepMs;
    }
  }
  return slots;
}

/** Instante de um "HH:MM" num dia local. */
function timeOnDay(y: number, mo: number, d: number, time: string, timeZone: string): number {
  const [h, m] = parseTime(time);
  return new TZDate(y, mo - 1, d, h, m, 0, timeZone).getTime();
}

/**
 * O horário respeita o expediente? Sem `latestEnd`, o serviço cabe inteiro num período.
 * Com `latestEnd`, começa dentro de um período e termina até o limite (mesma regra de computeSlots).
 */
export function fitsWorkingHours(
  start: Date,
  durationMin: number,
  timeZone: string,
  workingHours: WorkingInterval[],
  latestEnd?: string,
): boolean {
  const dateKey = toDateKey(start, timeZone);
  const [y, mo, d] = parseDateKey(dateKey);
  const weekday = new TZDate(y, mo - 1, d, 12, 0, 0, timeZone).getDay();
  const end = start.getTime() + durationMin * MINUTE;
  if (latestEnd && end > timeOnDay(y, mo, d, latestEnd, timeZone)) return false;
  return workingHours
    .filter((w) => w.weekday === weekday)
    .some((w) => {
      const open = timeOnDay(y, mo, d, w.start_time, timeZone);
      const close = timeOnDay(y, mo, d, w.end_time, timeZone);
      return start.getTime() >= open && (latestEnd ? start.getTime() < close : end <= close);
    });
}

/** Grade do expediente de um dia: um intervalo [início, início + passo) para cada horário da grade. */
export function dayGrid(date: string, timeZone: string, workingHours: WorkingInterval[], stepMin: number): Interval[] {
  const [y, mo, d] = parseDateKey(date);
  const weekday = new TZDate(y, mo - 1, d, 12, 0, 0, timeZone).getDay();
  const stepMs = stepMin * MINUTE;
  return workingHours
    .filter((w) => w.weekday === weekday)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .flatMap((w) => {
      const [sh, sm] = parseTime(w.start_time);
      const [eh, em] = parseTime(w.end_time);
      const close = new TZDate(y, mo - 1, d, eh, em, 0, timeZone).getTime();
      const cells: Interval[] = [];
      for (let t = new TZDate(y, mo - 1, d, sh, sm, 0, timeZone).getTime(); t + stepMs <= close; t += stepMs) {
        cells.push({ start: new Date(t), end: new Date(t + stepMs) });
      }
      return cells;
    });
}

/** Algum dos intervalos cruza [start, end)? */
export function overlapsAny(cell: Interval, intervals: Interval[]): boolean {
  return intervals.some((i) => i.start < cell.end && i.end > cell.start);
}
