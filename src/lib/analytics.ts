const NAMES = [
  "landing_view",
  "demo_open",
  "import_start",
  "import_done",
  "first_safe_to_spend",
  "signup",
  "second_month_import",
  "share_card",
  "invite_sent",
  "setup_done",
  "setup_quit_step_N",
] as const;

export type AnalyticsName = (typeof NAMES)[number];

const ALLOWED_KEYS = new Set(["step", "source", "ok", "kind", "platform"]);

export function track(name: AnalyticsName, props?: Record<string, unknown>): Record<string, boolean | string> | null {
  if (!(NAMES as readonly string[]).includes(name)) return null;
  const clean: Record<string, boolean | string> = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (typeof value === "boolean") clean[key] = value;
    else if (typeof value === "string" && value.length <= 40 && !/[0-9]{3,}/.test(value) && !value.includes("$")) clean[key] = value;
  }
  const endpoint = typeof import.meta !== "undefined" ? (import.meta as { env?: { VITE_ANALYTICS_ENDPOINT?: string } }).env?.VITE_ANALYTICS_ENDPOINT : "";
  if (endpoint) {
    void fetch(endpoint, { method: "POST", body: JSON.stringify({ name, props: clean }), keepalive: true }).catch(() => undefined);
  }
  return clean;
}
