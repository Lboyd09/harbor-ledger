import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { allowedLongCopy, copyProblems } from "./copy-rule.ts";

function files(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const skip = /tips\.ts|reference\.ts|help/;

test("visible sentences stay short and avoid banned words", () => {
  const root = path.resolve("src");
  const problems: string[] = [];
  for (const file of files(root)) {
    if (skip.test(file)) continue;
    if (!file.includes(`${path.sep}components${path.sep}`) && !file.includes(`${path.sep}routes${path.sep}`)) continue;
    for (const problem of copyProblems(readFileSync(file, "utf8"))) problems.push(`${file}: ${problem}`);
  }
  assert.deepEqual(problems, []);
});

test("user-facing strings over 160 characters fail, except errors and destructive confirmations", () => {
  const sentence = "Please read this note before you continue with the plan screen today.";
  const long = `<p>${sentence} ${sentence} ${sentence}</p>`;
  assert.ok(copyProblems(long).some((problem) => problem.startsWith("long:")));
  assert.deepEqual(copyProblems(`<p>${sentence}</p>`), []);
  const emptyFile = `<p>That file was empty. ${sentence} ${sentence}</p>`;
  assert.equal(allowedLongCopy(`That file was empty. ${sentence}`), true);
  assert.deepEqual(copyProblems(emptyFile), []);
  const wipe = `<p>Type RESET to erase this device and remove the budget from this phone. ${sentence}</p>`;
  assert.deepEqual(copyProblems(wipe), []);
});
