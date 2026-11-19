import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Lock, Plus, Search } from "lucide-react";
import { useDeferredValue, useState, type FormEvent } from "react";

import { ChoiceGroup, Field, selectClass } from "@/components/Field";
import { FormSheet } from "@/components/FormSheet";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, PageLoader } from "@/components/StateViews";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/data/api";
import { drivesQuery, membersQuery } from "@/data/queries";
import type { DuesStatus, MemberCategory } from "@/data/types";
import { useApiMutation } from "@/lib/use-api-mutation";
import { cn } from "@/lib/utils";
import { AdminNav } from "./AdminNav";

export type MemberListFilter = DuesStatus | "not_activated" | "locked" | "left";
export const MEMBER_LIST_FILTERS: MemberListFilter[] = ["paid_up", "behind", "ahead", "not_activated", "locked", "left"];

export interface MembersSearch {
  status?: MemberListFilter;
}

const STATUS_FILTERS: { value: MemberListFilter | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "behind", label: "Behind" },
  { value: "paid_up", label: "Paid up" },
  { value: "ahead", label: "Paid ahead" },
  { value: "not_activated", label: "Not set up" },
  { value: "locked", label: "Locked" },
  { value: "left", label: "Left" },
];

const DUES_STATUSES: MemberListFilter[] = ["paid_up", "behind", "ahead"];

export function MembersScreen({ search }: { search: MembersSearch }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [drive, setDrive] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const deferredQ = useDeferredValue(q);
  const { data: drives } = useSuspenseQuery(drivesQuery());
  const duesStatus = search.status && DUES_STATUSES.includes(search.status) ? (search.status as DuesStatus) : undefined;
  const { data: rows, isPending } = useQuery({
    ...membersQuery({
      search: deferredQ,
      ...(drive ? { drive } : {}),
      ...(duesStatus ? { status: duesStatus } : {}),
      ...(search.status === "left" ? { includeInactive: true } : {}),
    }),
    placeholderData: (prev) => prev,
  });
  // Filters the server doesn't do are applied here; sorted so whoever owes most comes first.
  const members = rows
    ?.filter((m) =>
      search.status === "not_activated"
        ? !m.isActivated && m.isActive
        : search.status === "locked"
          ? m.isLocked
          : search.status === "left"
            ? !m.isActive
            : true,
    )
    .sort((a, b) => (b.dues?.owing ?? 0) - (a.dues?.owing ?? 0) || a.fullName.localeCompare(b.fullName));

  return (
    <div>
      <AdminNav />
      <PageHeader
        eyebrow="Admin"
        title="Members"
        action={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden /> Add
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search members" placeholder="Name, ID or phone" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" />
        </div>
        <div className="flex gap-2">
          <select aria-label="Drive" value={drive} onChange={(e) => setDrive(e.target.value)} className={cn(selectClass, "flex-1")}>
            <option value="">All drives</option>
            {drives.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-2" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => {
              const active = (search.status ?? "all") === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => navigate({ to: "/admin/members", search: f.value === "all" ? {} : { status: f.value }, replace: true })}
                  className={cn(
                    "min-h-11 rounded-full border-2 px-4 font-semibold",
                    active ? "border-gold-deep bg-gold text-primary-foreground" : "border-border bg-card",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5">
        {isPending && !members ? (
          <PageLoader />
        ) : members && members.length ? (
          <>
            <p className="mb-2 text-muted-foreground">
              {members.length} {members.length === 1 ? "member" : "members"}
            </p>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {members.map((m) => (
                <li key={m.id}>
                  <Link
                    to="/admin/member/$memberId"
                    params={{ memberId: m.id }}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        {m.fullName}
                        {m.isLocked && <Lock className="size-4 text-status-behind" aria-label="Locked" />}
                      </p>
                      <p className="text-muted-foreground">
                        <span className="num">{m.memberCode}</span> · {m.drive}
                        {!m.isActivated && " · Not set up"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {m.status && <StatusBadge status={m.status} className="px-2 py-0.5" />}
                      {m.dues && m.dues.owing > 0 && <Money value={m.dues.owing} className="font-semibold text-status-behind" />}
                      {m.dues && m.dues.credit > 0 && <Money value={m.dues.credit} className="font-semibold text-status-ahead" />}
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState title="No members match">Try a different name or filter.</EmptyState>
        )}
      </div>

      <AddMemberSheet open={addOpen} onOpenChange={setAddOpen} drives={drives} />
    </div>
  );
}

function AddMemberSheet({ open, onOpenChange, drives }: { open: boolean; onOpenChange: (o: boolean) => void; drives: string[] }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [drive, setDrive] = useState(drives[0] ?? "");
  const [category, setCategory] = useState<MemberCategory>("member");
  const mutation = useApiMutation(api.addMember, {
    success: (m) => `${m.fullName} added as ${m.memberCode}`,
    onSuccess: () => {
      onOpenChange(false);
      setFullName("");
      setPhone("");
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ fullName, phone, drive, category });
  }
  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="Add a member" description="They'll start owing dues from this week.">
      <form onSubmit={submit} className="space-y-4">
        <Field id="new-name" label="Full name">
          <Input id="new-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field id="new-phone" label="Phone">
          <Input id="new-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        <Field id="new-drive" label="Drive">
          <select id="new-drive" value={drive} onChange={(e) => setDrive(e.target.value)} className={selectClass}>
            {drives.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field id="new-cat" label="Dues group">
          <ChoiceGroup<MemberCategory> name="Dues group" value={category} onChange={setCategory} options={[{ value: "member", label: "Member" }, { value: "executive", label: "Executive" }]} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Adding…" : "Add member"}
        </Button>
      </form>
    </FormSheet>
  );
}
