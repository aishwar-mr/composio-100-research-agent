// The research pipeline for ONE app:
//   1. Discover + fetch evidence via Composio search/fetch tools.
//   2. Extract the schema fields with Gemini (JSON-constrained).
//   3. Derive verdict + blocker with deterministic rules.
// This is the "agent": Composio is its tools, Gemini is its reasoning, and the
// human-review queue (low confidence / flags) is where a human is needed.

import type { AppInput, AppRow, Extracted } from "./types.js";
import {
  AUTH_METHODS,
  ACCESS,
  API_TYPE,
  API_BREADTH,
  EXISTING_MCP,
  SANDBOX,
  CONFIDENCE,
} from "./types.js";
import { webSearch, fetchUrl } from "./composio.js";
import { callJson } from "./gemini.js";
import { derive } from "./derive.js";

// JSON schema handed to Gemini so it can only return valid, in-vocabulary values.
const extractionSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    auth_methods: { type: "array", items: { type: "string", enum: [...AUTH_METHODS] } },
    access: { type: "string", enum: [...ACCESS] },
    api_type: { type: "string", enum: [...API_TYPE] },
    api_breadth: { type: "string", enum: [...API_BREADTH] },
    existing_mcp: { type: "string", enum: [...EXISTING_MCP] },
    existing_mcp_url: { type: "string" },
    sandbox_available: { type: "string", enum: [...SANDBOX] },
    notes: { type: "string" },
    confidence: { type: "string", enum: [...CONFIDENCE] },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          url: { type: "string" },
          snippet: { type: "string" },
        },
        required: ["field", "url", "snippet"],
      },
    },
  },
  required: [
    "summary", "auth_methods", "access", "api_type", "api_breadth",
    "existing_mcp", "sandbox_available", "notes", "confidence", "evidence",
  ],
};

function buildPrompt(app: AppInput, gathered: string): string {
  return `You are researching whether "${app.name}" (${app.hint}, category: ${app.category})
can become an AI agent toolkit on Composio. Decide each field ONLY from the gathered
evidence below. If the evidence does not support a field, use "unknown" (or [] / "none"),
never a guess. Every non-unknown field must have at least one evidence item with a real
URL from the gathered text and a short supporting snippet.

Field meanings:
- auth_methods: how a developer/agent authenticates to the API.
- access: can a developer get credentials themselves (self_serve_free / self_serve_trial),
  or is it paid_required, admin_approval, partner_gated, or contact_sales?
- api_type: rest / graphql / both / sdk_only / cli_only / none.
- api_breadth: small (<20 endpoints) / medium / large (200+).
- existing_mcp: is there an official or community MCP server? Give its URL if so.
- sandbox_available: can a developer test without real data or a paid account?
- existing_mcp: use "none" ONLY if the evidence explicitly says no MCP exists; if the evidence is silent, use "unknown".
- Prefer evidence URLs on the vendor's own domain (docs, developer, support pages) over third-party sites; if only third-party evidence exists, set confidence to medium or low.
- confidence: high only if the key fields are backed by official docs.

GATHERED EVIDENCE:
${gathered.slice(0, 9000)}`;
}

export async function researchApp(app: AppInput): Promise<AppRow> {
  // 1. Gather. One targeted search per key question, plus a direct fetch of the hint.
  const gathered: string[] = [];
  try {
    console.log('  fetching hint…');
    const hintText = await fetchUrl(app.hint);
    gathered.push(`--- ${app.hint} ---\n${hintText.slice(0, 4000)}`);
  } catch { /* hint may not be fetchable; searches below still cover it */ }

  const queries = [
    `${app.name} API authentication docs`,
    `${app.name} API pricing free tier developer access`,
    `${app.name} REST or GraphQL API reference`,
    `${app.name} MCP server`,
  ];
  for (const q of queries) {
    try {
      console.log('  search:', q);
      const r = await webSearch(q);
      gathered.push(`--- search: ${q} ---\n${r.text.slice(0, 3000)}`);
    } catch { /* skip a failed query; others still inform extraction */ }
  }

  console.log('  extracting with Gemini…');
  // 2. Extract with Gemini (JSON-constrained).
  const extracted = (await callJson(
    buildPrompt(app, gathered.join("\n\n")),
    extractionSchema
  )) as Extracted;

  // 3. Derive verdict + blocker deterministically.
  const { verdict, blocker } = derive(extracted);

  return {
    ...app,
    ...extracted,
    existing_mcp_url: extracted.existing_mcp_url ?? null,
    verdict,
    blocker,
    date_checked: new Date().toISOString().slice(0, 10),
    human_corrected: false,
    pass: "v1",
    flags: [],
  };
}
