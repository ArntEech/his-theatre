import { useMemo, useState } from "react";
import { Download, KeyRound, Share2 } from "lucide-react";
import { issueSetupCodes } from "@/data/api";
import { useApiMutation, useMembers } from "@/data/queries";
import type { SetupCodeListItem } from "@/data/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { IconTile, ListItem, ListRow, ListSection } from "@/components/List";
import { ContentUnavailable, ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { formatDateTime, localToday } from "@/lib/dates";
import { downloadText, toCsv } from "@/lib/csv";
import { setupCodeMessage, whatsappLink } from "@/lib/whatsapp";

/**
 * Setup codes for everyone who hasn't signed in yet, in one go. The list shows once:
 * officers send each person their Member ID and code on WhatsApp, or download the list.
 */
export function SetupCodesPage() {
  const members = useMembers({});
  const create = useApiMutation(issueSetupCodes);
  const [codes, setCodes] = useState<SetupCodeListItem[] | null>(null);
  const appUrl = location.origin;

  const waiting = useMemo(
    () =>
      (members.data ?? [])
        .map((i) => i.member)
        .filter((m) => m.isActive && !m.isActivated)
        .sort((a, b) => a.memberCode.localeCompare(b.memberCode)),
    [members.data],
  );

  function download(list: SetupCodeListItem[]) {
    const rows = [
      ["Member ID", "Full name", "Phone", "Setup code", "Expires", "WhatsApp message link"],
      ...list.map((c) => [
        c.memberCode,
        c.fullName,
        c.phone,
        c.setupCode,
        formatDateTime(c.expiresAt),
        whatsappLink(c.phone, setupCodeMessage(c, appUrl)),
      ]),
    ];
    downloadText(`his-theatre-setup-codes-${localToday()}.csv`, toCsv(rows));
  }

  async function share(list: SetupCodeListItem[]) {
    const text = list
      .map((c) => `${c.fullName}: Member ID ${c.memberCode}, setup code ${c.setupCode}`)
      .join("\n");
    const body = `His Theatre setup codes (sign in at ${appUrl}/activate)\n\n${text}`;
    try {
      if (navigator.share) await navigator.share({ title: "His Theatre setup codes", text: body });
      else await navigator.clipboard.writeText(body);
    } catch {
      // Closing the share sheet is not an error.
    }
  }

  if (codes) {
    return (
      <>
        <PageHeader back={{ to: "/admin/members", label: "Members" }} title="Setup Codes" />
        <p className="mb-4 rounded-[0.75rem] bg-cell p-4 text-subhead">
          <strong>These codes show only now.</strong> Send each person theirs, or download the
          list before leaving this page. Each code works once, for 7 days. Keep the list private
          and delete it once everyone has signed in.
        </p>
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <Button
            block
            variant="gray"
            icon={<Download aria-hidden className="size-5" />}
            onClick={() => download(codes)}
          >
            Download List
          </Button>
          <Button
            block
            variant="gray"
            icon={<Share2 aria-hidden className="size-5" />}
            onClick={() => share(codes)}
          >
            Share List
          </Button>
        </div>
        <ListSection header={`${codes.length} codes`}>
          {codes.map((c) => (
            <ListItem key={c.memberId}>
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.fullName}</span>
                    <span className="text-footnote text-label-2">
                      {c.memberCode}
                      {c.phone ? ` · ${c.phone}` : " · no phone number"}
                    </span>
                  </span>
                  <span className="tnum font-mono text-title3 font-bold tracking-widest select-all">
                    {c.setupCode}
                  </span>
                </div>
                <WhatsAppButton phone={c.phone} message={setupCodeMessage(c, appUrl)}>
                  Send on WhatsApp
                </WhatsAppButton>
              </div>
            </ListItem>
          ))}
        </ListSection>
      </>
    );
  }

  return (
    <>
      <PageHeader back={{ to: "/admin/members", label: "Members" }} title="Setup Codes" />
      {members.isPending ? (
        <LoadingBlock />
      ) : members.error ? (
        <ErrorNotice error={members.error} onRetry={() => members.refetch()} />
      ) : waiting.length === 0 ? (
        <ContentUnavailable
          icon={<KeyRound aria-hidden className="size-10" />}
          title="Everyone is signed up"
          description="Every active member has set their PIN. For someone who forgot theirs, open their page and issue a new code."
        />
      ) : (
        <>
          <ListSection
            header={`${waiting.length} not signed in yet`}
            footer="Each gets their own 6-digit code, valid for 7 days. They use it once with their Member ID to choose a 4-digit PIN."
          >
            {waiting.map((m) => (
              <ListRow
                key={m.id}
                leading={<IconTile icon={KeyRound} color="gray" />}
                title={m.fullName}
                subtitle={`${m.memberCode}${m.portfolio ? ` · ${m.portfolio}` : ""}`}
                to={`/admin/members/${m.id}`}
              />
            ))}
          </ListSection>
          <InlineError error={create.error} />
          <Button
            block
            loading={create.isPending}
            onClick={() =>
              create.mutate([waiting.map((m) => m.id)], { onSuccess: (list) => setCodes(list) })
            }
          >
            Create {waiting.length} Setup Codes
          </Button>
        </>
      )}
    </>
  );
}
