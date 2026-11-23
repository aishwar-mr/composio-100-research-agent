// Turn the verified rows into the headline patterns the page leads with.
// Pure counting over the fixed vocabularies — this is why the enums matter.

import type { AppRow } from "./types.js";

export interface Patterns {
  total: number;
  authCounts: Record<string, number>;
  dominantAuth: string;
  accessCounts: Record<string, number>;
  verdictCounts: Record<string, number>;
  blockerCounts: Record<string, number>;
  topBlocker: string;
  selfServeShare: number; // % buildable_now
  easyWins: string[]; // names
  needsOutreach: string[]; // names
  hasMcp: string[]; // names with official/community MCP
  notApiProducts: string[]; // names
  authByCategory: Record<string, Record<string, number>>;
}

const tally = (xs: string[]) =>
  xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
const top = (m: Record<string, number>) =>
  Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none";

export function computePatterns(rows: AppRow[]): Patterns {
  const authCounts = tally(rows.flatMap((r) => r.auth_methods || []));
  const accessCounts = tally(rows.map((r) => r.access));
  const verdictCounts = tally(rows.map((r) => r.verdict));
  const blockerCounts = tally(rows.map((r) => r.blocker).filter((b) => b !== "none"));

  const authByCategory: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    authByCategory[r.category] ??= {};
    for (const a of r.auth_methods || [])
      authByCategory[r.category][a] = (authByCategory[r.category][a] || 0) + 1;
  }

  const easyWins = rows.filter((r) => r.verdict === "buildable_now").map((r) => r.name);
  const needsOutreach = rows.filter((r) => r.verdict === "blocked").map((r) => r.name);
  const hasMcp = rows
    .filter((r) => r.existing_mcp === "official" || r.existing_mcp === "community")
    .map((r) => r.name);
  const notApiProducts = rows.filter((r) => r.verdict === "not_applicable").map((r) => r.name);

  return {
    total: rows.length,
    authCounts,
    dominantAuth: top(authCounts),
    accessCounts,
    verdictCounts,
    blockerCounts,
    topBlocker: top(blockerCounts),
    selfServeShare: Math.round(((verdictCounts["buildable_now"] || 0) / rows.length) * 100),
    easyWins,
    needsOutreach,
    hasMcp,
    notApiProducts,
    authByCategory,
  };
}
