// The schema every app row must fill. Fixed vocabularies make the results
// countable; free text cannot be clustered. Every claimed field carries at
// least one evidence item, or it is "unknown" — never a guess.

export const AUTH_METHODS = [
  "oauth2",
  "api_key",
  "basic",
  "bearer_token",
  "jwt",
  "none",
  "other",
  "unknown",
] as const;

export const ACCESS = [
  "self_serve_free",
  "self_serve_trial",
  "paid_required",
  "admin_approval",
  "partner_gated",
  "contact_sales",
  "unknown",
] as const;

export const API_TYPE = [
  "rest",
  "graphql",
  "both",
  "sdk_only",
  "cli_only",
  "none",
  "unknown",
] as const;

export const API_BREADTH = ["small", "medium", "large", "unknown"] as const;

export const EXISTING_MCP = ["official", "community", "none", "unknown"] as const;

export const VERDICT = [
  "buildable_now",
  "buildable_with_caveat",
  "blocked",
  "not_applicable",
] as const;

export const BLOCKER = [
  "none",
  "paid_plan",
  "partner_gated",
  "admin_approval",
  "app_review",
  "no_public_api",
  "enterprise_sales",
  "not_an_api_product",
  "other",
] as const;

export const SANDBOX = ["yes", "no", "unknown"] as const;
export const CONFIDENCE = ["high", "medium", "low"] as const;

export type AuthMethod = (typeof AUTH_METHODS)[number];
export type Access = (typeof ACCESS)[number];
export type ApiType = (typeof API_TYPE)[number];
export type ApiBreadth = (typeof API_BREADTH)[number];
export type ExistingMcp = (typeof EXISTING_MCP)[number];
export type Verdict = (typeof VERDICT)[number];
export type Blocker = (typeof BLOCKER)[number];
export type Sandbox = (typeof SANDBOX)[number];
export type Confidence = (typeof CONFIDENCE)[number];

export interface AppInput {
  id: number;
  name: string;
  category: string;
  hint: string;
}

export interface Evidence {
  field: string; // which field this URL supports
  url: string;
  snippet: string; // short quote/paraphrase from the page
}

// What the LLM is asked to extract (the researched fields only).
export interface Extracted {
  summary: string;
  auth_methods: AuthMethod[];
  access: Access;
  api_type: ApiType;
  api_breadth: ApiBreadth;
  existing_mcp: ExistingMcp;
  existing_mcp_url: string | null;
  sandbox_available: Sandbox;
  notes: string;
  confidence: Confidence;
  evidence: Evidence[];
}

// The full row: input + extracted + derived + provenance.
export interface AppRow extends AppInput, Extracted {
  verdict: Verdict;
  blocker: Blocker;
  date_checked: string; // ISO date
  human_corrected: boolean;
  pass: "v1" | "v2"; // which run produced this row
  flags: string[]; // automated-check or verifier warnings
}
