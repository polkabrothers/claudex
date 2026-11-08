#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cliEntry = path.join(here, "..", "src", "cli.tsx");
const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));

// tsx finds tsconfig from cwd, but cwd is the user's project rather than this
// repository. Without this flag, a directory without tsconfig makes esbuild
// fall back to classic JSX (`React.createElement`) and cli.tsx fails with
// `React is not defined`; a directory with an unrelated tsconfig would impose
// its own settings. Pin this repository's tsconfig instead.
const tsconfig = path.join(here, "..", "tsconfig.json");

const result = spawnSync(
  process.execPath,
  [tsxCli, "--tsconfig", tsconfig, cliEntry, ...process.argv.slice(2)],
  {
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
