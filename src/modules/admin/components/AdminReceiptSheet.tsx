import { useState } from "react";
import { reversePayment } from "@/data/api";
import { useApiMutation } from "@/data/queries";
import type { PaymentRow } from "@/data/types";
import { ListRow, ListSection } from "@/components/List";
import { useFlash } from "@/components/Flash";
import { ReceiptSheet } from "@/modules/dues/ReceiptSheet";
import { VoidSheet } from "./VoidSheet";

/** The receipt view for officers, with the option to void a payment by reversal. */
export function AdminReceiptSheet({
  payment,
  onClose,
}: {
  payment: PaymentRow | null;
  onClose: () => void;
}) {
  const flash = useFlash();
  const [voiding, setVoiding] = useState<PaymentRow | null>(null);
  const reverse = useApiMutation(reversePayment);
  const canVoid = payment && !payment.voidedBy && !payment.reversesReceiptNo;

  return (
    <>
      <ReceiptSheet
        payment={payment}
        onClose={onClose}
        footer={
          canVoid ? (
            <ListSection footer="Voiding records a reversal. Nothing is deleted.">
              <ListRow
                action="destructive"
                center
                title="Void This Payment"
                onClick={() => {
                  setVoiding(payment);
                  onClose();
                }}
              />
            </ListSection>
          ) : null
        }
      />
      <VoidSheet
        open={Boolean(voiding)}
        onClose={() => {
          reverse.reset();
          setVoiding(null);
        }}
        subject={voiding ? `${voiding.receiptNo} · ${voiding.memberName}` : ""}
        amount={voiding?.amount ?? 0}
        pending={reverse.isPending}
        error={reverse.error}
        onConfirm={async (reason) => {
          const r = await reverse.mutateAsync([voiding!.id, reason]);
          flash(`${voiding!.receiptNo} voided. Reversal ${r.receiptNo} recorded.`, "success");
          setVoiding(null);
        }}
      />
    </>
  );
}
