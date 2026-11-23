// verdict and blocker are COMPUTED from the extracted fields with plain rules,
// not asked of the LLM. Deterministic rules are auditable and never hallucinate,
// and they guarantee verdict/blocker always agree with the other fields.

import type { Extracted, Verdict, Blocker } from "./types.js";

export function derive(e: Extracted): { verdict: Verdict; blocker: Blocker } {
  // No real API product (CLIs, third-party wrappers, no public API).
  if (e.api_type === "none" || e.api_type === "cli_only") {
    return {
      verdict: "not_applicable",
      blocker: e.api_type === "cli_only" ? "not_an_api_product" : "no_public_api",
    };
  }

  // There is an API, but can a developer actually get in?
  switch (e.access) {
    case "partner_gated":
      return { verdict: "blocked", blocker: "partner_gated" };
    case "contact_sales":
      return { verdict: "blocked", blocker: "enterprise_sales" };
    case "paid_required":
      // Paid but self-serve: buildable once you pay. Caveat, not a hard block.
      return { verdict: "buildable_with_caveat", blocker: "paid_plan" };
    case "admin_approval":
      return { verdict: "buildable_with_caveat", blocker: "admin_approval" };
    case "self_serve_free":
    case "self_serve_trial":
      return { verdict: "buildable_now", blocker: "none" };
    default:
      // access unknown: don't claim buildable_now without evidence.
      return { verdict: "buildable_with_caveat", blocker: "other" };
  }
}
