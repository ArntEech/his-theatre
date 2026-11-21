import type { MemberProfile } from "@/data/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "12 April", or "" when not given. */
export function formatBirthday(p: Pick<MemberProfile, "birthDay" | "birthMonth">): string {
  if (!p.birthDay || !p.birthMonth) return "";
  return `${p.birthDay} ${MONTHS[p.birthMonth - 1]}`;
}

/** Reads "12 April", "12 Apr", "April 12" or "12/4". Returns null if it can't. */
export function parseBirthday(text: string): { birthDay: number; birthMonth: number } | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const numeric = t.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})$/);
  let day: number | undefined;
  let month: number | undefined;
  if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
  } else {
    const m = MONTHS.findIndex((name) => t.includes(name.slice(0, 3).toLowerCase()));
    const d = t.match(/\d{1,2}/);
    if (m >= 0 && d) {
      day = Number(d[0]);
      month = m + 1;
    }
  }
  if (!day || !month || month < 1 || month > 12) return null;
  const longest = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day >= 1 && day <= longest ? { birthDay: day, birthMonth: month } : null;
}

export const JOINED_AS_LABEL = { new: "New member", continuing: "Continuing member" } as const;
