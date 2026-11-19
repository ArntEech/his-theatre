import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { recordPayment } from "@/data/api";
import { useApiMutation, useCurrentSemester, useMember, useMembers } from "@/data/queries";
import type { PaymentMethod, PaymentRow } from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { MoneyField, SearchField, Segmented, TextField } from "@/components/Field";
import { ListRow, ListSection, ValueRow } from "@/components/List";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { ContentUnavailable, InlineError, LoadingBlock } from "@/components/States";
import { Money } from "@/components/Money";
import { formatCedi, parseCedi, pesewasToInput } from "@/lib/money";
import { formatDateLong } from "@/lib/dates";
import { firstName } from "@/lib/roles";
import { useOnlineStatus } from "@/lib/online";
import { cx } from "@/lib/cx";
import { methodLabel } from "@/modules/dues/labels";
import { useIdempotencyKey } from "./useIdempotencyKey";

export function RecordPaymentPage() {
  const [params, setParams] = useSearchParams();
  const memberId = params.get("member") ?? undefined;
  const semester = useCurrentSemester();
  const [done, setDone] = useState<PaymentRow | null>(null);

  function chooseMember(id: string | null) {
    const next = new URLSearchParams(params);
    if (id) next.set("member", id);
    else next.delete("member");
    setParams(next, { replace: true });
  }

  if (done) {
    return (
      <Receipted
        payment={done}
        onAnother={() => {
          setDone(null);
          chooseMember(null);
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        back={{ to: "/admin", label: "Admin" }}
        overline={semester.data?.name}
        title="Record Payment"
      />
      {semester.data?.isClosed && (
        <div className="mb-5">
          <InlineError
            error={
              new Error(`${semester.data.name} is closed. Payments can no longer be recorded.`)
            }
          />
        </div>
      )}
      {memberId ? (
        <PaymentForm
          key={memberId}
          memberId={memberId}
          semesterId={semester.data?.id}
          today={semester.data?.today ?? ""}
          onChangeMember={() => chooseMember(null)}
          onDone={setDone}
        />
      ) : (
        <MemberPicker onPick={chooseMember} />
      )}
    </>
  );
}

function MemberPicker({ onPick }: { onPick: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const members = useMembers({ search, includeInactive: true });
  return (
    <>
      <div className="mb-5">
        <SearchField
          value={search}
          onChange={setSearch}
          label="Who is paying?"
          placeholder="Who is paying?"
          autoFocus
        />
      </div>
      {members.isPending && <LoadingBlock lines={4} />}
      {members.data?.length === 0 && (
        <ContentUnavailable title="No Results" description={`No one matches “${search}”.`} />
      )}
      {members.data && members.data.length > 0 && (
        <ListSection>
          {members.data.slice(0, 40).map(({ member, dues, status }) => (
            <ListRow
              key={member.id}
              onClick={() => onPick(member.id)}
              leading={<Avatar name={member.fullName} />}
              title={member.fullName}
              subtitle={`${member.memberCode} · ${member.drive}${member.isActive ? "" : " · Left"}`}
              trailing={
                <span className="flex flex-col items-end gap-0.5">
                  {status && <StatusBadge status={status} />}
                  {dues && dues.owing > 0 && <Money value={dues.owing} className="text-subhead" />}
                </span>
              }
            />
          ))}
        </ListSection>
      )}
    </>
  );
}

function PaymentForm({
  memberId,
  semesterId,
  today,
  onChangeMember,
  onDone,
}: {
  memberId: string;
  semesterId: string | undefined;
  today: string;
  onChangeMember: () => void;
  onDone: (p: PaymentRow) => void;
}) {
  const detail = useMember(memberId);
  const online = useOnlineStatus();
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [momoRef, setMomoRef] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const [key, renewKey] = useIdempotencyKey();
  const record = useApiMutation(recordPayment);

  useEffect(() => {
    if (!paidOn && today) setPaidOn(today);
  }, [today, paidOn]);

  const amount = parseCedi(amountText);
  const dues = detail.data?.dues;
  const member = detail.data?.member;

  const quick = dues
    ? [
        dues.owing > 0 && { label: "Owed", value: dues.owing },
        { label: "1 week", value: dues.weeklyRate },
        dues.semesterTotal - dues.paid > 0 && {
          label: "Rest of semester",
          value: dues.semesterTotal - dues.paid,
        },
      ].filter((q): q is { label: string; value: number } => Boolean(q && q.value > 0))
    : [];

  const valid = Boolean(
    amount && amount > 0 && semesterId && paidOn && (method === "cash" || momoRef.trim()),
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || !semesterId || !amount) return;
    record.mutate(
      [
        {
          memberId,
          semesterId,
          amount,
          method,
          momoReference: method === "momo" ? momoRef : undefined,
          paidOn,
          note,
          idempotencyKey: key,
        },
      ],
      {
        onSuccess: (p) => {
          renewKey();
          onDone(p);
        },
      },
    );
  }

  if (detail.isPending) return <LoadingBlock lines={3} />;
  if (!member) return <InlineError error={detail.error ?? new Error("Member not found.")} />;

  return (
    <form onSubmit={submit} className="flex flex-col" noValidate>
      <ListSection>
        <ListRow
          leading={<Avatar name={member.fullName} />}
          title={member.fullName}
          subtitle={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {member.memberCode}
              {dues && <StatusBadge status={dues.status} />}
              {dues?.status === "behind" && <span>owes {formatCedi(dues.owing)}</span>}
              {dues?.status === "ahead" && <span>{formatCedi(dues.credit)} ahead</span>}
            </span>
          }
          trailing={<span className="text-tint-text">Change</span>}
          chevron={false}
          onClick={onChangeMember}
        />
      </ListSection>

      <div className="mb-6">
        <MoneyField
          hero
          label="Amount"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          error={amountText && !amount ? "Enter an amount like 5 or 12.50" : null}
        />
        {quick.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setAmountText(pesewasToInput(q.value))}
                className={cx(
                  "min-h-11 rounded-full px-4 text-subhead font-semibold transition-colors",
                  amount === q.value
                    ? "bg-tint text-on-tint"
                    : "bg-tint/18 text-tint-text active:bg-tint/30",
                )}
              >
                {q.label} · <span className="tnum">{formatCedi(q.value)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Segmented<PaymentMethod>
          label="Paid by"
          value={method}
          onChange={setMethod}
          options={[
            { value: "cash", label: "Cash" },
            { value: "momo", label: "Mobile Money" },
          ]}
        />
        {method === "momo" && (
          <TextField
            label="MoMo transaction ID"
            inputMode="numeric"
            value={momoRef}
            onChange={(e) => setMomoRef(e.target.value)}
            hint="From the payment message on their phone."
          />
        )}
        <TextField
          label="Date paid"
          type="date"
          value={paidOn}
          max={today}
          onChange={(e) => setPaidOn(e.target.value)}
        />
        <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} optional />

        <InlineError error={record.error} />
        <Button
          type="submit"
          block
          loading={record.isPending}
          disabled={!valid || !online}
          className="mt-2"
        >
          {amount ? `Record ${formatCedi(amount)}` : "Record Payment"}
        </Button>
        <p className="px-1 text-center text-footnote text-label-2">
          {!online
            ? "You're offline. Payments can be recorded once you reconnect."
            : record.isError
              ? "It's safe to try again. The same payment is never recorded twice."
              : "A receipt number is issued straight away."}
        </p>
      </div>
    </form>
  );
}

function Receipted({ payment, onAnother }: { payment: PaymentRow; onAnother: () => void }) {
  const navigate = useNavigate();
  const member = useMember(payment.memberId);
  const dues = member.data?.dues;
  const message = [
    `His Theatre receipt ${payment.receiptNo}`,
    `${payment.memberName} (${payment.memberCode})`,
    `${formatCedi(payment.amount)} by ${methodLabel(payment.method)}${payment.momoReference ? ` (${payment.momoReference})` : ""}, ${formatDateLong(payment.paidOn)}`,
    `Recorded by ${payment.recordedByName}.`,
    dues
      ? dues.owing > 0
        ? `Still owing for this semester: ${formatCedi(dues.owing)}.`
        : dues.credit > 0
          ? `Paid ahead by ${formatCedi(dues.credit)}. Thank you!`
          : "All paid up. Thank you!"
      : "Thank you!",
  ].join("\n");
  return (
    <div className="pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <div className="mb-6 flex flex-col items-center text-center">
        <svg viewBox="0 0 64 64" className="anim-success size-20 text-paid" aria-hidden>
          <circle cx="32" cy="32" r="30" fill="currentColor" />
          <path
            d="M20 33l8 8 16-17"
            fill="none"
            stroke="#fff"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="anim-check"
          />
        </svg>
        <h1 className="mt-4 text-title2 font-bold">Payment Recorded</h1>
        <p className="mt-6 text-subhead text-label-2">Receipt number</p>
        <p className="figure text-[clamp(3.25rem,16vw,4.25rem)] leading-none font-bold">
          {payment.receiptNo}
        </p>
        <p className="mt-3 max-w-[18rem] text-subhead text-label-2">
          Read this out to {firstName(payment.memberName)}. It's on their receipts in the app now.
        </p>
      </div>
      <ListSection>
        <ValueRow label="Member" value={payment.memberName} />
        <ValueRow label="Amount" value={formatCedi(payment.amount)} />
        <ValueRow
          label="Paid by"
          value={`${methodLabel(payment.method)}${payment.momoReference ? ` · ${payment.momoReference}` : ""}`}
        />
        <ValueRow label="Date" value={formatDateLong(payment.paidOn)} />
      </ListSection>
      <div className="flex flex-col gap-3">
        <WhatsAppButton phone={member.data?.member.phone ?? ""} message={message}>
          Send Receipt on WhatsApp
        </WhatsAppButton>
        <Button block onClick={onAnother}>
          Record Another
        </Button>
        <Button variant="gray" block onClick={() => navigate(`/admin/members/${payment.memberId}`)}>
          Open {firstName(payment.memberName)}'s Page
        </Button>
        <Link
          to="/admin/today"
          className="inline-flex min-h-11 items-center justify-center text-body text-tint-text active:opacity-50"
        >
          Back to Today
        </Link>
      </div>
    </div>
  );
}
