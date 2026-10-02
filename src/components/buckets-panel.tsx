import { useState } from "react";
import { balanceSeries, bucketBalance, goalPace } from "@/lib/budget/buckets";
import { formatMoney } from "@/lib/budget/money";
import { monthShort, shiftMonth } from "@/lib/budget/parse-date";
import type { Category, MoneyBucket } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/field";

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return <p className="text-xs text-muted">Balance starts this month.</p>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const w = 160;
  const h = 36;
  const coords = points
    .map((n, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = max === min ? h / 2 : h - ((n - min) / (max - min)) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full text-primary" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.6" points={coords} />
    </svg>
  );
}

export function BucketsPanel() {
  const buckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const moves = useBudgetStore((s) => s.bucketMoves) ?? [];
  const categories = useBudgetStore((s) => s.categories);
  const transactions = useBudgetStore((s) => s.transactions);
  const ym = useBudgetStore((s) => s.activeMonth);
  const addBucket = useBudgetStore((s) => s.addBucket);
  const updateBucket = useBudgetStore((s) => s.updateBucket);
  const removeBucket = useBudgetStore((s) => s.removeBucket);
  const linkBucketCategory = useBudgetStore((s) => s.linkBucketCategory);
  const unlinkBucketCategory = useBudgetStore((s) => s.unlinkBucketCategory);
  const moveBucketMoney = useBudgetStore((s) => s.moveBucketMoney);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [monthly, setMonthly] = useState("");
  const [yearly, setYearly] = useState("");
  const [target, setTarget] = useState("");
  const [by, setBy] = useState("");
  const expenses = categories.filter((c) => c.kind === "expense" && !c.parentId);

  function add() {
    const yearAmount = Number(yearly);
    const monthAmount = Number(monthly);
    if (!name.trim()) return;
    addBucket({
      name: name.trim(),
      monthly: Number.isFinite(monthAmount) ? monthAmount : 0,
      yearly: Number.isFinite(yearAmount) && yearAmount > 0 ? yearAmount : null,
      categoryIds: [],
      target: Number(target) > 0 ? Number(target) : null,
      by: /^\d{4}-\d{2}$/.test(by) ? by : null,
      startMonth: ym,
      opening: 0,
    });
    setName("");
    setMonthly("");
    setYearly("");
    setTarget("");
    setBy("");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Categories reset every month. Buckets keep what you don't spend.</p>
      {notice ? <p className="rounded-md bg-chip px-3 py-2 text-sm">{notice}</p> : null}
      {buckets.length ? (
        <ul className="grid gap-3">
          {buckets.map((bucket) => (
            <BucketCard
              key={bucket.id}
              bucket={bucket}
              ym={ym}
              expenses={expenses}
              open={openId === bucket.id}
              onToggle={() => setOpenId(openId === bucket.id ? null : bucket.id)}
              balance={bucketBalance(bucket, ym, transactions, categories, moves)}
              previous={bucketBalance(bucket, shiftMonth(ym, -1), transactions, categories, moves)}
              series={balanceSeries(bucket, ym, transactions, categories, moves).map((p) => p.balance)}
              seriesLabels={balanceSeries(bucket, ym, transactions, categories, moves).map((p) => monthShort(p.ym))}
              peers={buckets.filter((b) => b.id !== bucket.id)}
              onLink={(categoryId) => setNotice(linkBucketCategory(bucket.id, categoryId))}
              onUnlink={(categoryId) => unlinkBucketCategory(bucket.id, categoryId)}
              onMove={(fromId, amount) => moveBucketMoney({ ym, amount, fromId, toId: bucket.id })}
              onChange={(patch) => updateBucket(bucket.id, patch)}
              onRemove={() => removeBucket(bucket.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No buckets yet. A groceries bucket or a car fund is a fine start.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Input aria-label="Bucket name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input aria-label="Monthly amount" inputMode="decimal" placeholder="Monthly amount" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        <Input aria-label="Yearly amount" inputMode="decimal" placeholder="Or a yearly amount" value={yearly} onChange={(e) => setYearly(e.target.value)} />
        <Input aria-label="Target amount" inputMode="decimal" placeholder="Target, optional" value={target} onChange={(e) => setTarget(e.target.value)} />
        <Input aria-label="Target month" placeholder="Target month 2027-06" value={by} onChange={(e) => setBy(e.target.value)} />
      </div>
      <Button size="sm" variant="outline" onClick={add} disabled={!name.trim()}>
        Add a bucket
      </Button>
    </div>
  );
}

function BucketCard({
  bucket,
  ym,
  expenses,
  open,
  onToggle,
  balance,
  previous,
  series,
  seriesLabels,
  peers,
  onLink,
  onUnlink,
  onMove,
  onChange,
  onRemove,
}: {
  bucket: MoneyBucket;
  ym: string;
  expenses: Category[];
  open: boolean;
  onToggle: () => void;
  balance: number;
  previous: number;
  series: number[];
  seriesLabels: string[];
  peers: MoneyBucket[];
  onLink: (id: string) => void;
  onUnlink: (id: string) => void;
  onMove: (fromId: string | null, amount: number) => void;
  onChange: (patch: Partial<Omit<MoneyBucket, "id">>) => void;
  onRemove: () => void;
}) {
  const delta = Math.round((balance - previous) * 100) / 100;
  const pace = goalPace(bucket, balance, ym);
  const pct = bucket.target && bucket.target > 0 ? Math.max(0, Math.min(100, Math.round((balance / bucket.target) * 100))) : null;
  const [fromId, setFromId] = useState<string>("");
  const [amount, setAmount] = useState(balance < 0 ? String(Math.abs(balance)) : "");
  const sentence =
    Math.abs(delta) < 0.5
      ? "Same as last month."
      : delta > 0
        ? `${formatMoney(delta)} more than last month.`
        : `${formatMoney(Math.abs(delta))} less than last month.`;
  const linked = expenses.filter((c) => bucket.categoryIds.includes(c.id));
  const available = expenses.filter((c) => !bucket.categoryIds.includes(c.id));

  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="text-sm text-muted">{bucket.name}</div>
      <div className={`mt-1 font-display text-3xl font-semibold tabular ${balance < 0 ? "text-danger" : ""}`}>
        {formatMoney(balance, { signed: true })}
      </div>
      <p className="mt-1 text-sm text-muted">{sentence}</p>
      {pct != null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-chip">
          <div className="goal-fill h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {balance < 0 ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Select aria-label={`Move money into ${bucket.name}`} value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">Unassigned</option>
            {peers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input className="w-28" inputMode="decimal" aria-label="Amount to move" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const n = Number(amount);
              if (n > 0) onMove(fromId || null, n);
            }}
          >
            Move money in
          </Button>
        </div>
      ) : null}
      <button type="button" className="mt-3 min-h-9 text-sm font-medium text-primary" onClick={onToggle}>
        {open ? "Hide details" : "Show details"}
      </button>
      {open ? (
        <div className="detail-in mt-3 space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Monthly amount
              <Input
                className="mt-1"
                inputMode="decimal"
                value={bucket.yearly ? "" : String(bucket.monthly || "")}
                placeholder={bucket.yearly ? formatMoney(bucket.monthly) : "0"}
                onChange={(e) => onChange({ monthly: Number(e.target.value) || 0, yearly: null })}
              />
            </label>
            <label className="text-xs text-muted">
              Yearly amount
              <Input
                className="mt-1"
                inputMode="decimal"
                value={bucket.yearly ? String(bucket.yearly) : ""}
                placeholder="Optional"
                onChange={(e) => onChange({ yearly: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <p className="text-xs text-muted">
            {bucket.yearly
              ? `${formatMoney(bucket.yearly)} a year is ${formatMoney(bucket.monthly)} a month.`
              : "A yearly amount is shown as its monthly equivalent."}{" "}
            Starts {bucket.startMonth}. Opening {formatMoney(bucket.opening)}.
          </p>
          <div>
            <div className="text-xs text-muted">Linked categories</div>
            {linked.length ? (
              <ul className="mt-1 space-y-1">
                {linked.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span>{c.name}</span>
                    <button type="button" className="text-xs text-muted" onClick={() => onUnlink(c.id)}>
                      Unlink
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted">None yet. Spending in a linked category comes out of this balance.</p>
            )}
            {available.length ? (
              <Select
                className="mt-2"
                aria-label={`Link a category to ${bucket.name}`}
                value=""
                onChange={(e) => {
                  if (e.target.value) onLink(e.target.value);
                }}
              >
                <option value="">Link a category…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
          <div>
            <div className="text-xs text-muted">Balance</div>
            <Spark points={series} />
            <p className="text-xs text-muted">{seriesLabels[0]} to {seriesLabels.at(-1)}</p>
          </div>
          {pace ? (
            <p className="text-xs text-muted">
              {pace.left <= 0
                ? "This goal is funded."
                : pace.required != null && bucket.by
                  ? `Set aside ${formatMoney(pace.required)} a month to finish by ${bucket.by}. ${formatMoney(pace.left)} left.`
                  : `${formatMoney(pace.left)} still to go.`}
              {pace.projected && pace.left > 0 ? ` At the current monthly amount, it finishes around ${pace.projected}.` : ""}
            </p>
          ) : null}
          {balance >= 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <Select aria-label={`Move money into ${bucket.name}`} value={fromId} onChange={(e) => setFromId(e.target.value)}>
                <option value="">From unassigned</option>
                {peers.map((p) => (
                  <option key={p.id} value={p.id}>
                    From {p.name}
                  </option>
                ))}
              </Select>
              <Input className="w-28" inputMode="decimal" aria-label="Amount to move" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const n = Number(amount);
                  if (n > 0) onMove(fromId || null, n);
                }}
              >
                Move money in
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-muted">A move is not income and not spending. A real purchase still counts as an expense.</p>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            Remove bucket
          </Button>
        </div>
      ) : null}
    </li>
  );
}
