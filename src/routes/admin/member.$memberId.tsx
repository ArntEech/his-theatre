import { createFileRoute } from "@tanstack/react-router";

import { MemberDetailScreen } from "@/modules/admin/MemberDetailScreen";

export const Route = createFileRoute("/admin/member/$memberId")({
  component: MemberRoute,
});

function MemberRoute() {
  const { memberId } = Route.useParams();
  return <MemberDetailScreen memberId={memberId} />;
}
