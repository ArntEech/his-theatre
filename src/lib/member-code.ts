/**
 * Turns whatever a member types into a proper Member ID.
 * "10", "his10", "His-010", "HIS-O1O" (letter O) and "HIS 010" all become "HIS-010".
 * Anything that can't be read as a number is returned trimmed and in capitals, unchanged.
 */
export function normalizeMemberCode(input: string): string {
  const raw = input.trim().toUpperCase();
  let rest = raw.replace(/\s+/g, "").replace(/^H[I1L]S[-_.]?/, "");
  // Letters that look like digits on a phone keyboard.
  rest = rest.replace(/O/g, "0").replace(/[IL]/g, "1");
  if (/^\d{1,5}$/.test(rest)) return `HIS-${rest.padStart(3, "0")}`;
  return raw;
}
