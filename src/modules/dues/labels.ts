import type { PaymentMethod, PaymentRow, ScheduleWeekState } from "@/data/types";

export function methodLabel(method: PaymentMethod): string {
  return method === "momo" ? "MoMo" : "Cash";
}

export function paymentTitle(p: Pick<PaymentRow, "reversesReceiptNo">): string {
  return p.reversesReceiptNo ? `Void of ${p.reversesReceiptNo}` : "Dues payment";
}

export const SCHEDULE_LABELS: Record<ScheduleWeekState, string> = {
  covered: "Paid",
  waived: "Waived",
  part_paid: "Part paid",
  owing: "Owing",
  upcoming: "Upcoming",
  not_counted: "No dues",
  not_applicable: "Not charged to you",
};
