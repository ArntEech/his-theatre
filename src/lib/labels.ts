import type { IncomeSource, Member, PaymentMethod } from "@/data/types";

export const INCOME_SOURCE_LABEL: Record<IncomeSource, string> = {
  donation: "Donation",
  offering: "Offering",
  ticket_sales: "Ticket sales",
  fundraising: "Fundraising",
  levy: "Levy",
  other: "Other",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = { cash: "Cash", momo: "MoMo" };

export const EXPENSE_CATEGORIES = [
  "Costumes & props",
  "Transport",
  "Venue & sound",
  "Printing",
  "Refreshments",
  "Welfare",
  "Other",
];

export function isAdmin(member: Pick<Member, "role"> | null | undefined) {
  return member?.role === "admin" || member?.role === "super_admin";
}

export function firstName(fullName: string) {
  return fullName.split(" ")[0];
}
