import { useQuery } from "@tanstack/react-query";
import { getLikers, getViewers } from "@/data/api";
import type { Post } from "@/data/community";
import { Sheet } from "@/components/Sheet";
import { Avatar } from "@/components/Avatar";
import { ListItem, ListRow } from "@/components/List";
import { ErrorNotice, LoadingBlock } from "@/components/States";
import { timeAgo } from "@/lib/calendar";

/** Who liked a post (everyone can see), or who has seen it (officers only). */
export function PeopleSheet({ target, onClose }: { target: { post: Post; kind: "likes" | "views" } | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["postPeople", target?.post.id ?? "", target?.kind ?? ""],
    queryFn: () => (target!.kind === "likes" ? getLikers(target!.post.id) : getViewers(target!.post.id)),
    enabled: Boolean(target),
  });
  return (
    <Sheet open={Boolean(target)} onClose={onClose} title={target?.kind === "views" ? "Seen By" : "Liked By"}>
      {q.isPending && <LoadingBlock lines={3} />}
      {q.isError && <ErrorNotice error={q.error} />}
      {q.data && (
        <ul className="overflow-hidden rounded-[0.75rem] bg-cell">
          {q.data.map((p) => (
            <ListRow
              key={p.memberId}
              leading={<Avatar name={p.fullName} size="sm" />}
              title={p.fullName}
              trailing={p.at ? timeAgo(p.at) : undefined}
            />
          ))}
          {q.data.length === 0 && (
            <ListItem>
              <p className="text-center text-subhead text-label-2">No one yet.</p>
            </ListItem>
          )}
        </ul>
      )}
      {target?.kind === "views" && q.data && (
        <p className="mt-2 px-1 text-footnote text-label-2">Only officers can see this list.</p>
      )}
    </Sheet>
  );
}
