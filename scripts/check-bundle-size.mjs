#!/usr/bin/env node
/**
 * Bundle size budget guard.
 *
 * Runs after `vite build` and compares gzipped sizes of `dist/assets/*.js`
 * against `bundle-budget.json`. Exits 1 if any chunk or the total exceeds
 * its budget — fails CI to prevent silent bloat regressions.
 *
 * Usage:
 *   npm run build && node scripts/check-bundle-size.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST_ASSETS = join(ROOT, "dist", "assets");
const BUDGET_PATH = join(ROOT, "bundle-budget.json");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function fail(msg) {
  console.error(`${RED}✗ ${msg}${RESET}`);
  process.exit(1);
}

if (!existsSync(BUDGET_PATH)) {
  fail(`bundle-budget.json not found at ${BUDGET_PATH}`);
}
if (!existsSync(DIST_ASSETS)) {
  fail(`dist/assets not found — run \`npm run build\` first.`);
}

const budget = JSON.parse(readFileSync(BUDGET_PATH, "utf8"));
const files = readdirSync(DIST_ASSETS).filter((f) => f.endsWith(".js"));

if (files.length === 0) {
  fail("No .js files found in dist/assets — build output is empty.");
}

// Map each chunk name (without hash + .js) to its gzipped KB size.
// Vite output filenames look like: `vendor-react-Bf3Hk2.js` or `index-Q9xPw.js`.
const chunkSizes = new Map();
let totalGzipKb = 0;

for (const file of files) {
  const buf = readFileSync(join(DIST_ASSETS, file));
  const gzipKb = gzipSync(buf).length / 1024;
  totalGzipKb += gzipKb;

  // Extract chunk name: strip trailing `-<hash>.js`. Vite hashes are
  // 8-char base64-ish strings (letters, digits, `_`, `-`). Anchor to that
  // shape so multi-segment names like `vendor-react` stay intact.
  const name = file.replace(/-[A-Za-z0-9_-]{8}\.js$/, "").replace(/\.js$/, "");
  chunkSizes.set(name, (chunkSizes.get(name) ?? 0) + gzipKb);
}

console.log(`\n${DIM}Bundle size report (gzipped):${RESET}\n`);

const violations = [];
const sortedChunks = [...chunkSizes.entries()].sort((a, b) => b[1] - a[1]);

for (const [name, sizeKb] of sortedChunks) {
  const limit = budget.chunks?.[name];
  const sizeStr = `${sizeKb.toFixed(1)} KB`;
  if (limit == null) {
    console.log(`  ${DIM}${name.padEnd(28)} ${sizeStr.padStart(10)}  (no budget)${RESET}`);
    continue;
  }
  const pct = (sizeKb / limit) * 100;
  const overBudget = sizeKb > limit;
  const color = overBudget ? RED : pct > 85 ? YELLOW : GREEN;
  const marker = overBudget ? "✗" : pct > 85 ? "!" : "✓";
  console.log(
    `  ${color}${marker} ${name.padEnd(28)} ${sizeStr.padStart(10)}  / ${limit} KB  (${pct.toFixed(0)}%)${RESET}`,
  );
  if (overBudget) {
    violations.push(`Chunk "${name}" is ${sizeKb.toFixed(1)} KB (budget: ${limit} KB)`);
  }
}

const totalLimit = budget.total_gzip_kb;
const totalPct = (totalGzipKb / totalLimit) * 100;
const totalOver = totalGzipKb > totalLimit;
const totalColor = totalOver ? RED : totalPct > 85 ? YELLOW : GREEN;

console.log(
  `\n${totalColor}TOTAL: ${totalGzipKb.toFixed(1)} KB / ${totalLimit} KB (${totalPct.toFixed(0)}%)${RESET}\n`,
);

if (totalOver) {
  violations.push(`Total bundle is ${totalGzipKb.toFixed(1)} KB (budget: ${totalLimit} KB)`);
}

if (violations.length > 0) {
  console.error(`${RED}Bundle budget exceeded:${RESET}`);
  for (const v of violations) console.error(`  ${RED}• ${v}${RESET}`);
  console.error(
    `\n${DIM}To fix: reduce dependencies, code-split, or — if justified — bump limits in bundle-budget.json (dedicated PR).${RESET}\n`,
  );
  process.exit(1);
}

console.log(`${GREEN}✓ All chunks within budget.${RESET}\n`);
