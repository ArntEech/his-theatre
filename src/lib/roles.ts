import type { Member } from "@/data/types";

export function isAdmin(member: Pick<Member, "role"> | null | undefined): boolean {
  return member?.role === "admin" || member?.role === "super_admin";
}

export function isDirector(member: Pick<Member, "role"> | null | undefined): boolean {
  return member?.role === "super_admin";
}

/** The title shown under someone's name: their portfolio, else their office, else their category. */
export function roleLabel(
  member: Pick<Member, "role" | "position" | "category"> & { portfolio?: string },
): string {
  if (member.portfolio) return member.portfolio;
  if (member.position) return member.position;
  if (member.role === "super_admin") return "Director";
  if (member.role === "admin") return "Officer";
  return member.category === "executive" ? "Executive" : "Member";
}

export function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}
