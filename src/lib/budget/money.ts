export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function roundPlan(n: number): number {
  if (n <= 0) return 0;
  if (n < 20) return Math.round(n);
  return Math.round(n / 5) * 5;
}

export function formatMoney(n: number, opts?: { signed?: boolean; dashZero?: boolean }): string {
  if (opts?.dashZero && Math.abs(n) < 0.005) return "—";
  const abs = Math.abs(n);
  const body = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(abs);
  if (n < 0) return `-${body}`;
  if (opts?.signed && n > 0) return `+${body}`;
  return body;
}

/** Short labels for big Plan numbers and chart ticks: $3.0M, $2.0M, $12K. */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const body = millions >= 10 ? String(Math.round(millions)) : millions.toFixed(1);
    return `${sign}$${body}M`;
  }
  if (abs >= 10_000) {
    const thousands = abs / 1000;
    const body = thousands >= 100 ? String(Math.round(thousands)) : thousands >= 10 ? String(Math.round(thousands)) : thousands.toFixed(1);
    return `${sign}$${body}K`;
  }
  return formatMoney(n);
}

/** Chart tick: "$0", "$500", "$12.5K", "$2M", "−$2K". */
export function axisMoney(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) < 0.5) return "$0";
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  const trim = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };
  if (abs >= 1_000_000) return `${sign}$${trim(abs / 1_000_000)}M`;
  if (abs >= 10_000) return `${sign}$${trim(abs / 1000)}K`;
  if (abs >= 1000) return `${sign}$${trim(abs / 1000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function parseAmountToken(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || s === "-" || s === "—" || s.toLowerCase() === "nan") return null;

  const wrapped = /^\(.*\)$/.test(s);
  s = s.replace(/[$\s]/g, "");
  s = s.replace(/^\(/, "").replace(/\)$/, "");

  const trailingMinus = /-$/.test(s);
  s = s.replace(/-$/, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) s = parts[0] + "." + parts[1];
    else s = s.replace(/,/g, "");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  let value = n;
  if (wrapped || trailingMinus) value = -Math.abs(value);
  return roundMoney(value);
}
