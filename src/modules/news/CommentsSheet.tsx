import { useState, type FormEvent } from "react";
import { Flag, Pencil, Reply, Send, Trash2, X } from "lucide-react";
import { addComment, deleteComment, editComment, reportComment } from "@/data/api";
import { useApiMutation, useComments, useCurrentMember } from "@/data/queries";
import type { Post, PostComment } from "@/data/community";
import { Sheet } from "@/components/Sheet";
import { Avatar } from "@/components/Avatar";
import { useFlash } from "@/components/Flash";
import { ErrorNotice, InlineError, LoadingBlock } from "@/components/States";
import { timeAgo } from "@/lib/calendar";

/** Comments on a post: one level of replies. */
export function CommentsSheet({ post, onClose, isOfficer }: { post: Post | null; onClose: () => void; isOfficer: boolean }) {
  const comments = useComments(post?.id ?? null);
  const { data: me } = useCurrentMember();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const add = useApiMutation(addComment);
  const edit = useApiMutation(editComment);
  const remove = useApiMutation(deleteComment);
  const report = useApiMutation(reportComment);
  const flash = useFlash();
  const list = comments.data ?? [];
  const tops = list.filter((c) => !c.parentId);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!post || !text.trim()) return;
    const done = () => {
      setText("");
      setReplyTo(null);
      setEditingId(null);
    };
    if (editingId) edit.mutate([editingId, text], { onSuccess: done });
    else add.mutate([post.id, text, replyTo?.id ?? null], { onSuccess: done });
  }

  function close() {
    setText("");
    setReplyTo(null);
    setEditingId(null);
    add.reset();
    onClose();
  }

  const item = (c: PostComment, reply = false) => {
    const mine = c.memberId === me?.id;
    const canRemove = mine || isOfficer || post?.authorId === me?.id;
    return (
      <li key={c.id} className={reply ? "mt-3 ml-11" : "mt-4"}>
        <div className="flex gap-2.5">
          <Avatar name={c.fullName} photo={c.photo} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="rounded-[0.9rem] bg-fill px-3 py-2">
              <p className="text-subhead font-semibold">
                {c.fullName}
                {c.label && <span className="font-normal text-label-2"> · {c.label}</span>}
              </p>
              <p className="text-body whitespace-pre-wrap break-words">{c.body}</p>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 px-2 text-footnote text-label-2">
              <span>
                {timeAgo(c.createdAt)}
                {c.editedAt ? " · Edited" : ""}
              </span>
              {!post?.commentsOff && (
                <button type="button" className="flex items-center gap-1 font-semibold" onClick={() => { setReplyTo(c); setEditingId(null); }}>
                  <Reply aria-hidden className="size-3.5" /> Reply
                </button>
              )}
              {mine && (
                <button type="button" className="flex items-center gap-1 font-semibold" onClick={() => { setEditingId(c.id); setReplyTo(null); setText(c.body); }}>
                  <Pencil aria-hidden className="size-3.5" /> Edit
                </button>
              )}
              {canRemove && (
                <button
                  type="button"
                  className="flex items-center gap-1 font-semibold text-destructive"
                  onClick={() => {
                    if (confirmId === c.id) remove.mutate([c.id], { onSuccess: () => setConfirmId(null) });
                    else setConfirmId(c.id);
                  }}
                >
                  <Trash2 aria-hidden className="size-3.5" /> {confirmId === c.id ? "Tap again to remove" : "Remove"}
                </button>
              )}
              {!mine && (
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => report.mutate([c.id, ""], { onSuccess: () => flash("Reported to the officers. Thank you.", "success") })}
                >
                  <Flag aria-hidden className="size-3.5" /> Report
                </button>
              )}
            </div>
          </div>
        </div>
      </li>
    );
  };

  return (
    <Sheet open={Boolean(post)} onClose={close} title="Comments">
      {comments.isPending && <LoadingBlock lines={3} />}
      {comments.isError && <ErrorNotice error={comments.error} onRetry={() => comments.refetch()} />}
      {comments.data && list.length === 0 && (
        <p className="py-6 text-center text-subhead text-label-2">{post?.commentsOff ? "Comments are off." : "No comments yet. Be the first."}</p>
      )}
      <ul className="-mt-4 pb-2">
        {tops.map((c) => (
          <div key={c.id}>
            {item(c)}
            <ul>{list.filter((r) => r.parentId === c.id).map((r) => item(r, true))}</ul>
          </div>
        ))}
      </ul>
      <InlineError error={add.error ?? edit.error ?? remove.error ?? report.error} />
      {post && (!post.commentsOff || editingId) ? (
        <form onSubmit={submit} className="sticky bottom-0 mt-3 bg-[var(--sheet,transparent)] pt-2">
          {(replyTo || editingId) && (
            <p className="mb-1.5 flex items-center gap-2 px-1 text-footnote text-label-2">
              {editingId ? "Editing your comment" : `Replying to ${replyTo!.fullName}`}
              <button type="button" aria-label="Cancel" onClick={() => { setReplyTo(null); setEditingId(null); setText(""); }}>
                <X className="size-4" />
              </button>
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={1}
              placeholder="Write a comment"
              aria-label="Comment"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-[1.4rem] bg-fill px-4 py-2.5 text-body outline-none focus:ring-2 focus:ring-tint"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!text.trim() || add.isPending || edit.isPending}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-tint text-on-tint disabled:opacity-40"
            >
              <Send className="size-5" />
            </button>
          </div>
        </form>
      ) : (
        post?.commentsOff && list.length > 0 && <p className="pt-2 text-center text-footnote text-label-2">Comments are turned off for this post.</p>
      )}
    </Sheet>
  );
}
