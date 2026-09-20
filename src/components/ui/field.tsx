import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-fg", className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-fg",
        "placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-fg",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-fg",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">{label}</span>
      {children}
    </label>
  );
}
