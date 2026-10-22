import { describe, expect, it } from "vitest";
import { computeSlots, dayBounds, dayGrid, fitsWorkingHours, overlapsAny, toDateKey, type SlotQuery } from "./availability.ts";
import { formatInTz } from "./format.ts";

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

describe("intervalo entre atendimentos", () => {
  // Quarta das 09:00 às 19:00, grade de 30 min, intervalo de 30 min.
  const fullDay = [{ weekday: 3, start_time: "09:00", end_time: "19:00" }];
  // Agendamento 09:00–11:00 → ocupado até 11:30 (fim + intervalo), como o banco grava.
  const morning = { start: new Date("2026-10-21T12:00:00Z"), end: new Date("2026-10-21T14:30:00Z") };

  it("regra da especificação: 09:00 + 2h → próximo horário às 11:30", () => {
    const slots = computeSlots(base({ workingHours: fullDay, durationMin: 120, busy: [morning], bufferMin: 30 }));
    expect(hhmm(slots)[0]).toBe("11:30");
  });

  it("depois de um fim fora da grade, recomeça exatamente no fim + intervalo", () => {
    // 09:00–09:45 → ocupado até 10:15; grade segue 10:15, 10:45...
    const short = { start: new Date("2026-10-21T12:00:00Z"), end: new Date("2026-10-21T13:15:00Z") };
    const slots = computeSlots(base({ workingHours: fullDay, durationMin: 60, busy: [short], bufferMin: 30 }));
    expect(hhmm(slots).slice(0, 3)).toEqual(["10:15", "10:45", "11:15"]);
  });

  it("o novo atendimento também precisa terminar 30 min antes do próximo", () => {
    // Agendamento às 14:00 (14:00–15:00, ocupado até 15:30). Serviço de 1h:
    // 12:30 termina 13:30 + 30 = 14:00 → cabe; 13:00 terminaria 14:00 + 30 → não cabe.
    const afternoon = { start: new Date("2026-10-21T17:00:00Z"), end: new Date("2026-10-21T18:30:00Z") };
    const slots = hhmm(computeSlots(base({ workingHours: fullDay, durationMin: 60, busy: [afternoon], bufferMin: 30 })));
    expect(slots).toContain("12:30");
    expect(slots).not.toContain("13:00");
    expect(slots).toContain("15:30");
  });

  it("folgas bloqueiam sem intervalo extra", () => {
    const lunch = { start: new Date("2026-10-21T15:00:00Z"), end: new Date("2026-10-21T16:00:00Z") }; // 12h–13h
    const slots = hhmm(computeSlots(base({ workingHours: fullDay, durationMin: 60, blocks: [lunch], bufferMin: 30 })));
    expect(slots).toContain("11:00"); // termina 12:00, encostado na folga
    expect(slots).not.toContain("11:30");
    expect(slots).toContain("13:00");
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

  it("com limite de término, oferece toda a grade do período e corta o que passaria do limite", () => {
    // Tarde 13:00–15:00 → inícios 13:00–14:30; serviço de 2h30 com limite 16:30 → último início 14:00.
    const slots = hhmm(computeSlots(base({ durationMin: 150, latestEnd: "16:30" })));
    expect(slots.filter((s) => s >= "13:00")).toEqual(["13:00", "13:30", "14:00"]);
    // Serviço curto: vai até o último horário da grade (14:30), mesmo terminando depois das 15:00.
    expect(hhmm(computeSlots(base({ durationMin: 60, latestEnd: "20:30" }))).slice(-1)).toEqual(["14:30"]);
  });

  it("com limite de término, agendamentos continuam bloqueando", () => {
    const busy = [{ start: new Date("2026-10-21T16:30:00Z"), end: new Date("2026-10-21T18:00:00Z") }]; // 13h30–15h
    expect(hhmm(computeSlots(base({ durationMin: 60, latestEnd: "20:30", busy }))).filter((s) => s >= "13:00")).toEqual([]);
  });

  it("fitsWorkingHours com limite: começa no período e termina até o limite", () => {
    const wh = base().workingHours;
    expect(fitsWorkingHours(new Date("2026-10-21T17:30:00Z"), 150, TZ, wh, "20:30")).toBe(true); // 14h30–17h
    expect(fitsWorkingHours(new Date("2026-10-21T17:30:00Z"), 150, TZ, wh, "16:30")).toBe(false); // passa do limite
    expect(fitsWorkingHours(new Date("2026-10-21T18:00:00Z"), 60, TZ, wh, "20:30")).toBe(false); // 15h: fora do período
  });

  it("fitsWorkingHours exige que o serviço termine dentro do expediente", () => {
    const wh = base().workingHours;
    expect(fitsWorkingHours(new Date("2026-10-21T14:00:00Z"), 60, TZ, wh)).toBe(true); // 11h-12h
    expect(fitsWorkingHours(new Date("2026-10-21T14:30:00Z"), 60, TZ, wh)).toBe(false); // 11h30-12h30
  });
});

describe("grade do dia", () => {
  const tz = "America/Sao_Paulo";
  const hours = [
    { weekday: 2, start_time: "13:00", end_time: "15:00" },
    { weekday: 2, start_time: "09:00", end_time: "10:30" },
  ];

  it("lista os horários do expediente em ordem, só os que cabem inteiros", () => {
    const labels = dayGrid("2026-10-20", tz, hours, 60).map((c) => formatInTz(c.start, "HH:mm", tz));
    expect(labels).toEqual(["09:00", "13:00", "14:00"]);
  });

  it("dia sem expediente não tem grade", () => {
    expect(dayGrid("2026-10-21", tz, hours, 30)).toEqual([]);
  });

  it("detecta sobreposição sem contar encostar", () => {
    const [cell] = dayGrid("2026-10-20", tz, hours, 60); // 09:00–10:00
    const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 20, h + 3, m));
    expect(overlapsAny(cell, [{ start: at(9, 30), end: at(11) }])).toBe(true);
    expect(overlapsAny(cell, [{ start: at(10), end: at(11) }])).toBe(false);
  });
});
