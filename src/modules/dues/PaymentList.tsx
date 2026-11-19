import type { ReactNode } from "react";
import { ReceiptText, Undo2 } from "lucide-react";
import type { PaymentRow } from "@/data/types";
import { IconTile, ListRow, ListSection } from "@/components/List";
import { Money } from "@/components/Money";
import { EmptyNote } from "@/components/States";
import { formatDay } from "@/lib/dates";
import { cx } from "@/lib/cx";
import { methodLabel, paymentTitle } from "./labels";

export function PaymentList({
  payments,
  onOpen,
  showMember,
  empty = "No payments yet.",
  header = "Receipts",
  aside,
  footer,
}: {
  payments: PaymentRow[];
  onOpen: (p: PaymentRow) => void;
  showMember?: boolean;
  empty?: string;
  header?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <ListSection header={header} aside={aside} footer={footer}>
      {payments.length === 0 && <EmptyNote>{empty}</EmptyNote>}
      {payments.map((p) => (
        <ListRow
          key={p.id}
          onClick={() => onOpen(p)}
          leading={
            <IconTile
              icon={p.reversesReceiptNo ? Undo2 : ReceiptText}
              color={p.reversesReceiptNo ? "orange" : p.voidedBy ? "gray" : "green"}
            />
          }
          title={showMember ? p.memberName : paymentTitle(p)}
          subtitle={
            <span className="tnum">
              {p.receiptNo} · {formatDay(p.paidOn)} · {methodLabel(p.method)}
              {p.voidedBy && <span className="font-semibold text-destructive"> · Voided</span>}
              {showMember && p.reversesReceiptNo && ` · Void of ${p.reversesReceiptNo}`}
            </span>
          }
          trailing={
            <Money
              value={p.amount}
              className={cx("text-label", p.voidedBy && "text-label-3 line-through")}
            />
          }
        />
      ))}
    </ListSection>
  );
}
