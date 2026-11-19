import { cx } from "@/lib/cx";

/** Contacts-style monogram. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const parts = name.trim().split(/\s+/);
  const initials = (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#aaa6a0] to-[#87837d] font-semibold text-white",
        size === "sm" && "size-8 text-footnote",
        size === "md" && "size-10 text-callout",
        size === "lg" && "size-[4.5rem] text-title2",
      )}
    >
      {initials}
    </span>
  );
}
