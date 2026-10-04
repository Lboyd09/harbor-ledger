/** A change chip. The arrow is never the only clue — the word says up, down, or same. */
export function Delta({
  amount,
  goodWhen,
  format,
}: {
  amount: number;
  goodWhen: "up" | "down";
  format: (n: number) => string;
}) {
  const up = amount > 0.004;
  const down = amount < -0.004;
  const word = up ? "Up" : down ? "Down" : "Same";
  const arrow = up ? "↑" : down ? "↓" : "→";
  const good = !up && !down ? true : goodWhen === "up" ? up : down;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-chip px-2 py-0.5 text-xs ${good ? "text-good" : "text-danger"}`}>
      <span aria-hidden>{arrow}</span>
      <span>
        {word} {format(Math.abs(amount))}
      </span>
    </span>
  );
}
