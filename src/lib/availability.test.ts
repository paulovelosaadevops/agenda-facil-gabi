import { describe, expect, it } from "vitest";
import { computeSlots, dayBounds, fitsWorkingHours, toDateKey, type SlotQuery } from "./availability";

const TZ = "America/Sao_Paulo"; // UTC-3, sem horário de verão

function base(overrides: Partial<SlotQuery> = {}): SlotQuery {
  return {
    date: "2026-10-21", // quarta-feira
    timeZone: TZ,
    durationMin: 60,
    slotIntervalMin: 30,
    workingHours: [
      { weekday: 3, start_time: "09:00", end_time: "12:00" },
      { weekday: 3, start_time: "13:00:00", end_time: "15:00:00" },
    ],
    busy: [],
    now: new Date("2026-10-20T12:00:00Z"),
    minAdvanceHours: 2,
    maxAdvanceDays: 60,
    ...overrides,
  };
}

const hhmm = (dates: Date[]) =>
  dates.map((d) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(11, 16));

describe("computeSlots", () => {
  it("gera horários dentro de cada intervalo de expediente", () => {
    expect(hhmm(computeSlots(base()))).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "13:00", "13:30", "14:00"]);
  });

  it("não oferece horários em dia sem expediente", () => {
    expect(computeSlots(base({ date: "2026-10-22" }))).toEqual([]);
  });

  it("remove horários que se sobrepõem a agendamentos", () => {
    const busy = [{ start: new Date("2026-10-21T13:00:00Z"), end: new Date("2026-10-21T14:00:00Z") }]; // 10h-11h local
    expect(hhmm(computeSlots(base({ busy })))).toEqual(["09:00", "11:00", "13:00", "13:30", "14:00"]);
  });

  it("respeita antecedência mínima", () => {
    const now = new Date("2026-10-21T11:15:00Z"); // 08:15 local, +2h = 10:15
    expect(hhmm(computeSlots(base({ now })))[0]).toBe("10:30");
  });

  it("respeita o limite máximo de dias", () => {
    expect(computeSlots(base({ maxAdvanceDays: 0 }))).toEqual([]);
  });
});

describe("helpers de fuso", () => {
  it("dayBounds cobre o dia local", () => {
    const { start, end } = dayBounds("2026-10-21", TZ);
    expect(start.toISOString()).toBe("2026-10-21T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-22T03:00:00.000Z");
  });

  it("toDateKey usa o calendário local", () => {
    expect(toDateKey(new Date("2026-10-22T02:30:00Z"), TZ)).toBe("2026-10-21");
  });

  it("fitsWorkingHours exige que o serviço termine dentro do expediente", () => {
    const wh = base().workingHours;
    expect(fitsWorkingHours(new Date("2026-10-21T14:00:00Z"), 60, TZ, wh)).toBe(true); // 11h-12h
    expect(fitsWorkingHours(new Date("2026-10-21T14:30:00Z"), 60, TZ, wh)).toBe(false); // 11h30-12h30
  });
});
