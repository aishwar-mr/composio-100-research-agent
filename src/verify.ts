// Verification. Two automatic loops over ALL 100 rows, producing flags that
// route rows to human review:
//   A. Structural checks  — enums, evidence present, URL shape, contradictions.
//   B. Second-agent check — a fresh Gemini pass re-reads the cited pages and
//      says agree / disagree per row, independent of the extractor.
//
//   npm run verify                structural checks only (fast, free)
//   npm run verify -- --agent     also run the second-agent check (uses Gemini)
//
// Writes out/apps.verified.json with a `flags` array per row and prints a
// summary of how many rows each loop flagged.

import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import type { AppRow } from "./types.js";
import {
  AUTH_METHODS, ACCESS, API_TYPE, API_BREADTH, EXISTING_MCP, VERDICT, BLOCKER,
} from "./types.js";
import { fetchUrl } from "./composio.js";
import { callJson } from "./gemini.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const inEnum = (v: string, e: readonly string[]) => e.includes(v);

// ---- Loop A: structural checks (no LLM, no network except URL liveness opt-in).
function structuralFlags(r: AppRow): string[] {
  const f: string[] = [];
  if (!r.auth_methods?.length) f.push("no_auth_methods");
  if (r.auth_methods?.some((a) => !inEnum(a, AUTH_METHODS))) f.push("auth_out_of_enum");
  for (const [v, e, name] of [
    [r.access, ACCESS, "access"],
    [r.api_type, API_TYPE, "api_type"],
    [r.api_breadth, API_BREADTH, "api_breadth"],
    [r.existing_mcp, EXISTING_MCP, "existing_mcp"],
    [r.verdict, VERDICT, "verdict"],
    [r.blocker, BLOCKER, "blocker"],
  ] as const) {
    if (!inEnum(v as string, e)) f.push(`${name}_out_of_enum`);
  }
  // Evidence must exist for any confident, non-trivial claim.
  if (r.confidence !== "low" && (!r.evidence || r.evidence.length === 0))
    f.push("confident_but_no_evidence");
  if (r.evidence?.some((ev) => !/^https?:\/\//.test(ev.url || ""))) f.push("bad_evidence_url");
  // Contradictions.
  if (r.api_type === "none" && r.api_breadth === "large") f.push("contradiction_api_none_but_large");
  if (r.verdict === "buildable_now" && r.blocker !== "none") f.push("contradiction_buildable_with_blocker");
  if (r.existing_mcp !== "none" && r.existing_mcp !== "unknown" && !r.existing_mcp_url)
    f.push("mcp_claimed_without_url");
  return f;
}

// ---- Loop B: second-agent check. A fresh model re-reads one cited page and
// judges the three load-bearing fields. Disagreement -> flag for a human.
const agentSchema = {
  type: "object",
  properties: {
    agree: { type: "boolean" },
    disagreements: { type: "array", items: { type: "string" } },
  },
  required: ["agree", "disagreements"],
};

async function agentFlags(r: AppRow): Promise<string[]> {
  const cite = r.evidence?.find((e) => /^https?:\/\//.test(e.url || ""));
  if (!cite) return ["agent_no_page_to_check"];
  let page = "";
  try {
    page = (await fetchUrl(cite.url)).slice(0, 12000);
  } catch {
    return ["agent_page_unreachable"];
  }
  const prompt = `Independently check these claims about "${r.name}" against the page text below.
Claims: auth_methods=${JSON.stringify(r.auth_methods)}, access="${r.access}", api_type="${r.api_type}".
Answer agree=true only if the page supports them. List any that the page contradicts or does not support.

PAGE (${cite.url}):
${page}`;
  try {
    const res = await callJson(prompt, agentSchema);
    return res.agree ? [] : ["agent_disagrees", ...(res.disagreements || []).map((d: string) => `disagree:${d}`)];
  } catch {
    return ["agent_check_failed"];
  }
}

async function main() {
  const useAgent = process.argv.includes("--agent");
  const rows: AppRow[] = JSON.parse(readFileSync("out/apps.v1.json", "utf8"));

  let flaggedStruct = 0, flaggedAgent = 0;
  for (const r of rows) {
    const sf = structuralFlags(r);
    r.flags = [...sf];
    if (sf.length) flaggedStruct++;
    if (useAgent) {
      const af = await agentFlags(r);
      if (af.length) { r.flags.push(...af); flaggedAgent++; }
      await sleep(3000);
    }
  }
  writeFileSync("out/apps.verified.json", JSON.stringify(rows, null, 2));

  const needReview = rows.filter((r) => r.flags.length).length;
  console.log(`Structural: ${flaggedStruct}/${rows.length} flagged`);
  if (useAgent) console.log(`Second-agent: ${flaggedAgent}/${rows.length} flagged`);
  console.log(`Rows needing human review: ${needReview}`);
  console.log(`Wrote out/apps.verified.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
