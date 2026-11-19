import { describe, expect, it } from "vitest";

import { formatCedi, parseCedi } from "./money";

describe("formatCedi", () => {
  it("shows whole cedis without decimals", () => {
    expect(formatCedi(1000)).toBe("GH₵10");
  });
  it("shows pesewas with two decimals", () => {
    expect(formatCedi(1250)).toBe("GH₵12.50");
  });
});

describe("parseCedi", () => {
  it("turns typed cedis into pesewas", () => {
    expect(parseCedi("12.5")).toBe(1250);
    expect(parseCedi("10")).toBe(1000);
    expect(parseCedi("abc")).toBeNull();
  });
});
