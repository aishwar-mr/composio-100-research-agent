// STEP 2 — confirm Composio's search and fetch tools return data.
// If this fails, the fix is almost always in src/composio.ts (the execute
// signature or tool slug for your SDK version) — not anywhere else.
//   npm run test:search
import "dotenv/config";
import { webSearch, fetchUrl } from "../src/composio.js";

async function main() {
  console.log("Searching…");
  const s = await webSearch("Stripe API authentication method");
  console.log("search text (first 300):", s.text.slice(0, 300));
  console.log("sources found:", s.sources.slice(0, 5));

  console.log("\nFetching a page…");
  const page = await fetchUrl("https://stripe.com/docs/api");
  console.log("fetched length:", page.length, "chars");
  console.log(page.slice(0, 200));
}
main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); });
