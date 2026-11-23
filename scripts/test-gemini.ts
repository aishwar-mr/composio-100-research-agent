// STEP 3 — confirm Gemini returns schema-constrained JSON (the core of extraction).
//   npm run test:gemini
import "dotenv/config";
import { callJson } from "../src/gemini.js";

async function main() {
  const schema = {
    type: "object",
    properties: {
      app: { type: "string" },
      auth_methods: { type: "array", items: { type: "string", enum: ["oauth2", "api_key", "none"] } },
    },
    required: ["app", "auth_methods"],
  };
  const out = await callJson(
    "GitHub's REST API uses OAuth and personal access tokens. Return the app name and auth_methods.",
    schema
  );
  console.log("parsed JSON:", out);
  if (!Array.isArray(out.auth_methods)) throw new Error("did not get structured array");
  console.log("structured output: ok ✓");
}
main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); });
