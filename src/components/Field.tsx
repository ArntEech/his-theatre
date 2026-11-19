import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronsUpDown, CircleAlert, Eye, EyeOff, Search, X } from "lucide-react";
import { cx } from "@/lib/cx";

const control =
  "block w-full min-h-[2.875rem] rounded-[0.75rem] bg-cell px-4 py-2.5 text-body text-label outline-none shadow-[inset_0_0_0_0.5px_var(--separator)] transition-shadow focus:shadow-[inset_0_0_0_2px_var(--tint)] disabled:opacity-50";

interface WrapProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  id: string;
  children: ReactNode;
  optional?: boolean;
  hideLabel?: boolean;
}

function Wrap({ label, hint, error, id, children, optional, hideLabel }: WrapProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cx("px-1 text-subhead font-medium text-label-2", hideLabel && "sr-only")}
      >
        {label}
        {optional && <span className="font-normal text-label-3"> · Optional</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="px-1 text-footnote text-label-2">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-1.5 px-1 text-footnote font-medium text-destructive"
    >
      <CircleAlert aria-hidden className="mt-px size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: string | null) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  hideLabel?: boolean;
}

export function TextField({
  label,
  hint,
  error,
  optional,
  hideLabel,
  className,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  // PINs and passwords get a Show/Hide button, so people can check what they typed.
  const secret = rest.type === "password";
  const input = (
    <input
      id={id}
      className={cx(
        control,
        error && "shadow-[inset_0_0_0_1.5px_var(--destructive)]",
        secret && "pr-12",
        className,
      )}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      {...rest}
      {...(secret ? { type: shown ? "text" : "password" } : {})}
    />
  );
  return (
    <Wrap label={label} hint={hint} error={error} id={id} optional={optional} hideLabel={hideLabel}>
      {secret ? (
        <div className="relative">
          {input}
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? "Hide" : "Show"}
            aria-pressed={shown}
            aria-controls={id}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-label-2 active:opacity-50"
          >
            {shown ? (
              <EyeOff aria-hidden className="size-5" />
            ) : (
              <Eye aria-hidden className="size-5" />
            )}
          </button>
        </div>
      ) : (
        input
      )}
    </Wrap>
  );
}

/** HIG search field: filled, with a magnifying glass and a clear button. */
export function SearchField({
  value,
  onChange,
  label = "Search",
  placeholder = "Search",
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-[1.15rem] -translate-y-1/2 text-label-2"
      />
      <input
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="block min-h-11 w-full rounded-[0.75rem] bg-fill py-2 pr-10 pl-10 text-body outline-none [&::-webkit-search-cancel-button]:hidden focus:shadow-[inset_0_0_0_2px_var(--tint)]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center"
        >
          <span className="inline-flex size-[1.15rem] items-center justify-center rounded-full bg-label-3 text-cell">
            <X aria-hidden className="size-3" strokeWidth={3} />
          </span>
        </button>
      )}
    </div>
  );
}

interface MoneyFieldProps extends TextFieldProps {
  /** Large centred entry, like Apple Cash. Default is a standard field with a GH₵ prefix. */
  hero?: boolean;
}

export function MoneyField({
  label,
  hint,
  error,
  optional,
  hideLabel,
  hero,
  className,
  value,
  ...rest
}: MoneyFieldProps) {
  const id = useId();
  const text = String(value ?? "");
  if (hero) {
    return (
      <div className="flex flex-col items-center gap-1">
        <label
          htmlFor={id}
          className={cx("text-subhead font-medium text-label-2", hideLabel && "sr-only")}
        >
          {label}
        </label>
        <div className="flex max-w-full items-baseline justify-center gap-1 px-2">
          <span aria-hidden className="figure text-title1 font-semibold text-label-2">
            GH₵
          </span>
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            placeholder="0"
            style={{ width: `${Math.max(1, text.length) + 0.25}ch` }}
            className={cx(
              "figure max-w-[80vw] bg-transparent text-center text-[3.5rem] leading-[1.1] font-bold outline-none placeholder:text-label-3",
              className,
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, hint, error)}
            {...rest}
          />
        </div>
        {hint && !error && (
          <p id={`${id}-hint`} className="text-footnote text-label-2">
            {hint}
          </p>
        )}
        {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      </div>
    );
  }
  return (
    <Wrap label={label} hint={hint} error={error} id={id} optional={optional} hideLabel={hideLabel}>
      <div className="relative">
        <span
          aria-hidden
          className="tnum pointer-events-none absolute inset-y-0 left-4 flex items-center text-body text-label-2"
        >
          GH₵
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          className={cx(
            control,
            "tnum pl-14",
            error && "shadow-[inset_0_0_0_1.5px_var(--destructive)]",
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          {...rest}
        />
      </div>
    </Wrap>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  hideLabel?: boolean;
}

/** A pop-up button: native select so the phone shows its own picker. */
export function SelectField({
  label,
  hint,
  error,
  optional,
  hideLabel,
  className,
  children,
  ...rest
}: SelectFieldProps) {
  const id = useId();
  return (
    <Wrap label={label} hint={hint} error={error} id={id} optional={optional} hideLabel={hideLabel}>
      <div className="relative">
        <select
          id={id}
          className={cx(control, "appearance-none pr-11", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          {...rest}
        >
          {children}
        </select>
        <ChevronsUpDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-label-2"
        />
      </div>
    </Wrap>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
}

export function TextAreaField({
  label,
  hint,
  error,
  optional,
  className,
  ...rest
}: TextAreaFieldProps) {
  const id = useId();
  return (
    <Wrap label={label} hint={hint} error={error} id={id} optional={optional}>
      <textarea
        id={id}
        rows={3}
        className={cx(control, "min-h-24 resize-y", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </Wrap>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  hideLabel?: boolean;
}

/** HIG segmented control with a sliding selection thumb. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  hideLabel,
}: SegmentedProps<T>) {
  const id = useId();
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span
        id={id}
        className={cx("px-1 text-subhead font-medium text-label-2", hideLabel && "sr-only")}
      >
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className="relative flex rounded-[0.6rem] bg-fill p-0.5"
      >
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 left-0.5 rounded-[0.5rem] bg-[var(--segment)] shadow-[0_3px_8px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)] transition-transform duration-300 ease-[var(--ease-ios)]"
          style={{
            width: `calc((100% - 0.25rem) / ${options.length})`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.value)}
              className={cx(
                "relative z-10 min-h-10 min-w-0 flex-1 basis-0 truncate rounded-[0.5rem] px-2 text-subhead transition-[font-weight]",
                selected ? "font-semibold text-label" : "font-medium text-label",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** iOS switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-[1.9375rem] w-[3.1875rem] shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40",
        checked ? "bg-paid" : "bg-fill-strong",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "absolute left-0.5 size-[1.6875rem] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)] transition-transform duration-300 ease-[var(--ease-ios)]",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
