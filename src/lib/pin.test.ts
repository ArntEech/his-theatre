import { describe, expect, it } from "vitest";
import { isWeakPin } from "./pin";

describe("isWeakPin", () => {
  it.each(["1234", "4321", "1111", "0000", "1998", "2026", "12a4", "123"])("%s is weak", (pin) =>
    expect(isWeakPin(pin)).toBe(true),
  );
  it.each(["4826", "0517", "9031", "1949", "2031"])("%s is fine", (pin) =>
    expect(isWeakPin(pin)).toBe(false),
  );
});
