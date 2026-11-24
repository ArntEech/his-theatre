import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { setMyPhoto } from "@/data/api";
import { useApiMutation, useCurrentMember, useMemberPhotos } from "@/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { ListRow, ListSection, ValueRow } from "@/components/List";
import { Avatar } from "@/components/Avatar";
import { ProfileRows } from "@/components/ProfileRows";
import { InlineError } from "@/components/States";
import { useFlash } from "@/components/Flash";
import { roleLabel } from "@/lib/roles";
import { squarePhoto } from "@/lib/photo";

/** Your account: your picture and who you are in the ministry. */
export function ProfilePage() {
  const { data: me } = useCurrentMember();
  const { data: photos } = useMemberPhotos();
  const flash = useFlash();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useApiMutation(setMyPhoto);
  if (!me) return null;
  const photo = photos?.[me.id];

  async function choose(file: File | undefined) {
    setProblem(null);
    if (!file) return;
    try {
      const image = await squarePhoto(file);
      save.mutate([image], { onSuccess: () => flash("Profile picture updated.", "success") });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That photo couldn't be used.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <PageHeader title="Account" back={{ to: "/settings", label: "Settings" }} />

      <section className="mb-8 flex flex-col items-center text-center">
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={photo ? "Change profile picture" : "Add a profile picture"}
          className="relative rounded-full transition-opacity active:opacity-70"
        >
          <Avatar name={me.fullName} size="xl" photo={photo} />
          <span className="absolute right-0 bottom-0 inline-flex size-8 items-center justify-center rounded-full bg-tint text-on-tint ring-[3px] ring-[var(--grouped)]">
            <Camera aria-hidden className="size-[1.05rem]" strokeWidth={2.3} />
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => choose(e.target.files?.[0])}
        />
        <p className="mt-3 text-title2 font-bold">{me.fullName}</p>
        <p className="text-subhead text-label-2">
          {roleLabel(me)} · {me.memberCode}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={save.isPending}
            className="min-h-9 rounded-full bg-fill px-4 text-subhead font-semibold text-tint-text active:opacity-60"
          >
            {save.isPending ? "Saving…" : photo ? "Change Photo" : "Add Photo"}
          </button>
          {photo && (
            <button
              type="button"
              onClick={() => save.mutate([null], { onSuccess: () => flash("Profile picture removed.") })}
              disabled={save.isPending}
              className="min-h-9 rounded-full bg-fill px-4 text-subhead font-semibold text-destructive active:opacity-60"
            >
              Remove
            </button>
          )}
        </div>
        {(problem || save.error) && (
          <div className="mt-3 w-full max-w-[22rem]">
            {problem ? (
              <p className="text-footnote text-destructive">{problem}</p>
            ) : (
              <InlineError error={save.error} />
            )}
          </div>
        )}
      </section>

      <ListSection
        header="Details"
        footer="Only you and the officers can see these details and your picture. Something wrong? Ask the Financial Secretary to update it."
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
      <ListSection>
        <ListRow title="Settings" to="/settings" />
      </ListSection>
    </>
  );
}
