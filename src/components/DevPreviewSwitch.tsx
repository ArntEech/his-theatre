import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { devPreviewAs } from "@/data/api";
import { currentMemberQuery, qk } from "@/data/queries";
import type { PreviewRole } from "@/data/types";

const OPTIONS: { value: PreviewRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "financial_secretary", label: "Financial Secretary" },
  { value: "treasurer", label: "Treasurer" },
  { value: "director", label: "Director" },
];

/** TEST DATA ONLY: shown while src/data/api.ts is the mock (IS_MOCK). Disappears when the real database is connected. */
export function DevPreviewSwitch() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const { data: me } = useSuspenseQuery(currentMemberQuery());
  const [busy, setBusy] = useState(false);

  const current: PreviewRole =
    me?.position === "Director"
      ? "director"
      : me?.position === "Treasurer"
        ? "treasurer"
        : me?.position === "Financial Secretary"
          ? "financial_secretary"
          : "member";

  async function change(role: PreviewRole) {
    setBusy(true);
    const member = await devPreviewAs(role);
    await queryClient.removeQueries({ queryKey: qk.all });
    queryClient.setQueryData(currentMemberQuery().queryKey, member);
    setBusy(false);
    if (role === "member" && router.state.location.pathname.startsWith("/admin")) {
      navigate({ to: "/" });
    } else {
      router.invalidate();
    }
  }

  return (
    <label className="flex items-center gap-1.5 rounded-full border-2 border-dashed border-gold-deep px-2 py-1 text-sm font-semibold">
      <span className="hidden min-[400px]:inline">Preview as</span>
      <select
        aria-label="Preview as (development only)"
        disabled={busy}
        value={current}
        onChange={(e) => change(e.target.value as PreviewRole)}
        className="min-h-9 max-w-36 rounded-md bg-transparent pr-1 font-semibold focus-visible:outline-none"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
