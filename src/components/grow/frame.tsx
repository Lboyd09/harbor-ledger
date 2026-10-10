import type { ReactNode } from "react";
import { Footnote } from "@/components/footnote";
import { InfoTip } from "@/components/info-tip";
import { tipsFor, type TipFacts } from "@/lib/budget/tips";
import { assumptionLines, figureById } from "@/lib/budget/reference";

export function CalcFrame({
  question,
  info,
  numbers,
  headline,
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
  missing,
}: {
  question: string;
  info?: { text: string; label?: string; href?: string };
  numbers: ReactNode;
  /** One big number, plus a short sub-line, above the result sentence. */
  headline?: { value: string; sub?: string };
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
  /** When a needed box is blank, this sentence replaces every result, picture, and table. */
  missing?: string | null;
}) {
  const tips = tipsFor(topic, facts);
  const lines = [...assumptionLines(assumptionIds), ...(extraAssumptions ?? [])].filter((line) => line.trim());
  const first = tips[0];
  const rest = tips.slice(1);
  return (
    <article className="space-y-4">
      <div className="flex items-center gap-1">
        <h2 className="font-display text-xl font-semibold">{question}</h2>
        {info ? <InfoTip text={info.text} label={info.label} href={info.href} hrefLabel="More" /> : null}
      </div>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-medium">Your numbers</h3>
        <div className="mt-2">{numbers}</div>
      </section>
      {missing ? (
        <p className="rounded-md border border-dashed border-border p-3 text-sm" role="status">
          {missing}
        </p>
      ) : (
        <>
          {headline ? (
            <div>
              <p className="font-display text-3xl font-semibold tabular">{headline.value}</p>
              {headline.sub ? <p className="text-sm text-muted">{headline.sub}</p> : null}
            </div>
          ) : null}
          {result ? <p className="text-sm">{result}</p> : null}
          {picture}
          {keyNumbers.length ? (
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
          ) : null}
        </>
      )}
      {first ? <p className="text-sm">{first.text}</p> : null}
      {rest.length ? (
        <details className="rounded-lg border border-border bg-surface p-3">
          <summary className="min-h-11 cursor-pointer text-sm font-medium">Tips ({tips.length})</summary>
          <ul className="mt-2 space-y-2 text-sm">
            {rest.map((tip) => (
              <li key={tip.id}>{tip.text}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {lines.length || assumptionEditor ? (
        <details className="rounded-lg border border-border bg-surface p-3">
          <summary className="min-h-11 cursor-pointer text-sm font-medium">Assumptions</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {assumptionEditor}
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <Citations ids={assumptionIds} />
      {years && !missing ? (
        <details className="rounded-lg border border-border bg-surface p-3">
          <summary className="min-h-11 cursor-pointer text-sm font-medium">Show the years</summary>
          <div className="mt-2 max-h-64 overflow-auto">{years}</div>
        </details>
      ) : null}
      {missing ? null : advanced}
      <Footnote />
    </article>
  );
}

export function Citations({ ids }: { ids: string[] }) {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const id of ids) {
    const figure = figureById(id);
    if (!figure || !/Bengen|BudgetFlow planning range|IRS/i.test(figure.source)) continue;
    if (seen.has(figure.source)) continue;
    seen.add(figure.source);
    lines.push(figure.source);
  }
  if (!lines.length) return null;
  return (
    <details className="rounded-lg border border-border bg-surface p-3">
      <summary className="min-h-11 cursor-pointer text-sm font-medium">Where these numbers come from</summary>
      <ul className="mt-2 space-y-1 text-xs text-muted">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

export function Sensitivity({ rows }: { rows: { label: string; value: string }[] }) {
  if (!rows.length) return null;
  return (
    <details className="rounded-lg border border-border bg-surface p-3">
      <summary className="min-h-11 cursor-pointer text-sm font-medium">If a number moves</summary>
      <ul className="mt-2 space-y-1 text-xs text-muted">
        {rows.map((row) => (
          <li key={row.label}>
            {row.label}: {row.value}
          </li>
        ))}
      </ul>
    </details>
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

export function Field({ label, tag, children }: { label: string; tag?: string; children: ReactNode }) {
  const fromAccounts = Boolean(tag && /account/i.test(tag) && tag !== "typed");
  return (
    <label className="text-xs text-muted">
      {label}
      {children}
      {fromAccounts ? <span className="mt-1 block text-xs">↺ from your accounts</span> : null}
    </label>
  );
}
