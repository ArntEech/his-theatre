import { useState, type FormEvent } from "react";
import { Undo2 } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { TextAreaField } from "@/components/Field";
import { InlineError } from "@/components/States";
import { IconTile } from "@/components/List";
import { formatCedi } from "@/lib/money";

interface VoidSheetProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "R-0012 · Ama Serwaa Boadu" */
  subject: string;
  amount: number;
  onConfirm: (reason: string) => Promise<unknown>;
  pending: boolean;
  error: unknown;
}

/** Money is never deleted: voiding records a reversal with a reason. */
export function VoidSheet({
  open,
  onClose,
  subject,
  amount,
  onConfirm,
  pending,
  error,
}: VoidSheetProps) {
  const [reason, setReason] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await onConfirm(reason);
      setReason("");
    } catch {
      // The error is shown from the mutation state.
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        setReason("");
        onClose();
      }}
      title="Void Entry"
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col items-center text-center">
          <IconTile icon={Undo2} color="orange" size="lg" />
          <p className="mt-3 text-headline font-semibold">{subject}</p>
          <p className="mt-1 max-w-[20rem] text-subhead text-label-2">
            A reversal of {formatCedi(-amount)} will be recorded. The original stays on record,
            marked as voided.
          </p>
        </div>
        <TextAreaField
          label="Reason"
          hint="Officers will see this in the audit log."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
        <InlineError error={error} />
        <Button
          type="submit"
          block
          loading={pending}
          disabled={reason.trim().length < 3}
          className="bg-behind text-white active:bg-behind/80"
        >
          Record Reversal
        </Button>
      </form>
    </Sheet>
  );
}
