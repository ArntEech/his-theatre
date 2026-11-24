import type { ComponentType } from "react";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ListRow, ListSection } from "@/components/List";
import { AnnouncementsGlyph, AttendanceGlyph } from "@/components/TabIcons";

/**
 * A feature that is being built. Its tab is already in place so members know it's coming;
 * this page says what it will do. Replace it with the real page when the feature ships.
 */
export function ComingSoonPage({
  title,
  glyph: Glyph,
  summary,
  plans,
  back,
}: {
  back?: { to: string; label: string };
  title: string;
  glyph: ComponentType<{ filled?: boolean; className?: string }>;
  summary: string;
  plans: string[];
}) {
  return (
    <>
      <PageHeader title={title} back={back} />
      <section className="mb-8 flex flex-col items-center text-center">
        <span className="flex size-20 items-center justify-center rounded-[1.4rem] bg-tint/18 text-tint-text">
          <Glyph filled className="size-10" />
        </span>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-footnote font-semibold text-label-2">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-tint" />
          In development
        </span>
        <h2 className="mt-3 text-title2 font-bold">Coming soon</h2>
        <p className="mt-1.5 max-w-[24rem] text-callout text-label-2">{summary}</p>
      </section>
      <ListSection header="What's planned" footer="Everyone will be told here when it's ready.">
        {plans.map((plan) => (
          <ListRow
            key={plan}
            leading={<Sparkles aria-hidden className="size-5 text-tint-text" />}
            title={plan}
          />
        ))}
      </ListSection>
    </>
  );
}

export function AttendancePage() {
  return (
    <ComingSoonPage
      back={{ to: "/", label: "Home" }}
      title="Attendance"
      glyph={AttendanceGlyph}
      summary="Check in at rehearsals and see who was there, without paper registers."
      plans={[
        "Tuesday and Friday rehearsals set up by themselves",
        "Quick check-in at each rehearsal, with a QR code later",
        "Your own attendance record",
        "Drive heads take their drive's register and add extra sessions",
        "Reports for the executives",
      ]}
    />
  );
}

export function AnnouncementsPage() {
  return (
    <ComingSoonPage
      title="Announcements"
      glyph={AnnouncementsGlyph}
      summary="Notices from the executives in one place, so nobody misses anything in busy WhatsApp groups."
      plans={[
        "Rehearsal times and venue changes",
        "Notices for everyone or for one drive",
        "Events and programmes",
        "A badge for anything you haven't read",
      ]}
    />
  );
}
