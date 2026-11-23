import "dotenv/config";
import { Composio } from "@composio/core";

async function main() {
  const c: any = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  for (const q of ["web search", "scrape url", "fetch web page", "crawl"]) {
    try {
      const tools = await c.tools.getRawComposioTools({ search: q, limit: 8 });
      console.log(`\n== ${q} ==`);
      for (const t of tools) console.log(t.slug, "|", t.toolkit?.slug);
    } catch (e: any) {
      console.log(q, "FAILED:", String(e?.message || e).slice(0, 120));
    }
  }
}
main();
