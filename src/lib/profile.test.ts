import { describe, expect, it } from "vitest";
import { formatBirthday, parseBirthday } from "./profile";

describe("birthdays", () => {
  it("reads the ways people write them", () => {
    expect(parseBirthday("12 April")).toEqual({ birthDay: 12, birthMonth: 4 });
    expect(parseBirthday("April 12")).toEqual({ birthDay: 12, birthMonth: 4 });
    expect(parseBirthday("29 november")).toEqual({ birthDay: 29, birthMonth: 11 });
    expect(parseBirthday("5/3")).toEqual({ birthDay: 5, birthMonth: 3 });
  });
  it("refuses impossible dates", () => {
    expect(parseBirthday("31 February")).toBeNull();
    expect(parseBirthday("hello")).toBeNull();
    expect(parseBirthday("")).toBeNull();
  });
  it("shows day and month", () => {
    expect(formatBirthday({ birthDay: 3, birthMonth: 11 })).toBe("3 November");
    expect(formatBirthday({ birthDay: null, birthMonth: null })).toBe("");
  });
});
