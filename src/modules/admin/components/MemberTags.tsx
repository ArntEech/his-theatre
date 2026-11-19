import type { Member } from "@/data/types";
import { formatDate } from "@/lib/dates";

/** Account states as short words for list subtitles. */
export function memberFlags(member: Member): { text: string; tone: "normal" | "warning" }[] {
  const flags: { text: string; tone: "normal" | "warning" }[] = [];
  if (member.position) flags.push({ text: member.position, tone: "normal" });
  if (!member.isActive)
    flags.push({
      text: `Left${member.leftOn ? ` ${formatDate(member.leftOn)}` : ""}`,
      tone: "normal",
    });
  if (member.isActive && !member.isActivated) flags.push({ text: "Not activated", tone: "normal" });
  if (member.isLocked) flags.push({ text: "Locked", tone: "warning" });
  return flags;
}

export function MemberTags({ member, withCategory }: { member: Member; withCategory?: boolean }) {
  const flags = memberFlags(member);
  if (withCategory)
    flags.unshift({
      text: member.category === "executive" ? "Executive" : "Member",
      tone: "normal",
    });
  if (!flags.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {flags.map((f) => (
        <span
          key={f.text}
          className={
            f.tone === "warning"
              ? "rounded-full bg-behind/14 px-2 py-0.5 text-footnote font-semibold text-behind-text"
              : "rounded-full bg-fill px-2 py-0.5 text-footnote font-semibold text-label-2"
          }
        >
          {f.text}
        </span>
      ))}
    </span>
  );
}
