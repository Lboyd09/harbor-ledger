import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";
import { Link } from "@tanstack/react-router";

/** 44px ⓘ button. The explanation stays behind the tap. */
export function InfoTip({
  text,
  label = "What is this?",
  href,
  hrefLabel = "More",
}: {
  text: string;
  label?: string;
  href?: string;
  hrefLabel?: string;
}) {
  const hash = href?.includes("#") ? href.slice(href.indexOf("#") + 1) : undefined;
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={label}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base text-muted hover:bg-chip"
      >
        <span aria-hidden="true">ⓘ</span>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={4} className="z-50 max-w-xs rounded-md border border-border bg-surface p-3 text-sm text-fg shadow">
        <p>{text}</p>
        {href ? (
          <Link to="/help" hash={hash} className="mt-1 inline-flex min-h-11 items-center text-primary">
            {hrefLabel}
          </Link>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
