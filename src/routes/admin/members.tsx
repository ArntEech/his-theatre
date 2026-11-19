import { createFileRoute } from "@tanstack/react-router";

import { MEMBER_LIST_FILTERS, MembersScreen, type MemberListFilter, type MembersSearch } from "@/modules/admin/MembersScreen";

export const Route = createFileRoute("/admin/members")({
  validateSearch: (search: Record<string, unknown>): MembersSearch =>
    MEMBER_LIST_FILTERS.includes(search.status as MemberListFilter) ? { status: search.status as MemberListFilter } : {},
  component: MembersRoute,
});

function MembersRoute() {
  const search = Route.useSearch();
  return <MembersScreen search={search} />;
}
