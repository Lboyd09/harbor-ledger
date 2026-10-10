import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { accountKindLabel } from "@/lib/budget/accounts";
import { accountRows } from "@/lib/budget/dashboard";
import type { LumpPoint } from "@/lib/budget/lump";
import { axisMoney, formatMoney } from "@/lib/budget/money";
import { InfoTip } from "./info-tip";
import type { Account, AccountKind, BalancePoint, NetWorthPoint } from "@/lib/budget/types";
import { useState } from "react";
import { Donut } from "./visuals/donut";
import { ShowNumbers } from "./visuals/show-numbers";
import { StackedBar } from "./visuals/stacked-bar";

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function YourMoney({
  accounts,
  balances,
  netWorth: _snapshots,
}: {
  accounts: Account[];
  balances: BalancePoint[];
  netWorth: NetWorthPoint[];
}) {
  void _snapshots;
  const view = accountRows(accounts, balances, todayIso());
  const byKind = new Map<AccountKind, number>();
  for (const row of view.rows) {
    if (row.owed || row.amount <= 0) continue;
    byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + row.amount);
  }
  const parts = [...byKind.entries()].map(([kind, value]) => ({ id: kind, label: accountKindLabel(kind), value }));
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">Your money today</h2>
      <p className="mt-1 text-sm text-muted">Debts are in the net, not drawn.</p>
      <div className="mt-3">
        <Donut parts={parts} centerLabel={formatMoney(view.net, { signed: true })} />
      </div>
      <p className="mt-2 text-sm">Net across accounts: {formatMoney(view.net, { signed: true })}.</p>
    </section>
  );
}

const PLACES: {
  id: string;
  short: string;
  name: string;
  x: number;
  y: number;
  what: string;
  who: string;
  tax: string;
  caution: string;
}[] = [
  {
    id: "savings",
    short: "Savings",
    name: "Savings account",
    x: 16,
    y: 78,
    what: "A bank account you can usually reach in a day or two.",
    who: "Fits money you might need soon.",
    tax: "Interest is usually taxed the year you earn it.",
    caution: "A bank can pay very little. The rate is not a promise.",
  },
  {
    id: "hysa",
    short: "High-yield",
    name: "High-yield savings",
    x: 34,
    y: 62,
    what: "A savings account that aims to pay more interest.",
    who: "Fits an emergency fund you still want nearby.",
    tax: "Interest is usually taxed the year you earn it.",
    caution: "The rate can change. Check the bank, not this picture.",
  },
  {
    id: "cd",
    short: "CDs",
    name: "CDs",
    x: 52,
    y: 80,
    what: "You lock money for a set time for a set rate.",
    who: "Fits money you know you will not need until that date.",
    tax: "Interest is usually taxed as you earn it.",
    caution: "Taking it out early can cost a penalty.",
  },
  {
    id: "index",
    short: "Index funds",
    name: "Index funds or a brokerage account",
    x: 28,
    y: 18,
    what: "A basket of many companies, bought through a brokerage.",
    who: "Fits money you can leave alone for years.",
    tax: "Selling can create a tax bill. A retirement account follows different rules.",
    caution: "The value can drop. Positions are rough. Real products vary.",
  },
  {
    id: "match",
    short: "401(k) match",
    name: "Workplace 401(k) match",
    x: 58,
    y: 40,
    what: "Your job adds money when you do, up to its own limit.",
    who: "Fits someone whose job offers a match.",
    tax: "Traditional workplace plans are usually taxed later. Roth versions are taxed now. Check current rules.",
    caution: "The match is the part that is free. The rest is your own money, locked until later in most cases.",
  },
  {
    id: "roth",
    short: "Roth IRA",
    name: "Roth IRA",
    x: 78,
    y: 24,
    what: "A retirement account you fund with money you already paid tax on.",
    who: "Fits someone under the income limit who can leave it for retirement.",
    tax: "Growth is not taxed again in this estimate if you follow the rules. Check current rules.",
    caution: "There is a yearly limit. Taking earnings out early can cost a penalty.",
  },
  {
    id: "trad",
    short: "Traditional",
    name: "Traditional IRA",
    x: 80,
    y: 58,
    what: "A retirement account you may get a tax break for funding now.",
    who: "Fits someone who expects a lower tax rate later.",
    tax: "The money is taxed when you take it out in this estimate. Check current rules.",
    caution: "There is a yearly limit, and the deduction depends on your income and a workplace plan.",
  },
];

export function PlaceMap() {
  const [open, setOpen] = useState<string | null>(null);
  const place = PLACES.find((item) => item.id === open) ?? null;
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-display text-xl font-semibold">Pick a place</h2>
      <p className="mt-1 text-sm">Tap a dot to compare.</p>
      <div className="relative mt-3 h-72 overflow-hidden rounded-md border border-border bg-chip">
        <span className="absolute left-2 top-2 text-xs text-muted">Can swing</span>
        <span className="absolute bottom-2 left-2 text-xs text-muted">Steady</span>
        <span className="absolute bottom-2 right-2 text-xs text-muted">Locked until later</span>
        <span className="absolute bottom-2 left-1/3 text-xs text-muted">Easy to get at</span>
        {PLACES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-primary bg-surface px-2 py-1 text-[11px]"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            aria-pressed={open === item.id}
            onClick={() => setOpen(open === item.id ? null : item.id)}
          >
            {item.short}
          </button>
        ))}
      </div>

      {place ? (
        <div className="mt-3 rounded-md border border-border p-3 text-sm">
          <p className="font-medium">{place.name}</p>
          <p className="mt-1">{place.what}</p>
          <p className="mt-1">Who it fits: {place.who}</p>
          <p className="mt-1">Tax: {place.tax}</p>
          <p className="mt-1">Caution: {place.caution}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">No place selected.</p>
      )}
    </section>
  );
}

export function GrowthArea({
  points,
  rate,
  today,
  lively,
}: {
  points: LumpPoint[];
  /** The typed yearly rate as a decimal. */
  rate: number;
  today: boolean;
  lively: boolean;
}) {
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  return (
    <figure>
      <p className="flex items-center text-sm">
        {`Band: ${pct(rate - 0.02)}–${pct(rate + 0.02)}${today ? " · today's dollars" : ""}`}
        <InfoTip label="About this chart" text="Before tax, at the rate you typed and 2 points either side. The put-in row does not grow." />
      </p>
      <div className="chart-rise mt-2 h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--color-muted)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} width={56} tickFormatter={(value) => axisMoney(Number(value))} />
            <Tooltip formatter={(v) => formatMoney(Number(Array.isArray(v) ? v[0] : v))} />
            <Area type="monotone" dataKey="high" name="2 points higher" stroke="var(--color-muted)" fill="var(--color-primary)" fillOpacity={0.12} isAnimationActive={lively} />
            <Area type="monotone" dataKey="mid" name="Rate you typed" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.28} isAnimationActive={lively} />
            <Area type="monotone" dataKey="low" name="2 points lower" stroke="var(--color-warn)" fill="transparent" isAnimationActive={lively} />
            <Area type="monotone" dataKey="putIn" name="Put in" stroke="var(--color-fg)" fill="var(--color-chip)" fillOpacity={0.95} isAnimationActive={lively} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ShowNumbers
        caption=""
        columns={["Year", "Put in", "2 points lower", "Rate you typed", "2 points higher"]}
        rows={points.map((point) => [String(point.year), formatMoney(point.putIn), formatMoney(point.low), formatMoney(point.mid), formatMoney(point.high)])}
      />
    </figure>
  );
}

export function RothBars({ roth, traditional, taxNow, taxLater }: { roth: number; traditional: number; taxNow: string; taxLater: string }) {
  const winner = roth === traditional ? "They come out the same in this estimate." : roth > traditional ? "Roth ends higher in this estimate." : "Traditional ends higher in this estimate.";
  return (
    <figure>
      <p className="text-sm">
        {winner} Tax now {taxNow}%. Tax later {taxLater}%.
      </p>
      <div className="mt-2">
        <StackedBar
          parts={[
            { label: "Roth", value: roth, tone: "primary" },
            { label: "Traditional", value: traditional, tone: "warn" },
          ]}
        />
      </div>
    </figure>
  );
}

export function PayoffRace({
  snowMonths,
  avaMonths,
  snowInterest,
  avaInterest,
}: {
  snowMonths: number;
  avaMonths: number;
  snowInterest: number;
  avaInterest: number;
}) {
  const max = Math.max(snowMonths, avaMonths, 1);
  const snowX = Math.max(8, (snowMonths / max) * 100);
  const avaX = Math.max(8, (avaMonths / max) * 100);
  const gap = Math.abs(snowInterest - avaInterest);
  const less = avaInterest <= snowInterest ? "Highest interest first" : "Smallest balance first";
  const same = gap < 0.005 && snowMonths === avaMonths;
  return (
    <figure>
      <p className="text-sm">
        {same ? "Same interest either way." : `${less === "Highest interest first" ? "Highest-rate first" : "Smallest balance first"} saves ${formatMoney(gap)}`}
      </p>
      <svg viewBox="0 0 320 120" className="mt-2 h-36 w-full" role="img" aria-label="Payoff comparison">
        <text x="8" y="22" fontSize="14" fill="var(--color-fg)">
          Smallest balance first
        </text>
        <line x1="8" y1="40" x2={8 + snowX * 3} y2="40" stroke="var(--color-primary)" strokeWidth="10" strokeLinecap="round" />
        <text x="8" y="72" fontSize="14" fill="var(--color-fg)">
          Highest interest first
        </text>
        <line x1="8" y1="90" x2={8 + avaX * 3} y2="90" stroke="var(--color-warn)" strokeWidth="10" strokeLinecap="round" />
      </svg>
      <ShowNumbers
        caption=""
        columns={["Order", "Months", "Interest"]}
        rows={[
          ["Smallest balance first", String(snowMonths), formatMoney(snowInterest)],
          ["Highest interest first", String(avaMonths), formatMoney(avaInterest)],
        ]}
      />
    </figure>
  );
}
