import { Link } from "react-router";
import {
  ArrowLeftRight,
  CalendarDays,
  ClipboardList,
  FileText,
  HandCoins,
  Plus,
  Sun,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useCurrentMember, useCurrentSemester, useDashboard } from "@/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/Button";
import { Stat, SummaryCard } from "@/components/Card";
import { IconTile, ListRow, ListSection } from "@/components/List";
import { MemberAvatar } from "@/components/Avatar";
import { BigMoney, Money } from "@/components/Money";
import { ProgressBar } from "@/components/ProgressBar";
import { ContentUnavailable, ErrorNotice, LoadingBlock } from "@/components/States";
import { formatCedi } from "@/lib/money";
import { roleLabel } from "@/lib/roles";

export function AdminHomePage() {
  const { data: me } = useCurrentMember();
  const semester = useCurrentSemester();
  const dash = useDashboard(semester.data?.id);
  const d = dash.data;
  const s = semester.data;

  return (
    <>
      <PageHeader
        overline={
          s
            ? `${s.name}${s.currentWeekNo ? ` · Week ${s.currentWeekNo}` : ""}`
            : me
              ? roleLabel(me)
              : undefined
        }
        title="Admin"
      />

      {s === null && (
        <ContentUnavailable
          title="No Semester Yet"
          description="Set one up under Semester, weeks and rates."
        />
      )}
      {dash.isError && <ErrorNotice error={dash.error} onRetry={() => dash.refetch()} />}
      {(semester.isPending || dash.isPending) && s !== null && <LoadingBlock lines={5} />}

      {d && (
        <>
          <SummaryCard
            label="Collected This Semester"
            icon={<TrendingUp aria-hidden className="size-4" strokeWidth={2.4} />}
            className="mb-4"
          >
            <BigMoney value={d.collected} />
            <p className="mt-1 mb-4 text-subhead text-label-2">
              against {formatCedi(d.dueSoFar)} due so far from {d.activeMembers} active members
            </p>
            <ProgressBar
              value={d.dueSoFar ? (d.collected / d.dueSoFar) * 100 : 100}
              label="Collected against due so far"
            />
            <div className="mt-4 flex gap-2 border-t-[0.5px] border-separator pt-3">
              <Stat
                value={d.counts.paid_up}
                label="Paid up"
                color="text-paid-text"
                to="/admin/members?status=paid_up"
              />
              <Stat
                value={d.counts.behind}
                label="Behind"
                color="text-behind-text"
                to="/admin/members?status=behind"
              />
              <Stat
                value={d.counts.ahead}
                label="Paid ahead"
                color="text-ahead-text"
                to="/admin/members?status=ahead"
              />
            </div>
          </SummaryCard>

          <div className="mb-8 grid grid-cols-2 gap-4">
            <SummaryCard label="Owed" accent="text-behind-text" to="/admin/members?status=behind">
              <BigMoney value={d.owingTotal} className="text-title1" />
            </SummaryCard>
            <SummaryCard label="Balance" accent="text-paid-text" to="/admin/reports">
              <BigMoney value={d.balance} className="text-title1" />
            </SummaryCard>
          </div>

          <ButtonLink
            to="/admin/pay"
            block
            className="mb-8"
            icon={<Plus aria-hidden className="size-5" strokeWidth={2.4} />}
          >
            Record Payment
          </ButtonLink>

          <ListSection header="Money">
            <ListRow
              to="/admin/today"
              leading={<IconTile icon={Sun} color="gold" />}
              title="Today"
              trailing={<Money value={d.collectedToday} />}
            />
            <ListRow
              to="/admin/handovers"
              leading={<IconTile icon={ArrowLeftRight} color="green" />}
              title="Cash Handovers"
              trailing={d.pendingHandovers > 0 ? `${d.pendingHandovers} waiting` : undefined}
            />
            <ListRow
              to="/admin/expenses"
              leading={<IconTile icon={Wallet} color="orange" />}
              title="Expenses"
            />
            <ListRow
              to="/admin/income"
              leading={<IconTile icon={HandCoins} color="green" />}
              title="Other Income"
            />
            <ListRow
              to="/admin/reports"
              leading={<IconTile icon={FileText} color="blue" />}
              title="Reports"
            />
          </ListSection>

          <ListSection header="Ministry">
            <ListRow
              to="/admin/members"
              leading={<IconTile icon={Users} color="blue" />}
              title="Members"
              trailing={String(d.activeMembers)}
            />
            <ListRow
              to="/admin/semester"
              leading={<IconTile icon={CalendarDays} color="charcoal" />}
              title="Semester, Weeks and Rates"
            />
            {me?.role === "super_admin" && (
              <ListRow
                to="/admin/audit"
                leading={<IconTile icon={ClipboardList} color="gray" />}
                title="Audit Log"
              />
            )}
          </ListSection>

          <ListSection header="Drives">
            {d.drives.map((drive) => (
              <ListRow
                key={drive.drive}
                to={`/admin/members?drive=${encodeURIComponent(drive.drive)}`}
                title={drive.drive}
                subtitle={`${drive.members} members · ${drive.behind} behind`}
                trailing={<Money value={drive.owing} />}
              />
            ))}
          </ListSection>

          {d.mostBehind.length > 0 && (
            <ListSection
              header="Furthest Behind"
              aside={
                <Link
                  to="/admin/members?status=behind"
                  className="text-body text-tint-text active:opacity-50"
                >
                  See All
                </Link>
              }
            >
              {d.mostBehind.map(({ member, dues }) => (
                <ListRow
                  key={member.id}
                  to={`/admin/members/${member.id}`}
                  leading={<MemberAvatar memberId={member.id} name={member.fullName} size="sm" />}
                  title={member.fullName}
                  subtitle={`${member.memberCode} · ${dues?.weeksBehind} ${dues?.weeksBehind === 1 ? "week" : "weeks"} behind`}
                  trailing={<Money value={dues?.owing ?? 0} className="text-behind-text" />}
                />
              ))}
            </ListSection>
          )}
        </>
      )}
    </>
  );
}
