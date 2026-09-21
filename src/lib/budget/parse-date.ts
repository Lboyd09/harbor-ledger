const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9,
  sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number): string | null {
  if (y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseDateToken(raw: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    if (a > 12 && b <= 12) return ymd(y, b, a);
    return ymd(y, a, b);
  }

  m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) return ymd(Number(m[3]), month, Number(m[2]));
  }

  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) return ymd(Number(m[3]), month, Number(m[1]));
  }

  return null;
}

export function monthKeyFromDate(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function monthShort(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ?? ym;
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** ISO week key, e.g. 2026-W38. Week 1 contains January 4. */
export function weekKeyFromDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 7);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

export function weekStartFromKey(key: string): string {
  const match = key.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return key;
  const y = Number(match[1]);
  const w = Number(match[2]);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (w - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

export function weekLabel(key: string): string {
  const start = weekStartFromKey(key);
  if (start === key) return key;
  const d = new Date(`${start}T00:00:00Z`);
  const end = new Date(d);
  end.setUTCDate(end.getUTCDate() + 6);
  const a = d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const b = end.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${a} – ${b}`;
}

export function currentWeekKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  return weekKeyFromDate(`${y}-${m}-${d}`);
}

export function shiftWeek(key: string, delta: number): string {
  const start = weekStartFromKey(key);
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return weekKeyFromDate(d.toISOString().slice(0, 10));
}

export function weekdayName(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleString("en-US", { weekday: "short", timeZone: "UTC" });
}

export function isWeekend(iso: string): boolean {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}
