import { useCurrentMember } from "@/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { ListSection, ValueRow } from "@/components/List";
import { Avatar } from "@/components/Avatar";
import { ProfileRows } from "@/components/ProfileRows";
import { roleLabel } from "@/lib/roles";

/** Your account: who you are in the ministry. Settings and sign-out live in Settings. */
export function ProfilePage() {
  const { data: me } = useCurrentMember();
  if (!me) return null;

  return (
    <>
      <PageHeader title="Account" back={{ to: "/settings", label: "Settings" }} />

      <section className="mb-8 flex flex-col items-center text-center">
        <Avatar name={me.fullName} size="lg" />
        <p className="mt-3 text-title2 font-bold">{me.fullName}</p>
        <p className="text-subhead text-label-2">
          {roleLabel(me)} · {me.memberCode}
        </p>
      </section>

      <ListSection
        header="Details"
        footer="Only you and the officers can see these details. Something wrong? Ask the Financial Secretary to update it."
      >
        <ValueRow label="Member ID" value={me.memberCode} />
        <ValueRow label="Drive" value={me.drive} />
        <ValueRow
          label="Dues category"
          value={me.category === "executive" ? "Executive" : "Member"}
        />
        <ValueRow label="Phone" value={me.phone || "Not given"} />
        <ProfileRows profile={me.profile} />
      </ListSection>
    </>
  );
}
