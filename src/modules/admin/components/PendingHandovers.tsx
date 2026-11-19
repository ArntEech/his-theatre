import { ArrowLeftRight } from "lucide-react";
import { confirmHandover } from "@/data/api";
import { useApiMutation } from "@/data/queries";
import type { HandoverRow } from "@/data/types";
import { Button } from "@/components/Button";
import { IconTile, ListItem, ListSection } from "@/components/List";
import { Money } from "@/components/Money";
import { InlineError } from "@/components/States";
import { useFlash } from "@/components/Flash";
import { formatDateTime } from "@/lib/dates";

export function PendingHandovers({
  handovers,
  meId,
  header = "Waiting to Be Confirmed",
}: {
  handovers: HandoverRow[];
  meId: string | undefined;
  header?: string;
}) {
  const flash = useFlash();
  const confirm = useApiMutation(confirmHandover);
  if (handovers.length === 0) return null;
  return (
    <ListSection
      header={header}
      footer={confirm.error ? <InlineError error={confirm.error} /> : undefined}
    >
      {handovers.map((h) => {
        const mine = h.toMemberId === meId;
        return (
          <ListItem key={h.id}>
            <div className="flex items-start gap-3">
              <IconTile icon={ArrowLeftRight} color="green" />
              <div className="min-w-0 flex-1">
                <p className="text-body">
                  {h.fromName} to {h.toName}
                </p>
                <p className="tnum text-subhead text-label-2">
                  {h.ref} · {formatDateTime(h.recordedAt)}
                </p>
                {!mine && (
                  <p className="mt-0.5 text-subhead text-label-2">
                    Waiting for {h.toName} to confirm.
                  </p>
                )}
              </div>
              <Money value={h.amount} className="text-headline font-semibold" />
            </div>
            {mine && (
              <Button
                block
                size="medium"
                variant="tinted"
                className="mt-3"
                loading={confirm.isPending && confirm.variables?.[0] === h.id}
                onClick={() =>
                  confirm.mutate([h.id], {
                    onSuccess: (r) =>
                      flash(`${r.ref} confirmed. The cash is now with you.`, "success"),
                  })
                }
              >
                I've Received This Cash
              </Button>
            )}
          </ListItem>
        );
      })}
    </ListSection>
  );
}
