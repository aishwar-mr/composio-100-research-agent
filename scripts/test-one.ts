// STEP 4 — the whole pipeline on ONE app end to end (gather -> extract -> derive).
//   npm run test:one            (defaults to Stripe)
//   npm run test:one -- github
import "dotenv/config";
import { readFileSync } from "node:fs";
import type { AppInput } from "../src/types.js";
import { researchApp } from "../src/research.js";

async function main() {
  const apps: AppInput[] = JSON.parse(readFileSync("data/apps.json", "utf8"));
  const key = (process.argv[2] || "stripe").toLowerCase();
  const app = apps.find((a) => a.name.toLowerCase().includes(key)) || apps[0];
  console.log("Researching:", app.name);
  const row = await researchApp(app);
  console.log(JSON.stringify(row, null, 2));
  console.log(`\n=> ${app.name}: ${row.verdict} / ${row.blocker} (confidence ${row.confidence}, ${row.evidence?.length||0} evidence items)`);
}
main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); });
