import type { ReactNode } from "react";
import { Ban, ReceiptText, Undo2 } from "lucide-react";
import type { PaymentRow } from "@/data/types";
import { Sheet } from "@/components/Sheet";
import { BigMoney } from "@/components/Money";
import { IconTile, ListSection, ValueRow } from "@/components/List";
import { formatDateLong, formatDateTime } from "@/lib/dates";
import { methodLabel } from "./labels";

export function ReceiptSheet({
  payment,
  onClose,
  footer,
}: {
  payment: PaymentRow | null;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <Sheet open={Boolean(payment)} onClose={onClose} title="Receipt">
      {payment && (
        <>
          <div className="mb-6 flex flex-col items-center text-center">
            <IconTile
              icon={payment.reversesReceiptNo ? Undo2 : ReceiptText}
              color={payment.reversesReceiptNo ? "orange" : "green"}
              size="lg"
            />
            <p className="tnum mt-3 text-subhead font-semibold text-label-2">
              Receipt {payment.receiptNo}
            </p>
            <BigMoney value={payment.amount} className="mt-1 text-[3.25rem]" />
            <p className="mt-1 text-subhead text-label-2">{formatDateLong(payment.paidOn)}</p>
          </div>
          {payment.voidedBy && (
            <p className="mb-4 flex items-start gap-2 rounded-[0.75rem] bg-behind/12 px-3.5 py-2.5 text-subhead font-medium text-destructive">
              <Ban aria-hidden className="mt-0.5 size-4 shrink-0" />
              Voided. Reversed by receipt {payment.voidedBy}.
            </p>
          )}
          {payment.reversesReceiptNo && (
            <p className="mb-4 flex items-start gap-2 rounded-[0.75rem] bg-tint/18 px-3.5 py-2.5 text-subhead font-medium">
              <Undo2 aria-hidden className="mt-0.5 size-4 shrink-0 text-tint-text" />
              This reverses receipt {payment.reversesReceiptNo}.
            </p>
          )}
          <ListSection className="mb-4">
            <ValueRow label="Member" value={`${payment.memberName} · ${payment.memberCode}`} />
            <ValueRow label="Paid by" value={methodLabel(payment.method)} />
            {payment.momoReference && <ValueRow label="MoMo ID" value={payment.momoReference} />}
            <ValueRow label="Recorded by" value={payment.recordedByName} />
            <ValueRow label="Recorded" value={formatDateTime(payment.createdAt)} />
          </ListSection>
          {payment.note && (
            <ListSection
              header={payment.reversesReceiptNo ? "Reason" : "Note"}
              padded
              className="mb-4"
            >
              <p>{payment.note}</p>
            </ListSection>
          )}
          {footer}
        </>
      )}
    </Sheet>
  );
}
