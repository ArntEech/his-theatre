import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Download, KeyRound, UserPlus } from "lucide-react";
import { useMembers } from "@/data/queries";
import type { DuesStatus, MemberListItem } from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/Button";
import { SearchField, Segmented, Switch } from "@/components/Field";
import { IconTile, ListItem, ListRow, ListSection } from "@/components/List";
import { MemberAvatar } from "@/components/Avatar";
import { Money } from "@/components/Money";
import { StatusBadge } from "@/components/StatusBadge";
import { ContentUnavailable, ErrorNotice, LoadingBlock } from "@/components/States";
import { formatCedi } from "@/lib/money";
import { cx } from "@/lib/cx";
import { memberFlags } from "./components/MemberTags";
import { downloadText, toCsv } from "@/lib/csv";
import { localToday } from "@/lib/dates";
import { STATUS_LABELS } from "@/lib/dues";

const cedis = (pesewas: number) => (pesewas / 100).toFixed(2);

/** Everyone on the roll with this semester's dues, as a spreadsheet file. */
function downloadMasterList(items: MemberListItem[]) {
  const people = [...items].sort((a, b) => a.member.memberCode.localeCompare(b.member.memberCode));
  const rows = people.map(({ member: m, dues, status }) => [
    m.memberCode,
    m.fullName,
    m.portfolio,
    m.category === "executive" ? "Executive" : "Member",
    m.drive,
    m.isActive ? "Active" : `Left${m.leftOn ? ` ${m.leftOn}` : ""}`,
    dues ? cedis(dues.paid) : "",
    dues ? cedis(dues.owing) : "",
    dues ? cedis(dues.credit) : "",
    status ? STATUS_LABELS[status] : "",
  ]);
  const sum = (f: (i: MemberListItem) => number) => cedis(people.reduce((s, i) => s + f(i), 0));
  const totals = [
    "", "Total", "", "", "", `${people.length} people`,
    sum((i) => i.dues?.paid ?? 0), sum((i) => i.dues?.owing ?? 0), sum((i) => i.dues?.credit ?? 0), "",
  ];
  downloadText(
    `his-theatre-master-list-${localToday()}.csv`,
    toCsv([
      [
        "Member ID", "Full name", "Portfolio", "Category", "Drive", "Status",
        "Paid this semester (GH₵)", "Owing (GH₵)", "Paid ahead (GH₵)", "Dues",
      ],
      ...rows,
      totals,
    ]),
  );
}

type StatusFilter = "all" | DuesStatus;

export function MembersPage() {
  const [params, setParams] = useSearchParams();
  const drive = params.get("drive") ?? "";
  const status = (params.get("status") as StatusFilter | null) ?? "all";
  const includeInactive = params.get("left") === "1";
  const [search, setSearch] = useState("");

  const all = useMembers({ includeInactive: true });
  const list = useMembers({
    search,
    drive: drive || undefined,
    status: status === "all" ? undefined : status,
    includeInactive,
  });
  const drives = useMemo(
    () => [...new Set((all.data ?? []).map((i) => i.member.drive))].sort(),
    [all.data],
  );

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const groups = useMemo(() => {
    const map = new Map<string, MemberListItem[]>();
    for (const item of list.data ?? [])
      map.set(item.member.drive, [...(map.get(item.member.drive) ?? []), item]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [list.data]);

  const notSignedIn = (all.data ?? []).filter(
    (i) => i.member.isActive && !i.member.isActivated,
  ).length;
  const owing = (list.data ?? []).reduce((s, i) => s + (i.dues?.owing ?? 0), 0);

  return (
    <>
      <PageHeader
        back={{ to: "/admin", label: "Admin" }}
        title="Members"
        action={
          <ButtonLink
            to="/admin/members/new"
            variant="plain"
            size="small"
            icon={<UserPlus aria-hidden className="size-5" />}
          >
            Add
          </ButtonLink>
        }
      />

      <ListSection>
        {notSignedIn > 0 && (
          <ListRow
            to="/admin/members/setup-codes"
            leading={<IconTile icon={KeyRound} color="orange" />}
            title="Setup Codes"
            subtitle={`${notSignedIn} ${notSignedIn === 1 ? "person hasn't" : "people haven't"} signed in yet`}
          />
        )}
        <ListRow
          leading={<IconTile icon={Download} color="blue" />}
          title="Download Master List"
          subtitle="Everyone's ID, name, portfolio and dues, for Excel or Sheets"
          onClick={all.data ? () => downloadMasterList(all.data) : undefined}
        />
      </ListSection>

      <div className="mb-6 flex flex-col gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          label="Search members"
          placeholder="Name, ID or phone"
        />
        <div
          role="group"
          aria-label="Drive"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:px-0"
        >
          {["", ...drives].map((d) => (
            <button
              key={d || "all"}
              type="button"
              aria-pressed={drive === d}
              onClick={() => setParam("drive", d)}
              className={cx(
                "min-h-11 shrink-0 rounded-full px-4 text-subhead font-semibold whitespace-nowrap transition-colors",
                drive === d ? "bg-tint text-on-tint" : "bg-fill text-label active:bg-fill-strong",
              )}
            >
              {d || "All Drives"}
            </button>
          ))}
        </div>
        <Segmented<StatusFilter>
          label="Dues status"
          hideLabel
          value={status}
          onChange={(v) => setParam("status", v === "all" ? "" : v)}
          options={[
            { value: "all", label: "All" },
            { value: "behind", label: "Behind" },
            { value: "paid_up", label: "Paid Up" },
            { value: "ahead", label: "Ahead" },
          ]}
        />
      </div>

      <ListSection>
        <ListItem className="flex items-center justify-between gap-3 py-1.5">
          <span className="text-body">Show members who have left</span>
          <Switch
            label="Show members who have left"
            checked={includeInactive}
            onChange={(v) => setParam("left", v ? "1" : "")}
          />
        </ListItem>
      </ListSection>

      {list.isError && <ErrorNotice error={list.error} onRetry={() => list.refetch()} />}
      {list.isPending && <LoadingBlock lines={6} />}
      {list.data && (
        <>
          <p className="tnum -mt-4 mb-6 px-1 text-footnote text-label-2">
            {list.data.length} {list.data.length === 1 ? "person" : "people"} · {formatCedi(owing)}{" "}
            owed
          </p>
          {list.data.length === 0 && (
            <ContentUnavailable title="No Results" description="No one matches these filters." />
          )}
          {groups.map(([driveName, items]) => (
            <ListSection
              key={driveName}
              header={driveName}
              aside={<span className="text-subhead text-label-2">{items.length}</span>}
            >
              {items.map(({ member, dues, status: s }) => {
                const flags = memberFlags(member);
                return (
                  <ListRow
                    key={member.id}
                    to={`/admin/members/${member.id}`}
                    leading={<MemberAvatar memberId={member.id} name={member.fullName} />}
                    title={member.fullName}
                    subtitle={
                      <span className="tnum">
                        {member.memberCode}
                        {flags.map((f) => (
                          <span
                            key={f.text}
                            className={
                              f.tone === "warning" ? "font-semibold text-destructive" : undefined
                            }
                          >
                            {" · "}
                            {f.text}
                          </span>
                        ))}
                      </span>
                    }
                    trailing={
                      <span className="flex flex-col items-end gap-0.5">
                        {s && <StatusBadge status={s} />}
                        {dues && s === "behind" && (
                          <Money value={dues.owing} className="text-subhead" />
                        )}
                        {dues && s === "ahead" && (
                          <Money value={dues.credit} className="text-subhead" />
                        )}
                      </span>
                    }
                  />
                );
              })}
            </ListSection>
          ))}
        </>
      )}
    </>
  );
}
