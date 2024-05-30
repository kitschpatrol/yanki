#!/usr/bin/env node

// src/cli/cli.ts
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
var yargsInstance = yargs(hideBin(process.argv));
await yargsInstance.scriptName("yanki").command(
  "$0 <pattern>",
  "Process markdown files",
  (yargs2) => yargs2.positional("pattern", {
    describe: "Glob pattern for markdown files",
    type: "string"
  }).option("dry-run", {
    alias: "d",
    description: "Run without making any changes",
    type: "boolean"
  }),
  ({ dryRun, pattern }) => {
    console.log(`Processing files matching pattern: ${pattern}`);
    if (dryRun) {
      console.log("--dry-run mode enabled, no changes will be made.");
    }
  }
).demandCommand(1).alias("h", "help").version().alias("v", "version").help().wrap(process.stdout.isTTY ? Math.min(120, yargsInstance.terminalWidth()) : 0).parse();
