import { Link } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { Money } from "@/components/Money";
import type { Payment } from "@/data/types";
import { formatDate } from "@/lib/dates";
import { METHOD_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function ReceiptList({
  payments,
  action,
}: {
  payments: Payment[];
  action?: (p: Payment, reversed: boolean) => ReactNode;
}) {
  const reversedIds = new Set(payments.map((p) => p.reversesPaymentId).filter(Boolean));
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {payments.map((p) => {
        const isReversal = Boolean(p.reversesPaymentId);
        const reversed = reversedIds.has(p.id);
        return (
          <li key={p.id} className="flex items-start gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link
                  to="/receipt/$paymentId"
                  params={{ paymentId: p.id }}
                  className="num font-semibold text-gold-text underline decoration-gold-deep underline-offset-4"
                >
                  {p.receiptNo}
                </Link>
                <span className="text-muted-foreground">
                  {formatDate(p.paidOn)} · {METHOD_LABEL[p.method]}
                  {p.momoReference ? ` · ${p.momoReference}` : ""}
                </span>
              </div>
              {isReversal && (
                <p className="mt-0.5 flex items-center gap-1.5 font-medium text-status-behind">
                  <RotateCcw className="size-4" aria-hidden /> {p.note ?? "Reversal"}
                </p>
              )}
              {!isReversal && reversed && <p className="mt-0.5 font-medium text-status-behind">Reversed</p>}
              {!isReversal && !reversed && p.note && <p className="mt-0.5 text-muted-foreground">{p.note}</p>}
              {action && <div className="mt-2">{action(p, reversed || isReversal)}</div>}
            </div>
            <Money value={p.amount} className={cn("text-xl font-semibold", reversed && "line-through opacity-60", isReversal && "text-status-behind")} />
          </li>
        );
      })}
    </ul>
  );
}
