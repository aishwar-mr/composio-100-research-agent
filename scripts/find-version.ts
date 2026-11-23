import "dotenv/config";
import { Composio } from "@composio/core";

const versions = [
  "20261111_00", "20261101_00", "20260903_00", "20260902_00",
  "20260618_00", "20260615_00", "20260518_00", "20260424_00",
];

async function main() {
  const c: any = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  for (const version of versions) {
    try {
      const r = await c.tools.execute("COMPOSIO_SEARCH_WEB", {
        userId: "default",
        arguments: { query: "Stripe API authentication" },
        version,
      });
      console.log(`WORKS: ${version} (successful=${r?.successful})`);
      return;
    } catch (e: any) {
      console.log(`no: ${version} -> ${String(e?.message || e).slice(0, 90)}`);
    }
  }
  console.log("None worked.");
}
main();
