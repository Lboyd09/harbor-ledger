import { Link } from "@tanstack/react-router";
import { Banknote, CreditCard, Landmark, LineChart, PiggyBank, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ACCOUNT_KIND_OPTIONS,
  accountAcceptsFile,
  accountGrowth,
  accountKindLabel,
  groupAccounts,
  shownBalance,
  type InvestmentPick,
} from "@/lib/budget/accounts";
import { accountRows, staleLabel } from "@/lib/budget/dashboard";
import { readNumber } from "@/lib/budget/calc-input";
import { formatMoney } from "@/lib/budget/money";
import { moneyPicture } from "@/lib/budget/picture";
import { PLANNING_MARKET } from "@/lib/budget/reference";
import type { Account, AccountKind, DebtItem, GrowthBand } from "@/lib/budget/types";
import { useBudgetStore } from "@/store/budget-store";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/field";

const ICONS: Record<AccountKind, typeof Landmark> = {
  checking: Landmark,
  savings: PiggyBank,
  cash: Banknote,
  credit: CreditCard,
  investment: LineChart,
  retirement: Landmark,
  other: Wallet,
};

const PICKS: { id: InvestmentPick; label: string }[] = [
  { id: "brokerage", label: "Brokerage" },
  { id: "roth", label: "Roth IRA" },
  { id: "traditional", label: "Traditional IRA" },
  { id: "401k", label: "401(k)" },
  { id: "other", label: "Other" },
];

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function prettyDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Sheet = "choose" | "cash" | "investment" | null;
let listener: ((sheet: Sheet) => void) | null = null;

export function openQuickAdd(sheet: Sheet = "choose") {
  listener?.(sheet);
}

export function QuickAddHost() {
  const [sheet, setSheet] = useState<Sheet>(null);
  useEffect(() => {
    listener = setSheet;
    return () => {
      listener = null;
    };
  }, []);
  if (!sheet) return null;
  return <QuickAdd sheet={sheet} onClose={() => setSheet(null)} />;
}

export function AccountBoard() {
  const accounts = useBudgetStore((s) => s.accounts ?? []);
  const balances = useBudgetStore((s) => s.balances ?? []);
  const debts = useBudgetStore((s) => s.debts ?? []);
  const addBalance = useBudgetStore((s) => s.addBalance);
  const addAccount = useBudgetStore((s) => s.addAccount);
  const addDebt = useBudgetStore((s) => s.addDebt);
  const updateAccount = useBudgetStore((s) => s.updateAccount);
  const retireAge = useBudgetStore((s) => s.profile.retireAge);
  const birthYear = useBudgetStore((s) => s.profile.birthYear);
  const today = todayIso();
  const rows = useMemo(() => accountRows(accounts, balances, today).rows, [accounts, balances, today]);
  const groups = useMemo(() => groupAccounts(rows), [rows]);
  const picture = useMemo(
    () => moneyPicture({ accounts, balances, debts }),
    [accounts, balances, debts],
  );
  const net = picture.net;
  const [balanceId, setBalanceId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<AccountKind>("checking");
  const [newBalance, setNewBalance] = useState("");
  const [loanName, setLoanName] = useState("");
  const [loanBalance, setLoanBalance] = useState("");
  const [loanApr, setLoanApr] = useState("");
  const [loanMin, setLoanMin] = useState("");
  const yearsToRetire = birthYear && retireAge ? retireAge - (Number(today.slice(0, 4)) - birthYear) : null;

  return (
    <section id="accounts" className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold">Your accounts</h2>
          <p className="text-sm text-muted">Net {formatMoney(net, { signed: true })}. Loans of {formatMoney(picture.loans)} are subtracted. Cards are already part of the account balances.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openQuickAdd("cash")}>
            Add cash
          </Button>
          <Button size="sm" variant="outline" onClick={() => openQuickAdd("investment")}>
            Add an investment
          </Button>
          <Button size="sm" onClick={() => setAdding((open) => !open)}>
            Add account
          </Button>
        </div>
      </div>
      {adding ? (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const id = addAccount({ name: newName.trim() || "Account", kind: newKind });
            const value = readNumber(newBalance);
            if (id && value != null) {
              const stored = newKind === "credit" ? -Math.abs(value) : value;
              addBalance(id, stored, date);
            }
            setNewName("");
            setNewBalance("");
            setAdding(false);
          }}
        >
          <Field label="Name">
            <Input aria-label="Account name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </Field>
          <Field label="Type">
            <Select aria-label="Account type" value={newKind} onChange={(e) => setNewKind(e.target.value as AccountKind)}>
              {ACCOUNT_KIND_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Balance today">
            <Input inputMode="decimal" aria-label="Starting balance" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} />
          </Field>
          <Field label="Date">
            <Input type="date" aria-label="Balance date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm">Save account</Button>
          </div>
        </form>
      ) : null}
      <form
        className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const balance = readNumber(loanBalance);
          const apr = readNumber(loanApr);
          const minimum = loanMin.trim() ? readNumber(loanMin) : 0;
          if (!loanName.trim() || balance == null || balance <= 0 || apr == null || apr < 0 || minimum == null || minimum < 0) return;
          addDebt({ name: loanName.trim(), balance, apr, minimum });
          setLoanName("");
          setLoanBalance("");
          setLoanApr("");
          setLoanMin("");
        }}
      >
        <p className="sm:col-span-4 text-sm font-medium">Add a loan</p>
        <Input aria-label="Loan name" placeholder="Car loan" value={loanName} onChange={(e) => setLoanName(e.target.value)} />
        <Input inputMode="decimal" aria-label="Loan balance" placeholder="Balance" value={loanBalance} onChange={(e) => setLoanBalance(e.target.value)} />
        <Input inputMode="decimal" aria-label="Interest rate" placeholder="Rate %" value={loanApr} onChange={(e) => setLoanApr(e.target.value)} />
        <Input inputMode="decimal" aria-label="Minimum payment" placeholder="Minimum" value={loanMin} onChange={(e) => setLoanMin(e.target.value)} />
        <div className="sm:col-span-4">
          <Button type="submit" size="sm" variant="outline">Save loan</Button>
        </div>
      </form>
      {debts.length ? (
        <ul className="mt-2 space-y-1 text-sm">
          {debts.map((debt) => (
            <li key={debt.id}>
              {debt.name}: {formatMoney(debt.balance)} at {debt.apr}% · minimum {formatMoney(debt.minimum)}
            </li>
          ))}
        </ul>
      ) : null}
      {groups.length === 0 ? (
        <p className="mt-3 text-sm">
          {debts.length
            ? "No bank or investment accounts yet. Add cash or an investment, or import a bank file."
            : "No accounts yet. Add cash or an investment, or import a bank file."}
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="mt-4">
            <h3 className="text-sm font-medium">{group.label}</h3>
            <ul className={`mt-2 space-y-3 ${group.id === "bank" ? "" : ""}`}>
              {group.rows.map((row) => {
                const account = accounts.find((item) => item.id === row.id);
                if (!account) return null;
                const Icon = ICONS[row.kind];
                const grown = account.kind === "investment" || account.kind === "retirement" ? accountGrowth(account, balances, today, { yearsToRetire }) : null;
                const show = shownBalance(account, balances, today);
                const large = group.id === "bank";
                return (
                  <li key={row.id} className={`rounded-md border border-border px-3 py-3 ${large ? "md:p-4" : ""}`}>
                    <div className="flex items-start gap-3">
                      <Icon className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-medium">
                            {row.name} <span className="text-sm font-normal text-muted">· {accountKindLabel(row.kind)}</span>
                          </p>
                          <p className={`tabular ${large ? "font-display text-2xl" : ""} ${row.owed && row.amount < 0 ? "text-danger" : ""}`}>
                            {row.owed ? `Owe ${formatMoney(Math.abs(show))}` : formatMoney(show)}
                          </p>
                        </div>
                        <p className="text-sm text-muted">
                          {row.asOf ? `As of ${prettyDate(row.asOf)}` : "No balance yet"}
                          {row.source ? ` · ${row.source}` : ""}
                        </p>
                        {row.stale && row.ageDays != null ? <p className="text-sm text-warn">{staleLabel(row.ageDays)}</p> : null}
                        {grown?.ready && grown.estimateNow != null ? (
                          <p className="mt-1 text-sm">
                            Estimated now {formatMoney(grown.estimateNow)}
                            {grown.lastTyped != null && grown.lastTypedDate ? ` (last typed ${formatMoney(grown.lastTyped)} on ${prettyDate(grown.lastTypedDate)})` : ""}.
                          </p>
                        ) : null}
                        {grown && !grown.ready ? <p className="mt-1 text-sm text-muted">Add a return and a monthly amount to estimate growth.</p> : null}
                        {grown?.path ? <GrowthChart path={grown.path} /> : null}
                        {(account.kind === "investment" || account.kind === "retirement") && account ? (
                          <GrowthFields account={account} onChange={(growth) => updateAccount(account.id, { growth })} />
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {accountAcceptsFile(account.kind) ? (
                            <Link to="/import" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">
                              Add a file
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            className="min-h-11 text-sm font-medium text-primary"
                            onClick={() => {
                              setBalanceId(balanceId === row.id ? null : row.id);
                              setAmount("");
                              setDate(todayIso());
                            }}
                          >
                            Update balance
                          </button>
                        </div>
                        {balanceId === row.id ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <Field label={row.owed ? "What you owe" : "Balance"}>
                              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                            </Field>
                            <Field label="Date">
                              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                            </Field>
                            <Button
                              className="sm:col-span-2 sm:w-fit"
                              onClick={() => {
                                const next = Number(amount);
                                if (!Number.isFinite(next) || amount.trim() === "") return;
                                addBalance(row.id, next, date);
                                setBalanceId(null);
                              }}
                            >
                              Save balance
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {group.id === "owed" ? <DebtList debts={debts} /> : null}
          </div>
        ))
      )}
      {!groups.some((group) => group.id === "owed") && debts.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium">Cards and loans</h3>
          <DebtList debts={debts} />
        </div>
      ) : null}
      {rows.length ? (
        <p className="mt-3 font-medium">
          Net {formatMoney(net, { signed: true })}
          <span className="mt-1 block text-xs font-normal text-muted">Typed balances, unless an investment is set to use its estimate.</span>
        </p>
      ) : null}
    </section>
  );
}

function DebtList({ debts }: { debts: DebtItem[] }) {
  if (!debts.length) return null;
  return (
    <ul className="mt-2 space-y-2">
      {debts.map((debt) => (
        <li key={debt.id} className="flex justify-between text-sm">
          <span>{debt.name}</span>
          <span className="tabular text-danger">Owe {formatMoney(debt.balance)}</span>
        </li>
      ))}
    </ul>
  );
}

function GrowthChart({ path }: { path: { label: string; low: number; likely: number; high: number }[] }) {
  const max = Math.max(1, ...path.flatMap((point) => [point.low, point.likely, point.high]));
  return (
    <div className="mt-2" aria-label="Estimated growth. Low, likely, and high.">
      <svg viewBox="0 0 120 48" className="h-16 w-full" role="img">
        {(["low", "likely", "high"] as const).map((key) => {
          const color = key === "low" ? "var(--color-muted)" : key === "high" ? "var(--color-good)" : "var(--color-primary)";
          const points = path.map((point, index) => `${(index / Math.max(1, path.length - 1)) * 116 + 2},${46 - (point[key] / max) * 40}`).join(" ");
          return <polyline key={key} fill="none" stroke={color} strokeWidth={key === "likely" ? 2 : 1} points={points} />;
        })}
      </svg>
      <p className="text-xs text-muted">Estimate. Low, likely, and high. Not a typed balance.</p>
      <ul className="mt-1 space-y-1 text-xs">
        {path.map((point) => (
          <li key={point.label}>
            {point.label}: {formatMoney(point.low)} low, {formatMoney(point.likely)} likely, {formatMoney(point.high)} high
          </li>
        ))}
      </ul>
    </div>
  );
}

function GrowthFields({ account, onChange }: { account: Account; onChange: (growth: Account["growth"]) => void }) {
  const growth = account.growth ?? {};
  const [percent, setPercent] = useState(growth.returnPercent != null ? String(growth.returnPercent) : "");
  const [monthly, setMonthly] = useState(growth.monthlyAdd != null ? String(growth.monthlyAdd) : "");
  const [fee, setFee] = useState(growth.yearlyFeePercent != null ? String(growth.yearlyFeePercent) : "");
  const band = growth.band ?? "";

  function save(next: Partial<NonNullable<Account["growth"]>>) {
    onChange({ ...growth, ...next });
  }

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <label className="text-xs text-muted">
        Return
        <Select
          className="mt-1"
          aria-label={`Return for ${account.name}`}
          value={band}
          onChange={(e) => save({ band: (e.target.value || null) as GrowthBand | null })}
        >
          <option value="">Pick one</option>
          <option value="cautious">Cautious ({Math.round(PLANNING_MARKET.conservative * 100)}%)</option>
          <option value="typical">Typical ({Math.round(PLANNING_MARKET.expected * 100)}%)</option>
          <option value="bold">Bold ({Math.round(PLANNING_MARKET.optimistic * 100)}%)</option>
        </Select>
      </label>
      <label className="text-xs text-muted">
        Or a typed percent
        <Input
          className="mt-1"
          inputMode="decimal"
          aria-label={`Typed return for ${account.name}`}
          value={percent}
          placeholder="7"
          onChange={(e) => setPercent(e.target.value)}
          onBlur={() => save({ returnPercent: percent.trim() === "" ? null : Number(percent) })}
        />
      </label>
      <label className="text-xs text-muted">
        Added each month
        <Input
          className="mt-1"
          inputMode="decimal"
          aria-label={`Monthly add for ${account.name}`}
          value={monthly}
          placeholder="0"
          onChange={(e) => setMonthly(e.target.value)}
          onBlur={() => save({ monthlyAdd: monthly.trim() === "" ? null : Number(monthly) })}
        />
      </label>
      <label className="text-xs text-muted">
        Yearly fee, percent
        <Input
          className="mt-1"
          inputMode="decimal"
          aria-label={`Fee for ${account.name}`}
          value={fee}
          placeholder="0"
          onChange={(e) => setFee(e.target.value)}
          onBlur={() => save({ yearlyFeePercent: fee.trim() === "" ? null : Number(fee) })}
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={Boolean(growth.useEstimates)} onChange={(e) => save({ useEstimates: e.target.checked })} />
        Use estimates between updates
      </label>
    </div>
  );
}

function QuickAdd({ sheet, onClose }: { sheet: Exclude<Sheet, null>; onClose: () => void }) {
  const addCash = useBudgetStore((s) => s.addCash);
  const addInvestment = useBudgetStore((s) => s.addInvestment);
  const [mode, setMode] = useState<Exclude<Sheet, null>>(sheet);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [pick, setPick] = useState<InvestmentPick>("roth");

  function saveCash() {
    const next = Number(amount);
    if (!Number.isFinite(next)) return;
    addCash(next, todayIso());
    onClose();
  }

  function saveInvestment() {
    const next = Number(amount);
    if (!Number.isFinite(next)) return;
    addInvestment({ name, pick, amount: next, date: todayIso() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div role="dialog" aria-label="Add an account" className="absolute inset-x-0 bottom-0 rounded-t-xl border border-border bg-surface p-4 md:inset-auto md:left-1/2 md:top-24 md:w-[28rem] md:-translate-x-1/2 md:rounded-xl">
        {mode === "choose" ? (
          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold">Accounts</h2>
            <Button className="w-full" onClick={() => setMode("cash")}>
              Add cash
            </Button>
            <Button className="w-full" variant="outline" onClick={() => setMode("investment")}>
              Add an investment
            </Button>
          </div>
        ) : null}
        {mode === "cash" ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveCash();
            }}
          >
            <h2 className="font-display text-xl font-semibold">Add cash</h2>
            <Field label="Amount">
              <Input autoFocus inputMode="decimal" aria-label="Cash amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Button type="submit">Save cash</Button>
          </form>
        ) : null}
        {mode === "investment" ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveInvestment();
            }}
          >
            <h2 className="font-display text-xl font-semibold">Add an investment</h2>
            <Field label="Name">
              <Input aria-label="Investment name" value={name} placeholder="Roth IRA" onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Type">
              <Select aria-label="Investment type" value={pick} onChange={(e) => setPick(e.target.value as InvestmentPick)}>
                {PICKS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Balance">
              <Input inputMode="decimal" aria-label="Investment balance" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Button type="submit">Save investment</Button>
          </form>
        ) : null}
        <button type="button" className="mt-3 min-h-11 text-sm text-muted" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
