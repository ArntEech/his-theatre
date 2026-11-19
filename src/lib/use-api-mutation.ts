import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { qk } from "@/data/queries";

/**
 * Wraps an api.ts call: shows the server's message on failure, a toast on success,
 * and refreshes every screen's data afterwards (money changes ripple everywhere).
 */
export function useApiMutation<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  options: { success?: string | ((result: TResult) => string); onSuccess?: (result: TResult) => void } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: qk.all });
      const msg = typeof options.success === "function" ? options.success(result) : options.success;
      if (msg) toast.success(msg);
      options.onSuccess?.(result);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    },
  });
}
