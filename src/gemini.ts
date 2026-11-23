import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const FALLBACKS = [MODEL, "gemini-flash-lite-latest", "gemini-3-flash-preview"];
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

let _ai: GoogleGenAI | null = null;
const ai = () => (_ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const retryable = (m: string) => /429|503|500|rate|quota|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|overloaded|timeout/i.test(m);

async function geminiJson(prompt: string, schema: Record<string, unknown>, model: string): Promise<any> {
  const res: any = await Promise.race([
    ai().models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema as any },
    }),
    new Promise((_, rej) => setTimeout(() => rej(new Error("503 timeout after 45s")), 45000)),
  ]);
  return JSON.parse(res.text ?? "");
}

async function groqJson(prompt: string, schema: Record<string, unknown>): Promise<any> {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nReturn ONLY a JSON object matching this JSON schema (use only the allowed enum values):\n${JSON.stringify(schema)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`groq ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const j: any = await res.json();
  return JSON.parse(j.choices?.[0]?.message?.content ?? "");
}

export async function callJson(prompt: string, schema: Record<string, unknown>, rounds = 3): Promise<any> {
  let delay = 5000;
  for (let round = 0; round < rounds; round++) {
    // Groq first: it is answering reliably; Gemini is mostly 503 tonight.
    try {
      return await groqJson(prompt, schema);
    } catch (e: any) {
      console.log(`  groq failed: ${String(e?.message || e).slice(0, 90)}`);
    }
    for (const model of FALLBACKS) {
      try {
        const out = await geminiJson(prompt, schema, model);
        console.log(`  -> used Gemini (${model})`);
        return out;
      } catch (e: any) {
        const m = String(e?.message || e);
        if (!retryable(m) && !/JSON|Unexpected token/i.test(m)) throw e;
      }
    }
    await sleep(delay);
    delay = Math.min(delay * 2, 60000);
  }
  throw new Error("all LLM providers failed");
}

export async function callText(prompt: string): Promise<string> {
  const res: any = await ai().models.generateContent({ model: MODEL, contents: prompt });
  return res.text ?? "";
}

export { MODEL, GROQ_MODEL };
