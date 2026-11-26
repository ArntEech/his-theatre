import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { deletePost, getNewsFeed, likePost, markNewsSeen, markPostsSeen, pinPost, updatePost } from "@/data/api";
import { useApiMutation, useCurrentMember, useNewsAccess, useNewsFeed } from "@/data/queries";
import type { Post } from "@/data/community";
import { PageHeader } from "@/components/PageHeader";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { ListRow } from "@/components/List";
import { useFlash } from "@/components/Flash";
import { ContentUnavailable, ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { cx } from "@/lib/cx";
import { PostCard } from "./PostCard";
import { Composer } from "./Composer";
import { CommentsSheet } from "./CommentsSheet";
import { PeopleSheet } from "./PeopleSheet";

export function NewsPage() {
  const [tag, setTag] = useState<string | null>(null);
  const feed = useNewsFeed(tag);
  const access = useNewsAccess();
  const { data: me } = useCurrentMember();
  const queryClient = useQueryClient();
  const flash = useFlash();
  const [older, setOlder] = useState<Post[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [commentsFor, setCommentsFor] = useState<Post | null>(null);
  const [people, setPeople] = useState<{ post: Post; kind: "likes" | "views" } | null>(null);
  const [menuFor, setMenuFor] = useState<Post | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const pin = useApiMutation(pinPost);
  const a = access.data;

  // Opening News clears the unread dot.
  useEffect(() => {
    void markNewsSeen().then(() => queryClient.invalidateQueries({ queryKey: ["newsUnread"] }));
  }, [queryClient]);
  useEffect(() => {
    setOlder([]);
    setNoMore(false);
  }, [tag]);

  // Views are sent in small batches as posts scroll into sight.
  const seen = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSeen = useCallback((id: string) => {
    seen.current.add(id);
    if (timer.current) return;
    timer.current = setTimeout(() => {
      const ids = [...seen.current];
      seen.current.clear();
      timer.current = null;
      void markPostsSeen(ids).catch(() => {});
    }, 1500);
  }, []);

  const posts = useMemo(() => {
    const all = [...(feed.data ?? []), ...older.filter((o) => !(feed.data ?? []).some((p) => p.id === o.id))];
    return all.map((p) =>
      p.id in likes && likes[p.id] !== p.likedByMe
        ? { ...p, likedByMe: likes[p.id], likes: p.likes + (likes[p.id] ? 1 : -1) }
        : p,
    );
  }, [feed.data, older, likes]);
  const knownTags = useMemo(() => [...new Set(posts.flatMap((p) => p.tags))].sort(), [posts]);

  async function like(p: Post) {
    const next = !p.likedByMe;
    setLikes((l) => ({ ...l, [p.id]: next }));
    try {
      await likePost(p.id, next);
      await queryClient.invalidateQueries({ queryKey: ["news"] });
      setLikes((l) => {
        const { [p.id]: _drop, ...rest } = l;
        return rest;
      });
    } catch (e) {
      setLikes((l) => ({ ...l, [p.id]: !next }));
      flash(e instanceof Error ? e.message : "That didn't work. Try again.", "error");
    }
  }

  async function loadOlder() {
    const last = posts.filter((p) => !p.pinned && !p.isTodaysBirthday).at(-1);
    if (!last) return;
    setLoadingOlder(true);
    try {
      const more = await getNewsFeed({ before: last.createdAt, tag });
      if (more.length === 0) setNoMore(true);
      setOlder((o) => [...o, ...more]);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't load more.", "error");
    } finally {
      setLoadingOlder(false);
    }
  }

  return (
    <>
      <PageHeader
        title="News"
        action={
          a?.canPost ? (
            <button
              type="button"
              aria-label="New post"
              onClick={() => { setEditing(null); setComposing(true); }}
              className="inline-flex size-10 items-center justify-center rounded-full bg-tint text-on-tint active:bg-tint-pressed"
            >
              <Plus className="size-[1.35rem]" strokeWidth={2.6} />
            </button>
          ) : undefined
        }
      />

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {[null, ...knownTags.filter((t) => t !== tag), ...(tag && !knownTags.includes(tag) ? [tag] : [])]
          .sort((x, y) => (x === tag ? -1 : y === tag ? 1 : 0))
          .map((t) => (
            <button
              key={t ?? "all"}
              type="button"
              onClick={() => setTag(t === tag ? null : t)}
              className={cx(
                "min-h-9 shrink-0 rounded-full px-3.5 text-subhead font-semibold",
                t === tag ? "bg-tint text-on-tint" : "bg-fill text-label",
              )}
            >
              {t ?? "All"}
            </button>
          ))}
      </div>

      {feed.isError && <ErrorNotice error={feed.error} onRetry={() => feed.refetch()} />}
      {feed.isPending && <LoadingBlock lines={6} />}
      {feed.data && posts.length === 0 && (
        <ContentUnavailable
          title={tag ? `Nothing Tagged ${tag}` : "No News Yet"}
          description={a?.canPost ? "Tap + to write the first post." : "Posts from the officers and drive heads will appear here."}
        />
      )}

      {posts.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          isOfficer={Boolean(a?.isOfficer)}
          onSeen={onSeen}
          onTag={setTag}
          onComments={setCommentsFor}
          onLike={(x) => void like(x)}
          onPeople={(post, kind) => setPeople({ post, kind })}
          onMenu={setMenuFor}
          onPin={(x) =>
            pin.mutate([x.id, !x.pinned], {
              onSuccess: () => flash(x.pinned ? "Unpinned." : "Pinned to the top.", "success"),
              onError: (e) => flash(e instanceof Error ? e.message : "That didn't work.", "error"),
            })
          }
          onImage={setImage}
        />
      ))}

      {posts.length >= 20 && !noMore && (
        <Button variant="gray" block loading={loadingOlder} onClick={() => void loadOlder()} className="mb-8">
          Show Older Posts
        </Button>
      )}

      {a && (
        <Composer
          open={composing}
          onClose={() => { setComposing(false); setEditing(null); }}
          access={a}
          editing={editing}
          knownTags={knownTags}
        />
      )}
      <CommentsSheet post={commentsFor} onClose={() => setCommentsFor(null)} isOfficer={Boolean(a?.isOfficer)} />
      <PeopleSheet target={people} onClose={() => setPeople(null)} />
      <PostMenu
        post={menuFor}
        onClose={() => setMenuFor(null)}
        mine={Boolean(menuFor && menuFor.authorId === me?.id)}
        isOfficer={Boolean(a?.isOfficer)}
        isDirector={Boolean(a?.isDirector)}
        onEdit={(p) => { setMenuFor(null); setEditing(p); setComposing(true); }}
        onPin={(p) => pin.mutate([p.id, !p.pinned])}
      />
      <Sheet open={Boolean(image)} onClose={() => setImage(null)} title="Picture">
        {image && <img src={image} alt="" className="w-full rounded-[0.75rem]" />}
      </Sheet>
    </>
  );
}

function PostMenu({
  post,
  onClose,
  mine,
  isOfficer,
  isDirector,
  onEdit,
  onPin,
}: {
  post: Post | null;
  onClose: () => void;
  mine: boolean;
  isOfficer: boolean;
  isDirector: boolean;
  onEdit: (p: Post) => void;
  onPin: (p: Post) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const remove = useApiMutation(deletePost);
  const toggle = useApiMutation(updatePost);
  const flash = useFlash();
  const close = () => {
    setConfirm(false);
    remove.reset();
    toggle.reset();
    onClose();
  };
  const p = post;
  return (
    <Sheet open={Boolean(p)} onClose={close} title="Post">
      {p && (
        <div className="flex flex-col gap-3">
          <ul className="overflow-hidden rounded-[0.75rem] bg-cell">
            {mine && <ListRow title="Edit" onClick={() => onEdit(p)} />}
            {mine && (
              <ListRow
                title={p.commentsOff ? "Turn Comments On" : "Turn Comments Off"}
                onClick={() =>
                  toggle.mutate([p.id, { commentsOff: !p.commentsOff }], {
                    onSuccess: () => {
                      flash(p.commentsOff ? "Comments are on." : "Comments are off.", "success");
                      close();
                    },
                  })
                }
              />
            )}
            {isOfficer && (
              <ListRow
                title={p.pinned ? "Unpin" : "Pin to the Top"}
                onClick={() => {
                  onPin(p);
                  close();
                }}
              />
            )}
            <ListRow
              title="Copy Text"
              onClick={() => {
                void navigator.clipboard?.writeText(p.body).then(() => flash("Copied.", "success"));
                close();
              }}
            />
            {(mine || isDirector) && (
              <ListRow
                title={confirm ? "Tap Again to Delete" : "Delete Post"}
                action="destructive"
                onClick={() => {
                  if (!confirm) return setConfirm(true);
                  remove.mutate([p.id], {
                    onSuccess: () => {
                      flash("Post deleted.", "success");
                      close();
                    },
                  });
                }}
              />
            )}
          </ul>
          <InlineError error={remove.error ?? toggle.error} />
          {!mine && !isOfficer && (
            <p className="px-1 text-footnote text-label-2">Only the person who posted can edit or delete this.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
