/** The same chart as a table, one tap away. */
export function ShowNumbers({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <details className="mt-2">
      <summary className="min-h-11 cursor-pointer text-sm text-muted">Show as numbers</summary>
      <p className="mt-2 text-sm">{caption}</p>
      <div className="mt-2 max-w-full overflow-x-auto">
        <table className="w-full min-w-0 text-left text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} className="border-b border-border py-1 pr-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border-b border-border py-1 pr-3 tabular">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
