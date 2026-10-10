#!/usr/bin/env node
/**
 * Phone layout check. Not part of npm test.
 * Run against a dev server: node scripts/layout-check.mjs
 * LAYOUT_URL defaults to http://127.0.0.1:8080
 */
import { chromium } from "playwright";

const base = process.env.LAYOUT_URL ?? "http://127.0.0.1:8080";
const pages = ["/", "/budget", "/budget?page=transactions", "/import", "/funds", "/grow?q=retire", "/grow?q=debt", "/settings"];
const widths = [390, 465];
const fonts = (process.env.LAYOUT_FONTS ?? "150,135").split(",").map((n) => Number(n.trim())).filter((n) => n > 0);

const ledger = {
  state: {
    profile: {
      ledgerName: "Sample",
      household: "single",
      dependents: 0,
      lifeStage: "early-career",
      housing: "rent",
      hasVehicle: true,
      usesTransit: false,
      hasPets: false,
      monthlyIncome: 4000,
      incomeStreams: [{ id: "income_paycheck", name: "Paycheck", amount: 4000, cadence: "monthly", matchHints: [] }],
      buckets: ["housing"],
      goals: ["track"],
      completedOnboarding: true,
      budgetPeriod: "month",
      textSize: "normal",
    },
    categories: [
      { id: "housing", slug: "housing", name: "Utilities, phone, internet", kind: "expense", plannedMonthly: 180, carry: false },
    ],
    transactions: [
      {
        id: "t1",
        date: "2026-10-02",
        description: "UTILITIES",
        merchantKey: "UTILITIES",
        amount: -40,
        sourceLabel: "Bank",
        fingerprint: "t1",
        categoryId: "housing",
        userSet: false,
        notes: "",
        excluded: false,
        status: "posted",
      },
    ],
    merchantRules: [],
    imports: [],
    monthBudgets: [],
    savingsGoals: [],
    moneyBuckets: [],
    bucketMoves: [],
    netWorth: [],
    debts: [],
    accounts: [],
    balances: [],
    setAsides: [],
    activeMonth: "2026-10",
  },
  version: 0,
};

const failures = [];

function note(font, width, path, message) {
  failures.push(`${font}% ${width}px ${path}: ${message}`);
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
await page.addInitScript((saved) => {
  localStorage.setItem("harbor-ledger-v3", JSON.stringify(saved));
  localStorage.setItem("budgetflow-ui-banner-closed", "1");
}, ledger);

for (const font of fonts) {
  for (const width of widths) {
    if (font === 135 && width !== 390) continue;
    await page.setViewportSize({ width, height: 844 });
    for (const path of pages) {
      try {
        await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
      } catch {
        await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
      }
      await page.waitForTimeout(300);
      const report = await page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}%`;
        const problems = [];
        const root = document.documentElement;
        if (root.scrollWidth > window.innerWidth + 1) {
          problems.push(`page scrolls sideways (${root.scrollWidth} > ${window.innerWidth})`);
        }
        const money = [...document.querySelectorAll("[data-money]")];
        for (const el of money) {
          const first = el.getBoundingClientRect();
          if (first.width < 2 || first.height < 2) continue;
          el.scrollIntoView({ block: "center", inline: "nearest" });
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) {
            problems.push(`money stays under the chrome: ${el.textContent?.trim().slice(0, 40)}`);
            continue;
          }
          const hit = document.elementFromPoint(cx, cy);
          if (!hit || hit === el || el.contains(hit) || hit.closest("[data-money]") === el) continue;
          if (hit.closest("[data-app-chrome]")) {
            problems.push(`money covered: ${el.textContent?.trim().slice(0, 40)}`);
          }
        }
        for (const tile of document.querySelectorAll("[data-tile]")) {
          if (tile.scrollWidth > tile.clientWidth + 1) {
            problems.push(`tile clipped: ${tile.textContent?.trim().slice(0, 40)}`);
          }
        }
        const targets = document.querySelectorAll("button, a[role=button], [role=tab]");
        for (const el of targets) {
          const rect = el.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) continue;
          if (rect.width < 44 || rect.height < 44) {
            problems.push(`tap target ${Math.round(rect.width)}x${Math.round(rect.height)}: ${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}`);
          }
        }
        const nameEl = [...document.querySelectorAll("span")].find(
          (node) => node.childElementCount === 0 && node.textContent?.trim() === "Utilities, phone, internet",
        );
        const name = Boolean(nameEl) && nameEl.scrollHeight <= nameEl.clientHeight + 1;
        return { problems, name };
      }, font);
      for (const problem of report.problems) note(font, width, path, problem);
      if (path === "/budget" && width === 390 && !report.name) note(font, width, path, "category name is not fully visible");
    }
  }
}

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`layout-check ok (${fonts.join("/")}%)`);
