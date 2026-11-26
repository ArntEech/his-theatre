import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarPlus,
  Ellipsis,
  Eye,
  Heart,
  MessageCircle,
  MessageCircleOff,
  Pin,
  Share2,
  TriangleAlert,
} from "lucide-react";
import type { Post } from "@/data/community";
import { usePostImages } from "@/data/queries";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";
import { cx } from "@/lib/cx";
import { downloadEvent, eventLabel, timeAgo } from "@/lib/calendar";

export interface PostCardProps {
  post: Post;
  isOfficer: boolean;
  onSeen: (id: string) => void;
  onTag: (tag: string) => void;
  onComments: (post: Post) => void;
  onLike: (post: Post) => void;
  onPeople: (post: Post, kind: "likes" | "views") => void;
  onMenu: (post: Post) => void;
  onPin: (post: Post) => void;
  onImage: (src: string) => void;
}

export function PostCard({ post, isOfficer, onSeen, onTag, onComments, onLike, onPeople, onMenu, onPin, onImage }: PostCardProps) {
  const ref = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const long = post.body.length > 320 || post.body.split("\n").length > 6;

  useEffect(() => {
    if (post.seenByMe || !ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          onSeen(post.id);
          obs.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [post.id, post.seenByMe, onSeen]);

  const automatic = !post.authorId;
  const official = !automatic && /Director|Secretary|Treasurer|Officer|Head/.test(post.authorLabel);

  return (
    <article
      ref={ref}
      className={cx(
        "mb-3 rounded-[1rem] bg-cell p-4 shadow-[var(--shadow)]",
        post.urgent && "ring-2 ring-behind",
        post.isTodaysBirthday && "ring-2 ring-tint",
        post.pinned && !post.urgent && !post.isTodaysBirthday && "ring-[1.5px] ring-tint/60",
      )}
    >
      {(post.pinned || post.urgent || post.isTodaysBirthday) && (
        <p
          className={cx(
            "mb-2 flex items-center gap-1 text-footnote font-semibold",
            post.urgent ? "text-behind-text" : "text-tint-text",
          )}
        >
          {post.isTodaysBirthday ? (
            <>🎂 Birthday today</>
          ) : post.urgent ? (
            <>
              <TriangleAlert aria-hidden className="size-3.5" strokeWidth={2.6} /> Urgent
            </>
          ) : (
            <>
              <Pin aria-hidden className="size-3.5" strokeWidth={2.6} /> Pinned
            </>
          )}
        </p>
      )}
      <header className="flex items-center gap-3">
        {automatic ? (
          <span className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-fill">
            <Logo className="size-8" />
          </span>
        ) : (
          <Avatar name={post.authorName} photo={post.authorPhoto} />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-headline font-semibold">
            <span className="truncate">{post.authorName}</span>
            {(official || automatic) && (
              <BadgeCheck aria-label="Official" className="size-4 shrink-0 text-tint-text" strokeWidth={2.4} />
            )}
          </p>
          <p className="truncate text-footnote text-label-2">
            {[post.authorLabel !== post.authorName && post.authorLabel, timeAgo(post.createdAt), post.editedAt && "Edited"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          aria-label="More"
          onClick={() => onMenu(post)}
          className="inline-flex size-9 items-center justify-center rounded-full text-label-2 active:bg-fill"
        >
          <Ellipsis className="size-5" />
        </button>
      </header>

      {(post.tags.length > 0 || post.drive) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTag(t)}
              className="rounded-full bg-tint/18 px-2.5 py-0.5 text-caption font-semibold text-tint-text active:bg-tint/30"
            >
              {t}
            </button>
          ))}
          {post.drive && (
            <span className="rounded-full bg-ahead/15 px-2.5 py-0.5 text-caption font-semibold text-ahead-text">
              {post.drive} only
            </span>
          )}
        </div>
      )}

      <p className={cx("mt-2.5 text-body whitespace-pre-wrap break-words", long && !expanded && "line-clamp-6")}>{post.body}</p>
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-subhead font-semibold text-tint-text">
          {expanded ? "Less" : "More"}
        </button>
      )}

      {post.eventAt && (
        <button
          type="button"
          onClick={() => downloadEvent(post.tags[0] ?? "His Theatre", post.eventAt!, post.body)}
          className="mt-3 flex w-full items-center gap-2 rounded-[0.75rem] bg-fill px-3 py-2.5 text-left active:bg-fill-strong"
        >
          <CalendarPlus aria-hidden className="size-5 text-tint-text" />
          <span className="flex-1 text-subhead font-semibold">{eventLabel(post.eventAt)}</span>
          <span className="text-footnote text-tint-text">Add to Calendar</span>
        </button>
      )}

      {post.imageCount > 0 && <Images postId={post.id} count={post.imageCount} onOpen={onImage} />}

      <footer className="mt-3 flex items-center justify-between border-t border-separator pt-2 text-subhead text-label-2">
        <button
          type="button"
          onClick={() => isOfficer && onPeople(post, "views")}
          className={cx("flex min-h-9 items-center gap-1 tnum", isOfficer && "active:opacity-50")}
          aria-label={`${post.views} views`}
        >
          <Eye aria-hidden className="size-[1.1rem]" /> {post.views}
        </button>
        <span className="flex items-center">
          <button
            type="button"
            onClick={() => onLike(post)}
            aria-pressed={post.likedByMe}
            aria-label={post.likedByMe ? "Unlike" : "Like"}
            className={cx("flex min-h-9 items-center gap-1 pr-1 active:scale-90", post.likedByMe && "text-behind-text")}
          >
            <Heart aria-hidden className={cx("size-[1.15rem]", post.likedByMe && "fill-current")} />
          </button>
          <button type="button" onClick={() => onPeople(post, "likes")} className="min-h-9 tnum active:opacity-50">
            {post.likes}
          </button>
        </span>
        <button
          type="button"
          onClick={() => onComments(post)}
          className="flex min-h-9 items-center gap-1 tnum active:opacity-50"
          aria-label={`${post.comments} comments`}
        >
          {post.commentsOff ? (
            <MessageCircleOff aria-hidden className="size-[1.1rem]" />
          ) : (
            <MessageCircle aria-hidden className="size-[1.1rem]" />
          )}{" "}
          {post.comments}
        </button>
        <button type="button" onClick={() => sharePost(post)} aria-label="Share" className="flex min-h-9 items-center active:opacity-50">
          <Share2 aria-hidden className="size-[1.1rem]" />
        </button>
        {isOfficer ? (
          <button
            type="button"
            onClick={() => onPin(post)}
            aria-pressed={post.pinned}
            aria-label={post.pinned ? "Unpin" : "Pin"}
            className={cx("flex min-h-9 items-center active:opacity-50", post.pinned && "text-tint-text")}
          >
            <Pin aria-hidden className={cx("size-[1.1rem]", post.pinned && "fill-current")} />
          </button>
        ) : (
          <span className="w-[1.1rem]" />
        )}
      </footer>
    </article>
  );
}

function Images({ postId, count, onOpen }: { postId: string; count: number; onOpen: (src: string) => void }) {
  const images = usePostImages(postId, count);
  if (!images.data)
    return (
      <div className={cx("mt-3 grid gap-1.5", count > 1 && "grid-cols-2")}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="aspect-[4/3] animate-pulse rounded-[0.75rem] bg-fill" />
        ))}
      </div>
    );
  return (
    <div className={cx("mt-3 grid gap-1.5", images.data.length > 1 && "grid-cols-2")}>
      {images.data.map((src, i) => (
        <button key={i} type="button" onClick={() => onOpen(src)} className="overflow-hidden rounded-[0.75rem] bg-fill">
          <img
            src={src}
            alt=""
            loading="lazy"
            className={cx("w-full object-cover", images.data.length > 1 ? "aspect-square" : "max-h-[26rem]")}
          />
        </button>
      ))}
    </div>
  );
}

/** Share to WhatsApp (or anywhere): the words plus a link that opens News (members only). */
async function sharePost(post: Post) {
  const url = `${window.location.origin}/announcements`;
  const text = `${post.authorName}${post.authorLabel ? ` (${post.authorLabel})` : ""}:\n${post.body}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "His Theatre", text, url });
      return;
    }
  } catch {
    return; // cancelled
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`, "_blank", "noopener");
}
