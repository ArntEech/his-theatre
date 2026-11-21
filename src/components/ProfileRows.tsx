import type { MemberProfile } from "@/data/types";
import { formatBirthday, JOINED_AS_LABEL } from "@/lib/profile";
import { ValueRow } from "./List";

/** Registration-form details, one row each. Empty details are left out. */
export function ProfileRows({ profile }: { profile: MemberProfile }) {
  const rows: [string, string][] = [
    ["Birthday", formatBirthday(profile)],
    ["Level", profile.level ? String(profile.level) : ""],
    ["Course", profile.course],
    ["Hall of residence", profile.hall],
    ["Joined as", profile.joinedAs ? JOINED_AS_LABEL[profile.joinedAs] : ""],
    ["Drive interests", profile.driveInterests],
    ["Experience", profile.experience],
    ["Experience details", profile.experienceNotes],
  ];
  return (
    <>
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <ValueRow key={label} label={label} value={value} />
        ))}
    </>
  );
}

/** True when at least one registration detail has been filled in. */
export function hasProfile(p: MemberProfile) {
  return Boolean(
    p.birthDay || p.level || p.joinedAs || p.course || p.hall || p.driveInterests || p.experience || p.experienceNotes,
  );
}
