import { describe, expect, it } from "vitest";

import { normalizeMemberCode } from "./member-code";

describe("normalizeMemberCode", () => {
  it("accepts the ways people actually type their ID", () => {
    expect(normalizeMemberCode("HIS-010")).toBe("HIS-010");
    expect(normalizeMemberCode("his-010")).toBe("HIS-010");
    expect(normalizeMemberCode("10")).toBe("HIS-010");
    expect(normalizeMemberCode(" his 10 ")).toBe("HIS-010");
    expect(normalizeMemberCode("HIS10")).toBe("HIS-010");
  });

  it("reads the letter O as zero and I or L as one", () => {
    expect(normalizeMemberCode("HIS-O1O")).toBe("HIS-010");
    expect(normalizeMemberCode("HIS-0I2")).toBe("HIS-012");
    expect(normalizeMemberCode("H1S-012")).toBe("HIS-012");
  });

  it("leaves anything else alone, so a wrong ID still fails", () => {
    expect(normalizeMemberCode("ABC")).toBe("ABC");
    expect(normalizeMemberCode("")).toBe("");
  });
});
