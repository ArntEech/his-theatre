import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { createPost, updatePost } from "@/data/api";
import { useApiMutation } from "@/data/queries";
import type { NewsAccess, Post } from "@/data/community";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { SelectField, Switch, TextAreaField, TextField } from "@/components/Field";
import { useFlash } from "@/components/Flash";
import { InlineError } from "@/components/States";
import { postImage } from "@/lib/postImage";
import { cx } from "@/lib/cx";

const SUGGESTED = ["General", "Dues", "Rehearsal", "Event", "Boosters", "Prayer", "Outreach", "Welfare"];

/** New post, or editing your own (words, tags and event time). */
export function Composer({
  open,
  onClose,
  access,
  editing,
  knownTags,
}: {
  open: boolean;
  onClose: () => void;
  access: NewsAccess;
  editing: Post | null;
  knownTags: string[];
}) {
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState("");
  const [drive, setDrive] = useState("");
  const [label, setLabel] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [event, setEvent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const create = useApiMutation(createPost);
  const update = useApiMutation(updatePost);
  const flash = useFlash();
  const busy = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    create.reset();
    update.reset();
    setImageError(null);
    if (editing) {
      setBody(editing.body);
      setTags(editing.tags);
      setEvent(editing.eventAt ? toLocalInput(editing.eventAt) : "");
    } else {
      setBody("");
      setTags([]);
      setDrive(access.isOfficer ? "" : (access.drives[0] ?? ""));
      setLabel(access.labels[0] ?? "");
      setUrgent(false);
      setEvent("");
      setImages([]);
    }
    setTagText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  function addTag(raw: string) {
    const t = raw.trim().replace(/^#/, "").slice(0, 24);
    if (!t || tags.length >= 5 || tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    setTags([...tags, t]);
    setTagText("");
  }
  function onTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagText);
    }
  }
  async function pick(files: FileList | null) {
    setImageError(null);
    const list = [...(files ?? [])].slice(0, 4 - images.length);
    try {
      const out: string[] = [];
      for (const f of list) out.push(await postImage(f));
      setImages((x) => [...x, ...out].slice(0, 4));
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "That picture couldn't be added.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const allTags = tagText.trim() ? [...tags, tagText.trim()] : tags;
    const eventAt = event ? new Date(event).toISOString() : null;
    if (editing) {
      update.mutate([editing.id, { body, tags: allTags, eventAt }], {
        onSuccess: () => {
          flash("Post updated.", "success");
          onClose();
        },
      });
    } else {
      create.mutate([{ body, tags: allTags, drive: drive || null, urgent, eventAt, authorLabel: label, images }], {
        onSuccess: () => {
          flash("Posted.", "success");
          onClose();
        },
      });
    }
  }

  const suggestions = [...new Set([...knownTags, ...SUGGESTED])].filter(
    (t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase()),
  );

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Edit Post" : "New Post"}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!editing && (
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Post as" value={label} onChange={(e) => setLabel(e.target.value)}>
              {access.labels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </SelectField>
            <SelectField label="Who sees it" value={drive} onChange={(e) => setDrive(e.target.value)}>
              {access.isOfficer && <option value="">Everyone</option>}
              {access.drives.map((d) => (
                <option key={d} value={d}>
                  {d} only
                </option>
              ))}
            </SelectField>
          </div>
        )}

        <TextAreaField
          label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="What do people need to know?"
          hint={`${body.trim().length} / 2000`}
        />

        <div>
          <p className="mb-1.5 px-1 text-subhead font-medium text-label-2">Tags (up to 5)</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTags(tags.filter((x) => x !== t))}
                className="flex items-center gap-1 rounded-full bg-tint px-2.5 py-1 text-subhead font-semibold text-on-tint"
              >
                {t} <X aria-hidden className="size-3.5" />
              </button>
            ))}
            {tags.length < 5 &&
              suggestions.slice(0, 8).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTag(t)}
                  className="rounded-full bg-fill px-2.5 py-1 text-subhead text-label active:bg-fill-strong"
                >
                  + {t}
                </button>
              ))}
          </div>
          {tags.length < 5 && (
            <div className="mt-2">
              <TextField
                label="New tag"
                value={tagText}
                maxLength={24}
                onChange={(e) => setTagText(e.target.value)}
                onKeyDown={onTagKey}
                onBlur={() => tagText.trim() && addTag(tagText)}
                placeholder="Type a tag, then press Enter"
              />
            </div>
          )}
        </div>

        <TextField
          label="Event date and time"
          type="datetime-local"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          optional
          hint="Adds an Add to Calendar button."
        />

        {!editing && (
          <>
            <div>
              <div className="flex flex-wrap gap-2">
                {images.map((src, i) => (
                  <span key={i} className="relative">
                    <img src={src} alt="" className="size-20 rounded-[0.6rem] object-cover" />
                    <button
                      type="button"
                      aria-label="Remove picture"
                      onClick={() => setImages(images.filter((_, k) => k !== i))}
                      className="absolute -top-1.5 -right-1.5 inline-flex size-6 items-center justify-center rounded-full bg-label text-cell"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
                {images.length < 4 && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex size-20 flex-col items-center justify-center gap-1 rounded-[0.6rem] bg-fill text-caption text-tint-text active:bg-fill-strong"
                  >
                    <ImagePlus aria-hidden className="size-6" />
                    Picture
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void pick(e.target.files)} />
              {imageError && <p className="mt-1 px-1 text-footnote text-destructive">{imageError}</p>}
            </div>

            <label className={cx("flex items-center gap-3 rounded-[0.75rem] bg-cell px-4 py-3", urgent && "ring-2 ring-behind")}>
              <span className="flex-1">
                <span className="block text-body">Urgent</span>
                <span className="block text-footnote text-label-2">Shows in red and notifies everyone, even with notifications for News off.</span>
              </span>
              <Switch checked={urgent} onChange={setUrgent} label="Urgent" />
            </label>
          </>
        )}

        <InlineError error={create.error ?? update.error} />
        <Button type="submit" block loading={busy} disabled={!body.trim()}>
          {editing ? "Save" : "Post"}
        </Button>
      </form>
    </Sheet>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
