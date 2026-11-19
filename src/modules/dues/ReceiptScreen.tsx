import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { Logo } from "@/components/Logo";
import { receiptQuery } from "@/data/queries";
import { formatDate, formatDateTime } from "@/lib/dates";
import { METHOD_LABEL } from "@/lib/labels";
import { formatCedi } from "@/lib/money";

/** A receipt styled as a ticket stub, designed to look good as a screenshot. */
export function ReceiptScreen({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const { data: r } = useSuspenseQuery(receiptQuery(paymentId));
  const p = r.payment;
  const isReversal = Boolean(p.reversesPaymentId);

  return (
    <div>
      <button type="button" onClick={() => router.history.back()} className="mb-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-gold-text print:hidden">
        <ArrowLeft className="size-5" aria-hidden /> Back
      </button>

      <article className="ticket spotlight mx-auto max-w-sm overflow-hidden animate-rise" aria-label={`Receipt ${p.receiptNo}`}>
        <div className="flex items-center gap-3 px-5 pt-5">
          <Logo className="h-12 w-9" />
          <div>
            <p className="font-display text-xl font-semibold leading-tight">HIS Theatre</p>
            <p className="text-muted-foreground">Hearts In Service Theatre Ministry</p>
          </div>
        </div>
        <div className="px-5 pb-5 pt-4 text-center">
          <p className="eyebrow">{isReversal ? "Correcting entry" : "Receipt"}</p>
          <p className="num text-2xl font-semibold">{p.receiptNo}</p>
          <p className="num mt-3 text-6xl font-semibold leading-none">{formatCedi(p.amount)}</p>
          {r.reversed && (
            <p className="mt-2 inline-flex items-center gap-1.5 font-semibold text-status-behind">
              <RotateCcw className="size-4" aria-hidden /> This payment was reversed
            </p>
          )}
        </div>
        <div className="ticket-tear" />
        <dl className="divide-y divide-border px-5 py-2">
          <Row label="Member" value={`${r.memberName} (${r.memberCode})`} />
          <Row label="Paid on" value={formatDate(p.paidOn)} />
          <Row label="Method" value={`${METHOD_LABEL[p.method]}${p.momoReference ? ` · ${p.momoReference}` : ""}`} />
          <Row label="Recorded by" value={r.recordedByPosition ?? r.recordedByName} />
          <Row label="Recorded at" value={formatDateTime(p.createdAt)} />
          {p.note && <Row label="Note" value={p.note} />}
        </dl>
      </article>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
