import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
};

export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  return (
    <button
      className={cn(
        "tap inline-flex items-center justify-center gap-2 rounded-md font-medium",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:opacity-50 disabled:pointer-events-none",
        size === "md" ? "min-h-11 min-w-11 px-4 text-sm" : "min-h-11 min-w-11 px-3 text-sm",
        variant === "primary" && "bg-primary text-primary-fg hover:bg-good",
        variant === "ghost" && "bg-transparent text-fg hover:bg-chip",
        variant === "outline" && "border border-border bg-surface text-fg hover:bg-chip",
        variant === "danger" && "bg-danger text-primary-fg hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
}
