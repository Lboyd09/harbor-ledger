import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ogSkill = ".grok/skills/og/SKILL.md";
const ogRefs = ".grok/skills/og/references";

if (!existsSync(ogSkill) || !existsSync(ogRefs)) {
  console.log("skipped: missing .grok/skills/og");
  process.exit(0);
}

const result = spawnSync(process.execPath, ["--test", "scripts/**/*.test.mjs"], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
