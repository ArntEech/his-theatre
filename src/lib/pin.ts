/**
 * The same weak-PIN rule the database uses (private.is_weak_pin), so people hear about it
 * before anything is sent: repeated digits, straight runs, and years from 1950 to 2030.
 */
const RUNS = new Set([
  "0123", "1234", "2345", "3456", "4567", "5678", "6789",
  "9876", "8765", "7654", "6543", "5432", "4321", "3210",
]);

export function isWeakPin(pin: string): boolean {
  if (!/^\d{4}$/.test(pin)) return true;
  if (/^(\d)\1{3}$/.test(pin)) return true;
  if (RUNS.has(pin)) return true;
  const n = Number(pin);
  return n >= 1950 && n <= 2030;
}

export const WEAK_PIN_MESSAGE =
  "That PIN is too easy to guess. Avoid 1234, 1111, and years like 1998.";
