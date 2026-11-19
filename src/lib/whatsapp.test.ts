import { describe, expect, it } from "vitest";
import { whatsappLink, whatsappNumber } from "./whatsapp";

describe("whatsappNumber", () => {
  it("turns local Ghana numbers into 233 numbers", () => {
    expect(whatsappNumber("0244 118 302")).toBe("233244118302");
    expect(whatsappNumber("+233 24 411 8302")).toBe("233244118302");
    expect(whatsappNumber("244118302")).toBe("233244118302");
  });
  it("gives null for numbers it can't read", () => {
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappNumber("12345")).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("encodes the message", () => {
    expect(whatsappLink("0244118302", "Receipt R-0001 & thanks")).toBe(
      "https://wa.me/233244118302?text=Receipt%20R-0001%20%26%20thanks",
    );
  });
  it("leaves the number out when unknown", () => {
    expect(whatsappLink("", "Hi")).toBe("https://wa.me/?text=Hi");
  });
});
