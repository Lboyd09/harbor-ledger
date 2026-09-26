import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/budget/money";

export function CashChart({
  data,
  bars,
  layout = "horizontal",
}: {
  data: { name: string; [key: string]: string | number }[];
  bars: { key: string; fill: string }[];
  layout?: "horizontal" | "vertical";
}) {
  if (!data.length) return <p className="text-sm text-muted">Nothing to chart yet.</p>;
  const height = layout === "vertical" ? Math.max(160, data.length * 36 + 16) : 224;
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {layout === "vertical" ? (
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
            <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 12, fill: "var(--color-fg)" }} />
            <Tooltip
              formatter={(v) => formatMoney(Number(Array.isArray(v) ? v[0] : v))}
              contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8 }}
            />
            {bars.map((b) => (
              <Bar key={b.key} dataKey={b.key} fill={b.fill} radius={2} />
            ))}
          </BarChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-muted)" }} interval={0} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={48} />
            <Tooltip
              formatter={(v) => formatMoney(Number(Array.isArray(v) ? v[0] : v))}
              contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8 }}
            />
            {bars.map((b) => (
              <Bar key={b.key} dataKey={b.key} fill={b.fill} radius={2} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
