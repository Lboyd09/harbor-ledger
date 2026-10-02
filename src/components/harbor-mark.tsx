/** A still ledger: one book, a rule, two entries. No motion. */
export function HarborMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M7 6.5h18v19H7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M7 16h18" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M11 11.2h6M11 20.8h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
