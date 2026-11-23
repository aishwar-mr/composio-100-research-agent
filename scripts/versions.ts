import "dotenv/config";
import { Composio } from "@composio/core";

async function main() {
  const c: any = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  const t = await c.toolkits.get("composio_search");
  console.log(JSON.stringify(t.meta ?? t, null, 1).slice(0, 2000));
}
main().catch((e) => console.error("FAILED:", e?.message || e));
