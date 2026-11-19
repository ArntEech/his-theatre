import { describe, expect, it } from "vitest";

import { cedis, safeCell, toCsv } from "./csv";
import { toInternational } from "./whatsapp";

describe("CSV export", () => {
  it("stops spreadsheet formulas typed into names or notes", () => {
    expect(safeCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(safeCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(safeCell("+233 24")).toBe("'+233 24");
    expect(safeCell("-5")).toBe("'-5");
    expect(safeCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("keeps plain numbers as numbers, including negatives", () => {
    expect(safeCell(-12.5)).toBe("-12.5");
    expect(safeCell(10)).toBe("10");
  });

  it("quotes commas, quotes and new lines", () => {
    expect(safeCell("Mensah, Ama")).toBe('"Mensah, Ama"');
    expect(safeCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(toCsv([["a", 1], [null, "b"]])).toBe("a,1\r\n,b");
  });

  it("turns pesewas into cedis", () => {
    expect(cedis(1250)).toBe(12.5);
    expect(cedis(-1000)).toBe(-10);
  });
});

describe("WhatsApp numbers", () => {
  it("turns Ghana numbers into international format", () => {
    expect(toInternational("024 123 4567")).toBe("233241234567");
    expect(toInternational("+233 24 123 4567")).toBe("233241234567");
    expect(toInternational("233241234567")).toBe("233241234567");
  });
});
