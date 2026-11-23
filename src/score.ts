// Accuracy scoring. Compares the agent's rows against a hand-checked ground
// truth and reports per-field and overall accuracy, split into the tuning set
// and the held-out set so the final number is honest (never scored on the apps
// used to fix the agent).
//
//   npm run score         -> out/accuracy.json + console summary
//
// Fill data/groundtruth.json by hand for ~30 apps (copy the template). Each
// entry needs the fields you checked and set:"tuning" | "holdout".

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { AppRow } from "./types.js";

const FIELDS = ["auth_methods", "access", "api_type", "api_breadth", "existing_mcp", "verdict", "blocker"] as const;

interface Truth { id: number; set: "tuning" | "holdout"; [k: string]: any }

function eq(field: string, agent: any, truth: any): boolean {
  if (truth == null) return true; // field not checked -> skip
  if (field === "auth_methods") {
    const a = new Set((agent || []).map((x: string) => x));
    const t = new Set((truth || []).map((x: string) => x));
    if (a.size !== t.size) return false;
    for (const x of t) if (!a.has(x)) return false;
    return true;
  }
  return String(agent) === String(truth);
}

function scoreSet(rows: AppRow[], truths: Truth[]) {
  const byField: Record<string, { hit: number; total: number }> = {};
  let hit = 0, total = 0;
  for (const t of truths) {
    const row = rows.find((r) => r.id === t.id);
    if (!row) continue;
    for (const f of FIELDS) {
      if (t[f] == null) continue;
      byField[f] ??= { hit: 0, total: 0 };
      byField[f].total++; total++;
      if (eq(f, (row as any)[f], t[f])) { byField[f].hit++; hit++; }
    }
  }
  const pct = (h: number, n: number) => (n ? Math.round((h / n) * 100) : null);
  return {
    overall: pct(hit, total),
    checked: truths.length,
    byField: Object.fromEntries(Object.entries(byField).map(([f, v]) => [f, pct(v.hit, v.total)])),
  };
}

function main() {
  if (!existsSync("data/groundtruth.json")) {
    console.error("Create data/groundtruth.json (copy data/groundtruth.template.json) first.");
    process.exit(1);
  }
  const rows: AppRow[] = JSON.parse(readFileSync("out/apps.verified.json", "utf8"));
  const truths: Truth[] = JSON.parse(readFileSync("data/groundtruth.json", "utf8"));

  const result = {
    tuning: scoreSet(rows, truths.filter((t) => t.set === "tuning")),
    holdout: scoreSet(rows, truths.filter((t) => t.set === "holdout")),
    note: "Holdout is the honest final figure: the agent was never tuned on these apps.",
  };
  writeFileSync("out/accuracy.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main();
