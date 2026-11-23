// STEP 1 — confirm both keys are present and both services answer.
//   npm run test:keys
import "dotenv/config";
import { Composio } from "@composio/core";
import { GoogleGenAI } from "@google/genai";

async function main() {
  console.log("COMPOSIO_API_KEY:", process.env.COMPOSIO_API_KEY ? "set ✓" : "MISSING ✗");
  console.log("GEMINI_API_KEY:  ", process.env.GEMINI_API_KEY ? "set ✓" : "MISSING ✗");
  if (!process.env.COMPOSIO_API_KEY || !process.env.GEMINI_API_KEY) process.exit(1);

  // Composio: constructing the client validates the key format.
  new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  console.log("Composio client: ok ✓");

  // Gemini: one tiny generation proves the key works and the model is reachable.
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: "Reply with the single word: ready",
  });
  console.log("Gemini says:", ((res as any).text || "").trim());
}
main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); });
