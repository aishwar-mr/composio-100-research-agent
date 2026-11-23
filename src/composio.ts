// Search + fetch layer. The Composio Search toolkit is retired server-side
// (every published version returns "retired"), so web search uses Gemini's
// built-in Google Search grounding, and pages are fetched directly.

import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
let _ai: GoogleGenAI | null = null;
const ai = () =>
  (_ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface WebResult { text: string; sources: string[]; raw: any }

export async function webSearch(query: string): Promise<WebResult> {
  const res = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query), {
    headers: { "user-agent": "Mozilla/5.0 (research-agent)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`search -> ${res.status}`);
  const html = await res.text();
  const sources: string[] = [];
  const lines: string[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && sources.length < 8) {
    let url = m[1];
    const u = url.match(/uddg=([^&]+)/);
    if (u) url = decodeURIComponent(u[1]);
    if (url.startsWith("//")) url = "https:" + url;
    const strip = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    sources.push(url);
    lines.push(`${strip(m[2])} (${url}): ${strip(m[3])}`);
  }
  return { text: lines.join("\n"), sources, raw: null };
}

export async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 (research-agent)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const USER_ID = "n/a";
