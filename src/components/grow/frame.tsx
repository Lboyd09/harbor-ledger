import type { ReactNode } from "react";
import { tipsFor, type TipFacts } from "@/lib/budget/tips";
import { assumptionLines } from "@/lib/budget/reference";

export function tagOf(source: string) {
  if (source.includes("account")) return "from your accounts";
  if (source.includes("spending") || source.includes("income")) return source.includes("income") ? "from your income" : "from your spending";
  return "typed";
}

export function CalcFrame({
  question,
  numbers,
  result,
  picture,
  keyNumbers,
  topic,
  facts,
  assumptionIds,
  extraAssumptions,
  assumptionEditor,
  years,
  advanced,
}: {
  question: string;
  numbers: ReactNode;
  result: string;
  picture?: ReactNode;
  keyNumbers: { label: string; value: string }[];
  topic: string;
  facts: TipFacts;
  assumptionIds: string[];
  extraAssumptions?: string[];
  assumptionEditor?: ReactNode;
  years?: ReactNode;
  advanced?: ReactNode;
}) {
  const tips = tipsFor(topic, facts);
  const lines = [...assumptionLines(assumptionIds), ...(extraAssumptions ?? [])];
  return (
    <article className="space-y-4">
      <h2 className="font-display text-xl font-semibold">{question}</h2>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-medium">Your numbers</h3>
        <div className="mt-2">{numbers}</div>
      </section>
      <p className="text-sm">{result}</p>
      {picture}
      <section>
        <h3 className="text-sm font-medium">Key numbers</h3>
        <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {keyNumbers.map((row) => (
            <div key={row.label} className="rounded-md border border-border p-2">
              <dt className="text-xs text-muted">{row.label}</dt>
              <dd className="text-sm font-medium tabular">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3 className="text-sm font-medium">Tips</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {tips.map((tip) => (
            <li key={tip.id}>
              {tip.text} <span className="text-xs text-muted">{tip.status}.</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-muted">Not personal advice.</p>
      <details className="rounded-lg border border-border bg-surface p-3">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">Assumptions</summary>
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {assumptionEditor}
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
      {years ? (
        <details className="rounded-lg border border-border bg-surface p-3">
          <summary className="min-h-11 cursor-pointer text-sm font-medium">Show the years</summary>
          <div className="mt-2 max-h-64 overflow-auto">{years}</div>
        </details>
      ) : null}
      {advanced}
    </article>
  );
}

export function Sensitivity({ rows }: { rows: { label: string; value: string }[] }) {
  if (!rows.length) return null;
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-medium">If a number moves</h3>
      <ul className="mt-2 space-y-1 text-xs text-muted">
        {rows.map((row) => (
          <li key={row.label}>
            {row.label}: {row.value}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function YearTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col} className="px-2 py-1 font-medium">{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-t border-border">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="px-2 py-1 tabular">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Field({ label, tag, children }: { label: string; tag: string; children: ReactNode }) {
  return (
    <label className="text-xs text-muted">
      {label}
      {children}
      <span className="mt-1 block">{tag}</span>
    </label>
  );
}
