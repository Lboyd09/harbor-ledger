/** Small inline pictures for empty screens. No image files. */
export function EmptyArt({ kind }: { kind: "home" | "budget" | "funds" | "grow" | "sorting" }) {
  return (
    <svg viewBox="0 0 160 96" className="mx-auto h-24 w-40 text-primary" aria-hidden>
      <rect x="8" y="16" width="144" height="68" rx="12" fill="var(--color-chip)" stroke="currentColor" strokeWidth="2" />
      {kind === "home" ? (
        <>
          <path d="M20 62c10-16 18-22 28-22s14 10 22 10 12-18 24-18 16 12 28 22" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="48" cy="40" r="4" fill="currentColor" />
        </>
      ) : null}
      {kind === "budget" ? <rect x="28" y="36" width="18" height="32" rx="4" fill="currentColor" opacity="0.8" /> : null}
      {kind === "budget" ? <rect x="54" y="28" width="18" height="40" rx="4" fill="currentColor" opacity="0.45" /> : null}
      {kind === "funds" ? <path d="M70 28h20v8h-6v28h-8V36h-6z" fill="currentColor" /> : null}
      {kind === "grow" ? <path d="M30 68c16-4 24-20 36-28 10 12 22 16 40 8" fill="none" stroke="currentColor" strokeWidth="3" /> : null}
      {kind === "sorting" ? (
        <>
          <circle cx="48" cy="48" r="8" fill="currentColor" />
          <circle cx="80" cy="40" r="8" fill="currentColor" opacity="0.55" />
          <circle cx="108" cy="56" r="8" fill="currentColor" opacity="0.35" />
        </>
      ) : null}
    </svg>
  );
}
