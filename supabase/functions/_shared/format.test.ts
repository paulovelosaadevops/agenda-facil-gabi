import { describe, expect, it } from "vitest";
import { formatPhone, isPendingEmail, normalizePhone, parseMoney, summarizeWorkingHours } from "./format.ts";
import { paymentStatus } from "./types.ts";

describe("summarizeWorkingHours", () => {
  const day = (weekday: number, start_time: string, end_time: string) => ({ weekday, start_time, end_time });

  it("junta dias seguidos com os mesmos horários e separa os diferentes", () => {
    const hours = [2, 3, 4, 5].flatMap((d) => [day(d, "13:00:00", "17:00:00"), day(d, "08:00:00", "12:00:00")]);
    expect(summarizeWorkingHours([...hours, day(6, "08:00:00", "12:00:00")])).toEqual([
      { days: "Ter a Sex", periods: "08:00–12:00, 13:00–17:00" },
      { days: "Sáb", periods: "08:00–12:00" },
    ]);
  });

  it("dois dias seguidos usam 'e'; dias não seguidos ficam separados; domingo vem no fim", () => {
    const h = day(1, "09:00", "12:00");
    expect(summarizeWorkingHours([h, { ...h, weekday: 2 }, { ...h, weekday: 4 }, { ...h, weekday: 0 }]).map((g) => g.days)).toEqual(["Seg e Ter", "Qui", "Dom"]);
  });

  it("sem expediente: lista vazia", () => {
    expect(summarizeWorkingHours([])).toEqual([]);
  });
});

describe("paymentStatus", () => {
  it("nada pago, sinal e pago (inclusive pago a mais)", () => {
    expect(paymentStatus({ price_cents: 18000, paid_cents: 0 })).toEqual({ label: "Não pago", remaining: 18000 });
    expect(paymentStatus({ price_cents: 18000, paid_cents: 5000 })).toEqual({ label: "Sinal", remaining: 13000 });
    expect(paymentStatus({ price_cents: 18000, paid_cents: 18000 })).toEqual({ label: "Pago", remaining: 0 });
    expect(paymentStatus({ price_cents: 15000, paid_cents: 18000 })).toEqual({ label: "Pago", remaining: 0 }); // valor do serviço baixou depois
  });
});

describe("isPendingEmail", () => {
  it("reconhece só o e-mail provisório", () => {
    expect(isPendingEmail("beatriz.949837279@email-pendente.invalid")).toBe(true);
    expect(isPendingEmail("beatriz@gmail.com")).toBe(false);
    expect(isPendingEmail(null)).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("adiciona DDI 55 a números brasileiros", () => {
    expect(normalizePhone("(11) 99999-8888")).toBe("5511999998888");
    expect(normalizePhone("+55 11 99999-8888")).toBe("5511999998888");
  });
  it("rejeita números curtos", () => {
    expect(normalizePhone("9999-8888")).toBeNull();
  });
  it("formata para exibição", () => {
    expect(formatPhone("5511999998888")).toBe("(11) 99999-8888");
  });
});

describe("parseMoney", () => {
  it("entende formatos brasileiros", () => {
    expect(parseMoney("R$ 80,00")).toBe(8000);
    expect(parseMoney("1.250,50")).toBe(125050);
    expect(parseMoney("45")).toBe(4500);
  });
});
