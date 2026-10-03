import { useState } from "react";
import { bucketActivity, bucketBalance, fullLineOf, fundingForMonth, goalPace } from "@/lib/budget/buckets";
import { formatMoney } from "@/lib/budget/money";
import { monthShort, shiftMonth } from "@/lib/budget/parse-date";
import type { MoneyBucket } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { FillJar } from "./money-visual";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/field";

export function BucketsPanel() {
  const categories = useBudgetStore((s) => s.categories);
  const transactions = useBudgetStore((s) => s.transactions);
  const ym = useBudgetStore((s) => s.activeMonth);
  const buckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const moves = useBudgetStore((s) => s.bucketMoves) ?? [];
  const addBucket = useBudgetStore((s) => s.addBucket);
  const [name, setName] = useState("");
  const [monthly, setMonthly] = useState("");
  const [yearly, setYearly] = useState("");
  const [target, setTarget] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="max-w-xl text-sm text-muted">
        A bucket keeps what you don’t spend. The money is not income and it is not a new expense. A category here is not also a monthly limit.
      </p>
      {buckets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
          No buckets yet. Add one for a car, a trip, or groceries you want to carry forward.
        </p>
      ) : null}
      <ul className="space-y-3">
        {buckets.map((bucket) => (
          <BucketCard
            key={bucket.id}
            bucket={bucket}
            open={openId === bucket.id}
            onToggle={() => setOpenId(openId === bucket.id ? null : bucket.id)}
            ym={ym}
            balance={bucketBalance(bucket, ym, transactions, categories, moves)}
            previous={bucketBalance(bucket, shiftMonth(ym, -1), transactions, categories, moves)}
            activity={bucketActivity(bucket, ym, transactions, categories, moves)}
          />
        ))}
      </ul>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Add a bucket</h2>
        <p className="mt-1 text-sm text-muted">It gets this month’s amount right away. Later changes start next month.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Input aria-label="Bucket name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input aria-label="Amount each month" inputMode="decimal" placeholder="Each month" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
          <Input aria-label="Amount each year" inputMode="decimal" placeholder="Or each year" value={yearly} onChange={(e) => setYearly(e.target.value)} />
          <Input aria-label="Target amount" inputMode="decimal" placeholder="Target, optional" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <Button
          className="mt-3"
          disabled={!name.trim() || !(Number(monthly) > 0 || Number(yearly) > 0)}
          onClick={() => {
            const yearN = Number(yearly);
            addBucket({
              name: name.trim(),
              monthly: Number(monthly) || 0,
              yearly: yearN > 0 ? yearN : null,
              categoryIds: [],
              target: Number(target) > 0 ? Number(target) : null,
              by: null,
              startMonth: ym,
              opening: 0,
              fullLine: null,
            });
            setName("");
            setMonthly("");
            setYearly("");
            setTarget("");
          }}
        >
          Add this bucket
        </Button>
      </section>
    </div>
  );
}

function BucketCard({
  bucket,
  open,
  onToggle,
  ym,
  balance,
  previous,
  activity,
}: {
  bucket: MoneyBucket;
  open: boolean;
  onToggle: () => void;
  ym: string;
  balance: number;
  previous: number;
  activity: { ym: string; funded: number; spent: number }[];
}) {
  const categories = useBudgetStore((s) => s.categories);
  const buckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const updateBucket = useBudgetStore((s) => s.updateBucket);
  const removeBucket = useBudgetStore((s) => s.removeBucket);
  const linkBucketCategory = useBudgetStore((s) => s.linkBucketCategory);
  const setKeepsLeftovers = useBudgetStore((s) => s.setKeepsLeftovers);
  const moveBucketMoney = useBudgetStore((s) => s.moveBucketMoney);
  const line = fullLineOf(bucket);
  const pct = line > 0 ? (balance / line) * 100 : 0;
  const negative = balance < -0.004;
  const overflow = balance > line + 0.004;
  const delta = balance - previous;
  const sentence = bucket.paused
    ? "Paused. Nothing is added until you turn it back on."
    : negative
      ? `Short ${formatMoney(Math.abs(balance))}. Move money in.`
      : delta > 0.004
        ? `${formatMoney(delta)} more than last month.`
        : delta < -0.004
          ? `${formatMoney(Math.abs(delta))} less than last month.`
          : "Same as last month.";
  const goalHit = Boolean(bucket.target && bucket.target > 0 && balance + 0.004 >= bucket.target);
  const extra = Math.max(0, balance - line);
  const showNudge = (overflow || goalHit) && bucket.nudgeDismissedYm !== ym;
  const pace = goalPace(bucket, balance, ym);
  const linked = categories.filter((c) => bucket.categoryIds.includes(c.id));
  const available = categories.filter((c) => c.kind === "expense" && !c.parentId && !buckets.some((b) => b.categoryIds.includes(c.id)));
  const maxBar = Math.max(1, ...activity.flatMap((row) => [row.funded, row.spent]));
  const thisMonth = fundingForMonth(bucket, ym);
  const future = bucket.monthlyFrom && bucket.monthlyFrom > ym;

  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <FillJar pct={pct} negative={negative} overflow={overflow} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">{bucket.name}</div>
          <div className={`font-display text-3xl tabular ${negative ? "text-danger" : ""}`}>{formatMoney(balance)}</div>
          <p className="mt-1 text-sm text-muted">{sentence}</p>
        </div>
      </button>
      {showNudge ? (
        <p className="mt-3 text-sm">
          {extra > 0 ? `${formatMoney(extra)} extra here. ` : "This goal is reached. "}
          <a className="font-medium text-primary" href={`/grow?lump=${Math.round(extra > 0 ? extra : balance)}`}>
            Want to see what it could grow to?
          </a>{" "}
          <button type="button" className="text-muted underline-offset-2 hover:underline" onClick={() => updateBucket(bucket.id, { nudgeDismissedYm: ym })}>
            Not now
          </button>
          <span className="mt-1 block text-xs text-muted">An estimate, not financial advice.</span>
        </p>
      ) : null}
      {open ? (
        <div className="detail-in mt-4 space-y-4 border-t border-border pt-4">
          {pace && bucket.target ? (
            <div>
              <div className="text-sm font-medium">Toward {formatMoney(bucket.target)}</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-chip">
                <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, (balance / bucket.target) * 100))}%` }} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {pace.left <= 0
                  ? "The target is reached."
                  : pace.required != null && bucket.by
                    ? `${formatMoney(pace.required)} a month reaches it by ${bucket.by}.`
                    : pace.projected
                      ? `At the current amount, about ${pace.projected}.`
                      : `${formatMoney(pace.left)} still to go.`}
              </p>
            </div>
          ) : null}
          {activity.length ? (
            <div>
              <div className="text-sm font-medium">Added and spent</div>
              <div className="mt-2 flex items-end gap-1 overflow-x-auto">
                {activity.map((row) => (
                  <div key={row.ym} className="flex w-7 shrink-0 flex-col items-center gap-1">
                    <div className="flex h-16 w-full items-end gap-0.5">
                      <div className="w-1/2 rounded-sm bg-primary/80" style={{ height: `${Math.max(2, (row.funded / maxBar) * 100)}%` }} />
                      <div className="w-1/2 rounded-sm bg-danger/70" style={{ height: `${Math.max(2, (row.spent / maxBar) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-muted">{monthShort(row.ym)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">The first bar is what was added. The second is what you spent.</p>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Name
              <Input className="mt-1" value={bucket.name} onChange={(e) => updateBucket(bucket.id, { name: e.target.value })} />
            </label>
            <label className="text-xs text-muted">
              Each month
              <Input
                className="mt-1"
                inputMode="decimal"
                value={String(bucket.monthly || "")}
                onChange={(e) => updateBucket(bucket.id, { monthly: Number(e.target.value) || 0, yearly: null })}
              />
            </label>
            <label className="text-xs text-muted">
              Or each year
              <Input
                className="mt-1"
                inputMode="decimal"
                value={bucket.yearly ? String(bucket.yearly) : ""}
                placeholder="Optional"
                onChange={(e) => updateBucket(bucket.id, { yearly: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="text-xs text-muted">
              Full line
              <Input
                className="mt-1"
                inputMode="decimal"
                value={bucket.fullLine ? String(bucket.fullLine) : ""}
                placeholder={line ? `Automatic ${line}` : "Automatic"}
                onChange={(e) => updateBucket(bucket.id, { fullLine: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="text-xs text-muted">
              Target
              <Input
                className="mt-1"
                inputMode="decimal"
                value={bucket.target ? String(bucket.target) : ""}
                placeholder="Optional"
                onChange={(e) => updateBucket(bucket.id, { target: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="text-xs text-muted">
              Target month
              <Input className="mt-1" type="month" value={bucket.by ?? ""} onChange={(e) => updateBucket(bucket.id, { by: e.target.value || null })} />
            </label>
          </div>
          <p className="text-xs text-muted">
            {future
              ? `This month already added ${formatMoney(thisMonth)}. The monthly number starts ${bucket.monthlyFrom}.`
              : `This month adds ${formatMoney(thisMonth)}. A bucket started this month is funded right away.`}
          </p>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(bucket.paused)} onChange={(e) => updateBucket(bucket.id, { paused: e.target.checked })} />
            Pause — add nothing until you turn this off
          </label>
          <div>
            <div className="text-sm font-medium">Comes out of this bucket</div>
            <ul className="mt-1 space-y-1 text-sm">
              {linked.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span>{c.name}</span>
                  <button type="button" className="text-xs text-muted" onClick={() => setKeepsLeftovers(c.id, false)}>
                    Resets every month instead
                  </button>
                </li>
              ))}
              {linked.length === 0 ? <li className="text-muted">Nothing is linked. Spending stays on the monthly budgets.</li> : null}
            </ul>
            {available.length ? (
              <Select
                className="mt-2"
                aria-label={`Link a category to ${bucket.name}`}
                value=""
                onChange={(e) => {
                  if (e.target.value) linkBucketCategory(bucket.id, e.target.value);
                }}
              >
                <option value="">Add a category…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
          <MoveIn bucket={bucket} ym={ym} negative={negative} />
          <Button variant="ghost" size="sm" onClick={() => removeBucket(bucket.id)}>
            Remove bucket
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function MoveIn({ bucket, ym, negative }: { bucket: MoneyBucket; ym: string; negative: boolean }) {
  const buckets = useBudgetStore((s) => s.moneyBuckets) ?? [];
  const moveBucketMoney = useBudgetStore((s) => s.moveBucketMoney);
  const [fromId, setFromId] = useState("");
  const [amount, setAmount] = useState("");
  const others = buckets.filter((b) => b.id !== bucket.id);
  return (
    <div className={`rounded-md border p-3 ${negative ? "border-danger/40" : "border-border"}`}>
      <div className="text-sm font-medium">{negative ? "Move money in" : "Move money"}</div>
      <p className="mt-1 text-xs text-muted">This is not income and not spending. It only moves money you already have.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <Select aria-label="Move from" value={fromId} onChange={(e) => setFromId(e.target.value)}>
          <option value="">Unassigned</option>
          {others.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Input aria-label="Amount to move" inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button
          size="sm"
          variant="outline"
          disabled={!(Number(amount) > 0)}
          onClick={() => {
            moveBucketMoney({ ym, amount: Number(amount), fromId: fromId || null, toId: bucket.id });
            setAmount("");
          }}
        >
          Move in
        </Button>
      </div>
    </div>
  );
}
