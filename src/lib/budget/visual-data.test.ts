import assert from "node:assert/strict";
import { test } from "node:test";
import { monthSeries, topSlices } from "./visual-data.ts";

test("topSlices keeps the total exact and folds the rest", () => {
  const parts = [
    { label: "A", value: 10 },
    { label: "B", value: 20 },
    { label: "C", value: 5.1 },
    { label: "D", value: 4.9 },
  ];
  const slices = topSlices(parts, 2);
  assert.deepEqual(slices.map((slice) => slice.label).sort(), ["A", "B", "Everything else"].sort());
  assert.equal(slices.at(-1)?.label, "Everything else");
  const before = parts.reduce((sum, part) => sum + part.value, 0);
  const after = slices.reduce((sum, part) => sum + part.value, 0);
  assert.equal(after, Math.round(before * 100) / 100);
  assert.equal(slices[2]?.value, 10);
  assert.deepEqual(topSlices(parts, 4).map((slice) => slice.label), ["A", "B", "C", "D"]);
});

test("monthSeries fills empty months and crosses a year boundary", () => {
  const empty = monthSeries("2026-03", []);
  assert.equal(empty.length, 12);
  assert.equal(empty[0]?.ym, "2025-04");
  assert.equal(empty.at(-1)?.ym, "2026-03");
  assert.ok(empty.every((point) => point.a === 0 && point.b === 0));

  const series = monthSeries("2026-02", [
    { ym: "2026-01", a: 5, b: 2 },
    { ym: "2025-03", a: 99, b: 99 },
  ]);
  assert.equal(series[0]?.ym, "2025-03");
  assert.equal(series[0]?.a, 99);
  assert.equal(series.find((point) => point.ym === "2026-01")?.b, 2);
  assert.equal(series.find((point) => point.ym === "2025-04")?.a, 0);
  assert.equal(series.at(-1)?.ym, "2026-02");
  assert.equal(series.at(-1)?.a, 0);
});
