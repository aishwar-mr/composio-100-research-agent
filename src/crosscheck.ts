import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import type { AppRow } from "./types.js";
import { AUTH_METHODS, ACCESS, API_TYPE, API_BREADTH, EXISTING_MCP, VERDICT, BLOCKER } from "./types.js";
import { derive } from "./derive.js";
import { fetchUrl, webSearch } from "./composio.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const root = (h: string) => h.split(".").slice(-2).join(".");

const TERMS: Record<string, string[]> = {
  oauth2: ["oauth"],
  api_key: ["api key", "api-key", "apikey", "api token", "x-api-key", "secret key", "access token"],
  bearer_token: ["bearer"],
  basic: ["basic auth"],
  jwt: ["jwt", "json web token"],
  rest: ["rest", "restful", "/v1", "/v2", "endpoint"],
  graphql: ["graphql"],
  both: ["graphql"],
  sdk_only: ["sdk"],
  cli_only: ["cli", "command line", "command-line", "npm install", "pip install"],
};

const isHard = (f: string) =>
  f.startsWith("L1 ") || /^L2 (dead_link|bad_url|no_live_evidence|no_vendor_domain_evidence)/.test(f);

interface Checked extends AppRow { trust: number; hardFlags: string[]; softFlags: string[]; status: string }

function layer1(r: AppRow): string[] {
  const f: string[] = [];
  const enums: [any, readonly string[], string][] = [
    [r.access, ACCESS, "access"], [r.api_type, API_TYPE, "api_type"],
    [r.api_breadth, API_BREADTH, "api_breadth"], [r.existing_mcp, EXISTING_MCP, "existing_mcp"],
    [r.verdict, VERDICT, "verdict"], [r.blocker, BLOCKER, "blocker"],
  ];
  for (const [v, e, n] of enums) if (!e.includes(v)) f.push(`L1 ${n}_out_of_enum:${v}`);
  for (const a of r.auth_methods || []) if (!AUTH_METHODS.includes(a)) f.push(`L1 auth_out_of_enum:${a}`);
  if (!r.auth_methods?.length) f.push("L1 no_auth_methods");
  if (r.confidence !== "low" && !(r.evidence?.length)) f.push("L1 confident_but_no_evidence");
  const d = derive(r);
  if (d.verdict !== r.verdict) f.push(`L1 verdict_mismatch:rule=${d.verdict},stored=${r.verdict}`);
  if (d.blocker !== r.blocker) f.push(`L1 blocker_mismatch:rule=${d.blocker},stored=${r.blocker}`);
  if (r.api_type === "none" && r.api_breadth === "large") f.push("L1 contradiction:api_none_but_large");
  if ((r.existing_mcp === "official" || r.existing_mcp === "community") && !r.existing_mcp_url)
    f.push("L1 mcp_claimed_without_url");
  return f;
}

async function layer2(r: AppRow): Promise<string[]> {
  const f: string[] = [];
  const vendor = root(host(r.hint));
  let anyLive = false, anyOnDomain = false;
  for (const ev of (r.evidence || []).slice(0, 4)) {
    if (!/^https?:\/\//.test(ev.url)) { f.push(`L2 bad_url:${ev.field}`); continue; }
    if (root(host(ev.url)) === vendor) anyOnDomain = true;
    let text = "";
    try { text = (await fetchUrl(ev.url)).toLowerCase(); anyLive = true; }
    catch { f.push(`L2 dead_link:${ev.field}`); continue; }
    if (ev.field === "auth_methods" || ev.field === "api_type") {
      if (text.length < 1200) { f.push(`L2 thin_page:${ev.field}`); continue; }
      const val = (r as any)[ev.field];
      for (const v of (Array.isArray(val) ? val : [val])) {
        const terms = TERMS[v]; if (!terms) continue;
        if (!terms.some((t) => text.includes(t))) f.push(`L2 page_missing_term:${ev.field}=${v}`);
      }
    }
  }
  if ((r.evidence?.length || 0) > 0 && !anyLive) f.push("L2 no_live_evidence");
  if (!anyOnDomain && r.verdict !== "not_applicable") f.push("L2 no_vendor_domain_evidence");
  return f;
}

async function layer3(r: AppRow): Promise<string[]> {
  const f: string[] = [];
  try {
    const s = (await webSearch(`${r.name} API authentication developer docs`)).text.toLowerCase();
    if (!s.trim()) { f.push("L3 search_empty"); return f; }
    for (const a of r.auth_methods || []) {
      const terms = TERMS[a]; if (!terms) continue;
      if (!terms.some((t) => s.includes(t))) f.push(`L3 auth_not_corroborated:${a}`);
    }
    if (r.api_type === "graphql" && !s.includes("graphql")) f.push("L3 graphql_not_corroborated");
  } catch { f.push("L3 search_unavailable"); }
  return f;
}

async function main() {
  const net = !process.argv.includes("--offline");
  const rows: AppRow[] = JSON.parse(readFileSync("out/apps.v1.json", "utf8"));
  const out: Checked[] = [];
  const reasonCounts: Record<string, number> = {};
  for (const r of rows) {
    const flags = [...layer1(r), ...(net ? await layer2(r) : []), ...(net ? await layer3(r) : [])];
    if (net) await sleep(1500);
    const hardFlags = flags.filter(isHard);
    const softFlags = flags.filter((f) => !isHard(f));
    const trust = (hardFlags.length === 0 ? 1 : 0) + (softFlags.filter((f) => f.startsWith("L2")).length === 0 ? 1 : 0) + (softFlags.filter((f) => f.startsWith("L3")).length === 0 ? 1 : 0);
    const status = hardFlags.length ? "error" : softFlags.length ? "unconfirmed" : "clean";
    for (const fl of flags) { const k = fl.split(":")[0]; reasonCounts[k] = (reasonCounts[k] || 0) + 1; }
    out.push({ ...r, flags, hardFlags, softFlags, trust, status });
    console.log(`${r.name}: ${status}${hardFlags.length ? "  HARD: " + hardFlags.join(" | ") : ""}`);
  }
  writeFileSync("out/apps.crosschecked.json", JSON.stringify(out, null, 2));
  const report = {
    total: out.length,
    clean: out.filter((r) => r.status === "clean").length,
    unconfirmed: out.filter((r) => r.status === "unconfirmed").length,
    error: out.filter((r) => r.status === "error").length,
    hardErrorRows: out.filter((r) => r.status === "error").map((r) => ({ name: r.name, hardFlags: r.hardFlags })),
    topReasons: Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]),
  };
  writeFileSync("out/crosscheck-report.json", JSON.stringify(report, null, 2));
  console.log(`\nclean (no issues): ${report.clean}/${report.total}`);
  console.log(`unconfirmed (soft only, mostly JS-rendered pages / short snippets): ${report.unconfirmed}`);
  console.log(`error (hard issue to fix): ${report.error}`);
  console.log("top reasons:", report.topReasons.slice(0, 8));
}

main().catch((e) => { console.error(e); process.exit(1); });
