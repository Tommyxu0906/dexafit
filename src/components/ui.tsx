import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
        {required ? <span className="ml-1 text-rose-600">*</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const controlClass =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-slate-50";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`${controlClass} ${className}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`${controlClass} min-h-28 ${className}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select {...rest} className={`${controlClass} ${className}`}>
      {children}
    </select>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants = {
    primary: "bg-ink text-white hover:bg-slate-800",
    secondary: "border border-line bg-white text-ink hover:bg-slate-50",
    ghost: "text-ink hover:bg-slate-100",
    danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
    />
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <div className={`rounded-xl border p-4 text-sm leading-relaxed ${tones[tone]}`}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-rose-100 text-rose-800",
    info: "bg-blue-100 text-blue-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Marks a rule as DexaFit policy rather than a licensing-law requirement. */
export function RequirementTag({
  legalRequirement,
}: {
  legalRequirement: boolean;
}) {
  return legalRequirement ? (
    <Badge tone="info">Required for licensure</Badge>
  ) : (
    <Badge tone="neutral">DexaFit marketplace requirement</Badge>
  );
}

/** Exclusive sibling of CheckboxRow, for a choice that branches the wizard. */
export function RadioRow({
  name,
  value,
  label,
  defaultChecked,
  description,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
  description?: string;
}) {
  const id = `${name}-${value}`;
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3 text-sm hover:bg-slate-50 has-checked:border-accent has-checked:bg-emerald-50/50"
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-emerald-600"
      />
      <span>
        <span className="font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function CheckboxRow({
  name,
  value,
  label,
  defaultChecked,
  description,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
  description?: string;
}) {
  const id = `${name}-${value}`;
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3 text-sm hover:bg-slate-50 has-checked:border-accent has-checked:bg-emerald-50/50"
    >
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 accent-emerald-600"
      />
      <span>
        <span className="font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-slate-50 p-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}
