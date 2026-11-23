import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

async function main() {
  const key = process.env.GEMINI_API_KEY!;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${key}`);
  const j: any = await r.json();
  const names: string[] = (j.models || [])
    .filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m: any) => String(m.name).replace("models/", ""))
    .filter((n: string) => /flash|lite/i.test(n) && !/image|tts|live|audio|embed|robotics|computer/i.test(n));
  console.log("candidates:", names.join(", "));
  const ai: any = new GoogleGenAI({ apiKey: key });
  for (const model of names.slice(0, 12)) {
    const t = Date.now();
    try {
      await Promise.race([
        ai.models.generateContent({ model, contents: "Reply: ok" }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 20s")), 20000)),
      ]);
      console.log(`OK   ${model}  ${Date.now() - t}ms`);
    } catch (e: any) {
      console.log(`FAIL ${model}  ${String(e?.message || e).slice(0, 70)}`);
    }
  }
}
main();
