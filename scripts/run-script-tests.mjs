import { spawnSync } from "node:child_process";

// Always run the script test suite. The og skill fixtures are optional for some tests.
const result = spawnSync(process.execPath, ["--test", "scripts/**/*.test.mjs"], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
