export function AdvancedDepth({
  show,
  metrics,
  columns,
  rows,
  assumptions,
  sensitivity,
}: {
  show: boolean;
  metrics: { label: string; value: string }[];
  columns: string[];
  rows: string[][];
  assumptions: string[];
  sensitivity?: { label: string; value: string }[];
}) {
  if (!show) return null;
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-medium">The workings</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {metrics.map((row) => (
          <div key={row.label} className="rounded-md border border-border p-2">
            <div className="text-xs text-muted">{row.label}</div>
            <div className="text-sm font-medium tabular">{row.value}</div>
          </div>
        ))}
      </div>
      {rows.length ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col} className="px-2 py-1 font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-border">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-2 py-1 tabular">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <ul className="space-y-1 text-xs text-muted">
        {assumptions.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {sensitivity?.length ? (
        <div>
          <p className="text-xs font-medium">If a number moves</p>
          <ul className="mt-1 space-y-1 text-xs text-muted">
            {sensitivity.map((row) => (
              <li key={row.label}>
                {row.label}: {row.value}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
