import { useCallback, useState } from "react";

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * One key per form. Retrying a failed or slow submission reuses the key, so the server
 * can never record the same payment twice. Call `renew` after a successful save.
 */
export function useIdempotencyKey() {
  const [key, setKey] = useState(newKey);
  const renew = useCallback(() => setKey(newKey()), []);
  return [key, renew] as const;
}
