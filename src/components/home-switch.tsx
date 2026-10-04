import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/cn";

/** Home and Month share one control. Month is not its own tab. */
export function HomeSwitch() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onHome = path === "/";
  const item = (on: boolean) =>
    cn("inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium", on ? "bg-primary text-primary-fg" : "text-muted");
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-1" role="tablist" aria-label="Home or this month">
      <Link to="/" role="tab" aria-selected={onHome} className={item(onHome)}>
        Home
      </Link>
      <Link to="/month" role="tab" aria-selected={!onHome} className={item(!onHome)}>
        Month
      </Link>
    </div>
  );
}
