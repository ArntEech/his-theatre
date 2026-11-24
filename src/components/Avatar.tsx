import { useMemberPhotos } from "@/data/queries";
import { cx } from "@/lib/cx";

type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, string> = {
  sm: "size-8 text-footnote",
  md: "size-10 text-callout",
  lg: "size-[4.5rem] text-title2",
  xl: "size-24 text-title1",
};

/** A profile picture, or a Contacts-style monogram when there's no picture. */
export function Avatar({ name, size = "md", photo }: { name: string; size?: Size; photo?: string | null }) {
  const parts = name.trim().split(/\s+/);
  const initials = (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        aria-hidden
        draggable={false}
        className={cx("shrink-0 rounded-full bg-fill object-cover", SIZES[size])}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#aaa6a0] to-[#87837d] font-semibold text-white",
        SIZES[size],
      )}
    >
      {initials}
    </span>
  );
}

/** A member's picture if they've added one (and you're allowed to see it), else their initials. */
export function MemberAvatar({ memberId, name, size }: { memberId: string; name: string; size?: Size }) {
  const { data: photos } = useMemberPhotos();
  return <Avatar name={name} size={size} photo={photos?.[memberId]} />;
}
