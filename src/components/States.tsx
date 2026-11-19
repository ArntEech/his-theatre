import type { ReactNode } from "react";
import { CircleAlert, CloudOff, RotateCw } from "lucide-react";
import { Button } from "./Button";
import { cx } from "@/lib/cx";
import { useOnlineStatus } from "@/lib/online";

/** Redacted placeholders while content loads. Offline, explains why nothing is showing. */
export function LoadingBlock({ lines = 3, className }: { lines?: number; className?: string }) {
  const online = useOnlineStatus();
  if (!online) {
    return (
      <ContentUnavailable
        icon={<CloudOff className="size-10" strokeWidth={1.6} />}
        title="Not Saved Offline"
        description="This hasn't been opened on this phone before. It will load when you're back online."
      />
    );
  }
  return (
    <div className={cx("space-y-6", className)} role="status" aria-label="Loading">
      <div className="skeleton space-y-3 rounded-[0.875rem] bg-cell p-4">
        <div className="h-4 w-1/3 rounded-full bg-fill" />
        <div className="h-11 w-1/2 rounded-[0.5rem] bg-fill" />
        <div className="h-1.5 rounded-full bg-fill" />
      </div>
      <div className="skeleton overflow-hidden rounded-[0.75rem] bg-cell">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <div className="size-8 rounded-full bg-fill" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 rounded-full bg-fill" style={{ width: `${70 - i * 9}%` }} />
              <div className="h-3 w-1/3 rounded-full bg-fill" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** HIG ContentUnavailableView: a symbol, a title and a short explanation. */
export function ContentUnavailable({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="anim-fade flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-label-3">{icon}</div>}
      <p className="text-title3 font-bold">{title}</p>
      {description && <p className="mt-1 max-w-xs text-subhead text-label-2">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <ContentUnavailable
      icon={<CircleAlert className="size-10" strokeWidth={1.6} />}
      title="Couldn't Load"
      description={message}
      action={
        onRetry && (
          <Button
            variant="gray"
            size="medium"
            onClick={onRetry}
            icon={<RotateCw aria-hidden className="size-4" />}
          >
            Try Again
          </Button>
        )
      }
    />
  );
}

/** Empty state inside a list section. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <li className="list-row">
      <p className="px-4 py-6 text-center text-subhead text-label-2">{children}</p>
    </li>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[0.75rem] bg-behind/12 px-3.5 py-2.5 text-subhead font-medium text-destructive"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
