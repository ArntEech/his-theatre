import { CheckCircle2, MessageCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ChoiceGroup, Field, MoneyInput } from "@/components/Field";
import { FormSheet } from "@/components/FormSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/data/api";
import type { Payment, PaymentMethod } from "@/data/types";
import { formatDate, todayISO } from "@/lib/dates";
import { METHOD_LABEL } from "@/lib/labels";
import { formatCedi, parseCedi } from "@/lib/money";
import { useApiMutation } from "@/lib/use-api-mutation";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());
}

type Stage = { step: "form" } | { step: "confirm" } | { step: "done"; payment: Payment };

/**
 * Record a dues payment in three steps: amount → confirm → receipt.
 * Built to take under 30 seconds at rehearsal.
 */
export function RecordPaymentSheet({
  open,
  onOpenChange,
  memberId,
  memberName,
  semesterId,
  suggested,
  weeklyRate,
  phone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  memberId: string;
  memberName: string;
  semesterId: string;
  /** What they owe right now, in pesewas. */
  suggested?: number | undefined;
  weeklyRate?: number | undefined;
  phone?: string | undefined;
}) {
  const [stage, setStage] = useState<Stage>({ step: "form" });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [momoRef, setMomoRef] = useState("");
  const [paidOn, setPaidOn] = useState(todayISO());
  const [note, setNote] = useState("");
  // One key per sheet opening: tapping "Save" twice can never record two payments.
  const [key, setKey] = useState(newKey);

  const mutation = useApiMutation(api.recordPayment, {
    success: (p) => `Receipt ${p.receiptNo}: ${formatCedi(p.amount)} from ${memberName}`,
    onSuccess: (p) => setStage({ step: "done", payment: p }),
  });

  function reset() {
    setStage({ step: "form" });
    setAmount("");
    setMethod("cash");
    setMomoRef("");
    setPaidOn(todayISO());
    setNote("");
    setKey(newKey());
  }

  function close(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  const pesewas = parseCedi(amount);
  const tooBig = pesewas !== null && pesewas > 200_000;
  const valid = pesewas !== null && pesewas >= 100 && !tooBig && (method === "cash" || momoRef.trim().length > 0);

  const quick: { label: string; value: number }[] = [];
  if (weeklyRate) {
    for (const n of [1, 2, 4]) quick.push({ label: `${n} week${n > 1 ? "s" : ""} · ${formatCedi(n * weeklyRate)}`, value: n * weeklyRate });
  }
  if (suggested && suggested > 0) quick.push({ label: `Clear balance · ${formatCedi(suggested)}`, value: suggested });

  function next(e: FormEvent) {
    e.preventDefault();
    if (valid) setStage({ step: "confirm" });
  }

  function save() {
    if (!pesewas) return;
    mutation.mutate({
      memberId,
      semesterId,
      amount: pesewas,
      method,
      ...(method === "momo" ? { momoReference: momoRef } : {}),
      paidOn,
      note,
      idempotencyKey: key,
    });
  }

  if (stage.step === "done") {
    const p = stage.payment;
    const left = Math.max(0, (suggested ?? 0) - p.amount);
    const message =
      `HIS Theatre receipt ${p.receiptNo}\n` +
      `${memberName}: ${formatCedi(p.amount)} (${METHOD_LABEL[p.method]}) on ${formatDate(p.paidOn)}.\n` +
      (left > 0 ? `Still owing: ${formatCedi(left)}.` : "You're up to date. Thank you!");
    return (
      <FormSheet open={open} onOpenChange={close} title="Payment saved">
        <div className="ticket overflow-hidden">
          <div className="px-5 pb-4 pt-5 text-center">
            <CheckCircle2 className="mx-auto size-10 text-status-paid" aria-hidden />
            <p className="eyebrow mt-2">Receipt</p>
            <p className="num text-2xl font-semibold">{p.receiptNo}</p>
            <p className="num mt-2 text-5xl font-semibold">{formatCedi(p.amount)}</p>
            <p className="mt-1 text-muted-foreground">
              {memberName} · {METHOD_LABEL[p.method]}
              {p.momoReference ? ` · ${p.momoReference}` : ""}
            </p>
          </div>
          <div className="ticket-tear" />
          <div className="space-y-2 p-4">
            {phone && (
              <Button asChild size="lg" className="w-full">
                <a href={whatsappLink(phone, message)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden /> Send on WhatsApp
                </a>
              </Button>
            )}
            <Button variant="outline" size="lg" className="w-full" onClick={() => close(false)}>
              Done
            </Button>
          </div>
        </div>
      </FormSheet>
    );
  }

  if (stage.step === "confirm" && pesewas) {
    return (
      <FormSheet open={open} onOpenChange={close} title="Check and save">
        <p className="text-xl">
          <span className="num font-semibold">{formatCedi(pesewas)}</span> from <span className="font-semibold">{memberName}</span>,{" "}
          {METHOD_LABEL[method]}
          {method === "momo" && momoRef ? ` (${momoRef.trim()})` : ""}?
        </p>
        <p className="mt-1 text-muted-foreground">Paid {formatDate(paidOn)}. Payments can't be edited later, only reversed.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={() => setStage({ step: "form" })} disabled={mutation.isPending}>
            Back
          </Button>
          <Button size="lg" onClick={save} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </FormSheet>
    );
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={close}
      title="Record a payment"
      description={suggested ? `${memberName} · owes ${formatCedi(suggested)}` : memberName}
    >
      <form onSubmit={next} className="space-y-4">
        {quick.length > 0 && (
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Quick amounts">
            {quick.map((q) => {
              const selected = pesewas === q.value;
              return (
                <button
                  key={q.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAmount(String(q.value / 100))}
                  className={cn(
                    "num min-h-12 rounded-lg border-2 px-3 text-left font-semibold",
                    selected ? "border-gold-deep bg-gold text-primary-foreground" : "border-input bg-paper",
                  )}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
        )}
        <Field id="pay-amount" label={quick.length ? "Or type an amount" : "Amount"} hint="Between GH₵1 and GH₵2,000.">
          <MoneyInput id="pay-amount" value={amount} onChange={setAmount} autoFocus={!quick.length} />
        </Field>
        {tooBig && <p className="font-medium text-status-behind">That's more than GH₵2,000. Check the amount.</p>}
        <Field id="pay-method" label="Paid by">
          <ChoiceGroup<PaymentMethod>
            name="Paid by"
            value={method}
            onChange={setMethod}
            options={[
              { value: "cash", label: "Cash" },
              { value: "momo", label: "MoMo" },
            ]}
          />
        </Field>
        {method === "momo" && (
          <Field id="pay-momo" label="MoMo transaction ID">
            <Input id="pay-momo" value={momoRef} onChange={(e) => setMomoRef(e.target.value)} maxLength={80} required />
          </Field>
        )}
        <Field id="pay-date" label="Date paid">
          <Input id="pay-date" type="date" value={paidOn} max={todayISO()} onChange={(e) => setPaidOn(e.target.value)} required />
        </Field>
        <Field id="pay-note" label="Note (optional)">
          <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={!valid}>
          {pesewas && valid ? `Next: check ${formatCedi(pesewas)}` : "Next"}
        </Button>
      </form>
    </FormSheet>
  );
}
