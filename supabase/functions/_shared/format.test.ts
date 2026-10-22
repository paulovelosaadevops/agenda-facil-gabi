import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, parseMoney } from "./format.ts";

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
