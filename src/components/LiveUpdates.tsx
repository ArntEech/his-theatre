import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeToChanges } from "@/data/api";
import { useCurrentMember } from "@/data/queries";

/**
 * While someone is signed in, listens for changes made by anyone (a payment recorded, a week
 * renamed, a member added) and refreshes what's on screen. Several changes close together
 * cause one refresh. Anything being typed is kept: only the data is fetched again.
 */
export function LiveUpdates() {
  const queryClient = useQueryClient();
  const me = useCurrentMember();
  const memberId = me.data?.id;
  const officer = me.data?.role !== "member";

  useEffect(() => {
    if (!memberId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = subscribeToChanges(() => {
      clearTimeout(timer);
      timer = setTimeout(
        () => queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" }),
        700,
      );
    });
    return () => {
      clearTimeout(timer);
      stop();
    };
    // Re-listen when the person or their officer access changes (their rights change too).
  }, [memberId, officer, queryClient]);

  return null;
}
