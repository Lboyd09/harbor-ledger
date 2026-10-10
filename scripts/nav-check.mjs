#!/usr/bin/env node
import { chromium } from "playwright";

const base = process.env.LAYOUT_URL ?? "http://127.0.0.1:8080";
const paths = ["/", "/budget", "/funds", "/grow/retire", "/grow/debt", "/settings", "/import", "/year"];
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
await page.goto(base, { waitUntil: "domcontentloaded" });
for (const path of paths) {
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  const url = page.url();
  if (!url.includes(path.split("?")[0])) {
    console.error(`nav-check failed: expected ${path}, got ${url}`);
    process.exit(1);
  }
}
console.log("nav-check ok");
await browser.close();
