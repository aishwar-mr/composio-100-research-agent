// CLI entry point — the "runnable trigger".
//   npm run research -- --one salesforce     research a single app, print JSON
//   npm run research -- --all                research all 100 -> out/apps.v1.json
//   npm run research -- --all --limit 5      first 5 only (cheap smoke test)
//
// Runs sequentially with a pause between apps to respect Gemini free-tier limits,
// and checkpoints after each app so a rate-limit stop never loses finished work.

import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import type { AppInput, AppRow } from "./types.js";
import { researchApp } from "./research.js";

const apps: AppInput[] = JSON.parse(readFileSync("data/apps.json", "utf8"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (f: string) => process.argv.includes(f);

async function main() {
  mkdirSync("out", { recursive: true });

  if (hasFlag("--one")) {
    const key = (arg("--one") || "").toLowerCase();
    const app = apps.find(
      (a) => a.name.toLowerCase() === key || a.name.toLowerCase().includes(key)
    );
    if (!app) throw new Error(`No app matching "${key}"`);
    const row = await researchApp(app);
    console.log(JSON.stringify(row, null, 2));
    return;
  }

  // --all: research every app, checkpointing as we go.
  const limit = Number(arg("--limit") || apps.length);
  const outPath = "out/apps.v1.json";
  const done: AppRow[] = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : [];
  const doneIds = new Set(done.map((r) => r.id));

  const todo = apps.slice(0, limit).filter((a) => !doneIds.has(a.id));
  console.log(`Researching ${todo.length} apps (${done.length} already done)...`);

  for (const app of todo) {
    try {
      const row = await researchApp(app);
      done.push(row);
      writeFileSync(outPath, JSON.stringify(done, null, 2));
      console.log(`[${done.length}/${limit}] ${app.name}: ${row.verdict} / ${row.blocker} (conf ${row.confidence})`);
    } catch (err: any) {
      console.error(`FAILED ${app.name}: ${err?.message || err}`);
    }
    await sleep(3000); // spread requests across the minute
  }
  console.log(`Done. Wrote ${done.length} rows to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
