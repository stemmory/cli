#!/usr/bin/env node
// stemmory-cli/packages/cli/bin/stemmory.js
//
// Thin executable shim: reads the package version and hands argv to the
// pure, tested `runCli` in../src/cli.js. No logic lives here on purpose —
// this file can't be unit tested directly (it's a process entry point).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runCli } from "../src/cli.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));

const { stdout, stderr, exitCode } = runCli(process.argv.slice(2), pkg.version);
// process.exitCode (not process.exit) so buffered stdout/stderr flush
// before the process exits — process.exit can truncate piped output.
if (stdout) console.log(stdout);
if (stderr) console.error(stderr);
process.exitCode = exitCode;
