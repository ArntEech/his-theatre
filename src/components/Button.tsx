import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { cx } from "@/lib/cx";
import { ActivityIndicator } from "./ActivityIndicator";

/** HIG button styles: filled (prominent), tinted, gray, plain and destructive. */
export type ButtonVariant = "filled" | "tinted" | "gray" | "plain" | "destructive";
export type ButtonSize = "large" | "medium" | "small";

const base =
  "inline-flex items-center justify-center gap-2 text-center font-semibold select-none transition-[background-color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-40";

const sizes: Record<ButtonSize, string> = {
  large: "min-h-[3.125rem] rounded-[0.875rem] px-5 py-3 text-headline",
  medium: "min-h-11 rounded-[0.75rem] px-4 py-2 text-callout",
  small: "min-h-11 rounded-full px-3.5 py-1.5 text-subhead",
};

const variants: Record<ButtonVariant, string> = {
  filled: "bg-tint text-on-tint active:bg-tint-pressed",
  tinted: "bg-tint/20 text-tint-text active:bg-tint/35",
  gray: "bg-fill text-tint-text active:bg-fill-strong",
  plain: "text-tint-text active:opacity-50",
  destructive: "bg-behind/14 text-destructive active:bg-behind/25",
};

export function buttonClass(
  variant: ButtonVariant = "filled",
  size: ButtonSize = "large",
  extra?: string,
) {
  return cx(base, sizes[size], variants[variant], variant === "plain" && "px-2", extra);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = "filled",
  size = "large",
  loading,
  icon,
  block,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, cx(block && "w-full", className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <ActivityIndicator className="text-[1.05em]" /> : icon}
      {children && <span>{children}</span>}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  block?: boolean;
}

export function ButtonLink({
  variant = "filled",
  size = "large",
  icon,
  block,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClass(variant, size, cx(block && "w-full", className as string))}
      {...rest}
    >
      {icon}
      <span>{children as ReactNode}</span>
    </Link>
  );
}

/** A circular icon button for navigation bars, at least 44 by 44 points. */
export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-tint-text transition-opacity active:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
