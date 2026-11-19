import { useState, type FormEvent } from "react";

import { Field } from "@/components/Field";
import { FormSheet } from "@/components/FormSheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Asks for a reason before reversing money. Nothing is ever deleted. */
export function ReasonSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    onConfirm(reason);
  }
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason("");
        onOpenChange(o);
      }}
      title={title}
      description={description}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field id="reason" label="Reason" hint="This is saved with the record and shown in the audit trail.">
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-24 border-2 bg-paper text-base" required minLength={3} />
        </Field>
        <Button type="submit" variant="destructive" size="lg" className="w-full" disabled={busy || reason.trim().length < 3}>
          {busy ? "Saving…" : confirmLabel}
        </Button>
      </form>
    </FormSheet>
  );
}
