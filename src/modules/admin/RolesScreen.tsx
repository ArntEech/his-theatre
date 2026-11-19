import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Search, ShieldCheck, UserPlus } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { ChoiceGroup, Field } from "@/components/Field";
import { FormSheet } from "@/components/FormSheet";
import { PageHeader, SectionTitle } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/data/api";
import { currentMemberQuery, membersQuery, officersQuery } from "@/data/queries";
import type { Member } from "@/data/types";
import { useApiMutation } from "@/lib/use-api-mutation";
import { AdminNav } from "./AdminNav";

type Position = "Financial Secretary" | "Treasurer";

export function RolesScreen() {
  const { data: me } = useSuspenseQuery(currentMemberQuery());
  const { data: officers } = useSuspenseQuery(officersQuery());
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const remove = useApiMutation((m: Member) => api.setRole(m.id, "member", null), {
    success: (m) => `${m.fullName} is no longer an officer`,
    onSuccess: () => setRemoving(null),
  });

  return (
    <div>
      <AdminNav />
      <PageHeader
        eyebrow="Director"
        title="Roles"
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus aria-hidden /> Add
          </Button>
        }
      />
      <p className="text-muted-foreground">
        Officers can see every member's dues and record money. Keep this list short: the Director, the Financial Secretary and the Treasurer.
      </p>

      <SectionTitle>Officers</SectionTitle>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {officers.map((o) => (
          <li key={o.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <ShieldCheck className="size-6 shrink-0 text-gold-deep" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{o.fullName}</p>
              <p className="text-muted-foreground">
                {o.position ?? (o.role === "super_admin" ? "Director" : "Officer")} · <span className="num">{o.memberCode}</span>
              </p>
            </div>
            {o.id !== me?.id && o.role !== "super_admin" && (
              <Button size="sm" variant="outline" onClick={() => setRemoving(o)}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted-foreground">You can't remove your own Director role.</p>

      {adding && <AddOfficerSheet officerIds={officers.map((o) => o.id)} onClose={() => setAdding(false)} />}

      <FormSheet
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing ? `Remove ${removing.fullName} as ${removing.position ?? "officer"}?` : "Remove officer"}
        description="They become a normal member and lose access to the Admin desk straight away."
      >
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={() => setRemoving(null)}>
            Cancel
          </Button>
          <Button variant="destructive" size="lg" disabled={remove.isPending} onClick={() => removing && remove.mutate(removing)}>
            {remove.isPending ? "Removing…" : "Remove"}
          </Button>
        </div>
      </FormSheet>
    </div>
  );
}

function AddOfficerSheet({ officerIds, onClose }: { officerIds: string[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q);
  const [picked, setPicked] = useState<Member | null>(null);
  const [position, setPosition] = useState<Position>("Treasurer");
  const { data: results } = useQuery({ ...membersQuery({ search: deferred }), enabled: deferred.trim().length >= 2 });
  const mutation = useApiMutation((v: { id: string; position: Position }) => api.setRole(v.id, "admin", v.position), {
    success: (m) => `${m.fullName} is now ${m.position}`,
    onSuccess: onClose,
  });

  return (
    <FormSheet open onOpenChange={(o) => !o && onClose()} title="Add an officer">
      {picked ? (
        <div className="space-y-4">
          <p className="text-lg">
            <span className="font-semibold">{picked.fullName}</span> <span className="num text-muted-foreground">{picked.memberCode}</span>
          </p>
          <Field id="pos" label="Position">
            <ChoiceGroup<Position>
              name="Position"
              value={position}
              onChange={setPosition}
              options={[
                { value: "Financial Secretary", label: "Financial Secretary" },
                { value: "Treasurer", label: "Treasurer" },
              ]}
            />
          </Field>
          <p className="text-sm text-muted-foreground">They'll need to sign in as an officer with email, password and an authenticator code.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={() => setPicked(null)}>
              Back
            </Button>
            <Button size="lg" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: picked.id, position })}>
              {mutation.isPending ? "Saving…" : "Make officer"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search members" placeholder="Name or Member ID" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" autoFocus />
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {(results ?? [])
              .filter((m) => !officerIds.includes(m.id))
              .slice(0, 8)
              .map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => setPicked(m)} className="flex min-h-14 w-full items-center justify-between px-4 text-left hover:bg-accent">
                    <span className="font-semibold">{m.fullName}</span>
                    <span className="num text-muted-foreground">{m.memberCode}</span>
                  </button>
                </li>
              ))}
          </ul>
          {deferred.trim().length < 2 && <p className="text-muted-foreground">Type at least 2 letters.</p>}
        </div>
      )}
    </FormSheet>
  );
}
