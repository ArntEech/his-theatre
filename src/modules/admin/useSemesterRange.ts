import { useCurrentSemester } from "@/data/queries";

/** From the start of the current semester up to today (money is never dated in the future). */
export function useSemesterRange() {
  const semester = useCurrentSemester();
  const s = semester.data;
  const from = s?.startsOn ?? "";
  const to = s ? (s.today < s.startsOn ? s.startsOn : s.today) : "";
  return { semester, from, to };
}
