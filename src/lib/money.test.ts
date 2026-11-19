import { describe, expect, it } from "vitest";
import { formatCedi, parseCedi, pesewasToInput } from "./money";

describe("formatCedi", () => {
  it("shows whole cedis without decimals", () => {
    expect(formatCedi(1000)).toBe("GH₵10");
    expect(formatCedi(0)).toBe("GH₵0");
  });
  it("shows two decimals otherwise", () => {
    expect(formatCedi(1250)).toBe("GH₵12.50");
    expect(formatCedi(5)).toBe("GH₵0.05");
  });
  it("groups thousands and marks negatives", () => {
    expect(formatCedi(12345600)).toBe("GH₵123,456");
    expect(formatCedi(-1050)).toBe("−GH₵10.50");
  });
});

describe("parseCedi", () => {
  it("parses typed amounts into integer pesewas", () => {
    expect(parseCedi("10")).toBe(1000);
    expect(parseCedi("12.5")).toBe(1250);
    expect(parseCedi("12.50")).toBe(1250);
    expect(parseCedi("1,200.05")).toBe(120005);
    expect(parseCedi("0.1")).toBe(10);
  });
  it("rejects invalid amounts", () => {
    expect(parseCedi("")).toBeNull();
    expect(parseCedi("abc")).toBeNull();
    expect(parseCedi("1.234")).toBeNull();
    expect(parseCedi("-5")).toBeNull();
  });
  it("round-trips with pesewasToInput", () => {
    expect(pesewasToInput(1250)).toBe("12.50");
    expect(pesewasToInput(1000)).toBe("10");
  });
});
