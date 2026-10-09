export function SideSwitch({ side, onChange }: { side: "in" | "out"; onChange: (side: "in" | "out") => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:hidden" role="group" aria-label="Money in or money out">
      {(["in", "out"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={side === value}
          className={`min-h-11 rounded-md border px-3 text-sm ${side === value ? "border-primary bg-chip font-medium" : "border-border"}`}
          onClick={() => onChange(value)}
        >
          {value === "in" ? "In" : "Out"}
        </button>
      ))}
    </div>
  );
}
