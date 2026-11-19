import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeftRight, HandCoins } from "lucide-react";
import { recordHandover } from "@/data/api";
import { useApiMutation, useCashPosition, useCurrentMember } from "@/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { MoneyField, SelectField } from "@/components/Field";
import { SummaryCard } from "@/components/Card";
import { ListRow, ListSection } from "@/components/List";
import { Avatar } from "@/components/Avatar";
import { BigMoney, Money } from "@/components/Money";
import { EmptyNote, ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { useFlash } from "@/components/Flash";
import { formatCedi, parseCedi, pesewasToInput } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { PendingHandovers } from "./components/PendingHandovers";

export function HandoversPage() {
  const cash = useCashPosition();
  const { data: me } = useCurrentMember();
  const flash = useFlash();
  const record = useApiMutation(recordHandover);
  const c = cash.data;
  const mine = c?.holders.find((h) => h.memberId === me?.id);
  const recipients = (c?.holders ?? []).filter((h) => h.memberId !== me?.id && h.position);
  const [toId, setToId] = useState("");
  const [amountText, setAmountText] = useState("");
  const amount = parseCedi(amountText);

  useEffect(() => {
    if (!toId && recipients.length)
      setToId((recipients.find((r) => r.position === "Treasurer") ?? recipients[0]).memberId);
  }, [recipients, toId]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!amount) return;
    record.mutate([{ toMemberId: toId, amount }], {
      onSuccess: (h) => {
        flash(
          `${h.ref}: ${formatCedi(h.amount)} handed to ${h.toName}. It counts once they confirm.`,
          "success",
        );
        setAmountText("");
      },
    });
  }

  return (
    <>
      <PageHeader back={{ to: "/admin", label: "Admin" }} title="Cash Handovers" />
      {cash.isError && <ErrorNotice error={cash.error} onRetry={() => cash.refetch()} />}
      {cash.isPending && <LoadingBlock lines={4} />}
      {c && (
        <>
          <SummaryCard
            label="Cash You're Holding"
            icon={<HandCoins aria-hidden className="size-4" strokeWidth={2.4} />}
            accent="text-paid-text"
            className="mb-8"
          >
            <BigMoney value={mine?.holding ?? 0} />
            {mine && (
              <p className="tnum mt-1 text-subhead text-label-2">
                Collected {formatCedi(mine.collected)} · received {formatCedi(mine.received)} ·
                handed over {formatCedi(mine.handedOver)} · spent {formatCedi(mine.spent)}
              </p>
            )}
          </SummaryCard>

          <PendingHandovers handovers={c.pendingHandovers} meId={me?.id} />

          <ListSection
            header="Hand Over Cash"
            padded
            footer="Mobile Money goes straight to the ministry account, so only cash is handed over. The other officer confirms once they've counted it."
          >
            {recipients.length === 0 ? (
              <p className="text-center text-subhead text-label-2">
                There's no other officer to hand cash to.
              </p>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                <MoneyField
                  hero
                  label="Amount"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  error={amountText && !amount ? "Enter an amount like 50 or 12.50" : null}
                />
                {mine && mine.holding > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountText(pesewasToInput(mine.holding))}
                    className="mx-auto min-h-11 rounded-full bg-tint/18 px-4 text-subhead font-semibold text-tint-text active:bg-tint/30"
                  >
                    All of it · <span className="tnum">{formatCedi(mine.holding)}</span>
                  </button>
                )}
                <SelectField label="To" value={toId} onChange={(e) => setToId(e.target.value)}>
                  {recipients.map((r) => (
                    <option key={r.memberId} value={r.memberId}>
                      {r.fullName}, {r.position}
                    </option>
                  ))}
                </SelectField>
                <InlineError error={record.error} />
                <Button
                  type="submit"
                  block
                  loading={record.isPending}
                  disabled={!amount || !toId}
                  icon={<ArrowLeftRight aria-hidden className="size-5" />}
                >
                  Record Handover
                </Button>
              </form>
            )}
          </ListSection>

          <ListSection header="Who Holds the Cash">
            {c.holders.map((h) => (
              <ListRow
                key={h.memberId}
                leading={<Avatar name={h.fullName} size="sm" />}
                title={h.fullName}
                subtitle={h.position ?? "Officer"}
                trailing={<Money value={h.holding} className="text-label" />}
              />
            ))}
            {c.inTransit > 0 && (
              <ListRow
                title="Not yet confirmed"
                subtitle="Handed over, waiting to be counted"
                trailing={<Money value={c.inTransit} className="text-label" />}
              />
            )}
          </ListSection>

          <ListSection header="History">
            {c.handovers.length === 0 && <EmptyNote>No handovers yet.</EmptyNote>}
            {c.handovers.map((h) => (
              <ListRow
                key={h.id}
                title={`${h.fromName} to ${h.toName}`}
                subtitle={
                  <span className="tnum">
                    {h.ref} · {formatDateTime(h.recordedAt)} ·{" "}
                    <span className={h.confirmedAt ? "text-paid-text" : "text-behind-text"}>
                      {h.confirmedAt ? "Confirmed" : "Waiting"}
                    </span>
                  </span>
                }
                trailing={<Money value={h.amount} className="text-label" />}
              />
            ))}
          </ListSection>
        </>
      )}
    </>
  );
}
