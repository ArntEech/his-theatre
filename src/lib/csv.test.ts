import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and new lines", () => {
    expect(csvCell("Abbey, Portia")).toBe('"Abbey, Portia"');
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
  });
  it("stops formulas but keeps numbers", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-12.50")).toBe("-12.50");
    expect(csvCell("+233 24")).toBe("'+233 24");
  });
  it("joins rows", () => {
    expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d");
  });
});
