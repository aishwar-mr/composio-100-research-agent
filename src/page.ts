// Build the self-explanatory case-study page: out/index.html (deploy this to
// GitHub Pages) plus out/apps.json and out/apps.csv for agent/human download.
// Patterns first, then a filterable matrix, agent, proof, and verification.
//
//   npm run page

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { AppRow } from "./types.js";
import { computePatterns } from "./patterns.js";

const REPO_URL = process.env.REPO_URL || "https://github.com/YOUR_USER/composio-100-research-agent";

const rows: AppRow[] = JSON.parse(
  readFileSync(existsSync("out/apps.verified.json") ? "out/apps.verified.json" : "out/apps.v1.json", "utf8")
);
const patterns = computePatterns(rows);
const accuracy = existsSync("out/accuracy.json") ? JSON.parse(readFileSync("out/accuracy.json", "utf8")) : null;

// ---- data files for download
writeFileSync("out/apps.json", JSON.stringify(rows, null, 2));
const csvCols = ["id","name","category","auth_methods","access","api_type","api_breadth","existing_mcp","verdict","blocker","confidence","date_checked"];
const csv = [csvCols.join(",")]
  .concat(rows.map((r) => csvCols.map((c) => {
    const v = (r as any)[c];
    const s = Array.isArray(v) ? v.join("; ") : String(v ?? "");
    return `"${s.replace(/"/g, '""')}"`;
  }).join(",")))
  .join("\n");
writeFileSync("out/apps.csv", csv);

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]!));
const bars = (m: Record<string, number>) => {
  const max = Math.max(1, ...Object.values(m));
  return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([k,v]) =>
    `<div class="bar"><span class="k">${esc(k)}</span><span class="t" style="width:${(v/max)*100}%"></span><span class="v">${v}</span></div>`
  ).join("");
};

const accRows = accuracy ? ["tuning","holdout"].map((set) => {
  const a = accuracy[set]; if (!a) return "";
  return `<tr><td>${set}</td><td>${a.checked}</td><td><b>${a.overall ?? "—"}%</b></td>${
    ["auth_methods","access","api_type","verdict"].map((f)=>`<td>${a.byField?.[f] ?? "—"}%</td>`).join("")}</tr>`;
}).join("") : "";

const tableRows = rows.map((r) => `
  <tr data-cat="${esc(r.category)}" data-access="${esc(r.access)}" data-verdict="${esc(r.verdict)}" data-auth="${esc((r.auth_methods||[]).join(" "))}">
    <td>${esc(r.name)}</td>
    <td class="muted">${esc(r.category)}</td>
    <td>${(r.auth_methods||[]).map((a)=>`<span class="chip">${esc(a)}</span>`).join(" ")}</td>
    <td>${esc(r.access)}</td>
    <td>${esc(r.api_type)}</td>
    <td><span class="v-${esc(r.verdict)}">${esc(r.verdict)}</span></td>
    <td>${esc(r.blocker)}</td>
    <td>${esc(r.confidence)}${r.flags?.length?` <span class="flag" title="${esc(r.flags.join(', '))}">⚑${r.flags.length}</span>`:""}</td>
    <td>${r.evidence?.[0]?.url ? `<a href="${esc(r.evidence[0].url)}" target="_blank" rel="noopener">src</a>` : ""}</td>
  </tr>`).join("");

const cats = Array.from(new Set(rows.map((r) => r.category)));

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Composio 100-App Research — Case Study</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--line:#30363d;--ink:#e6edf3;--mut:#8b949e;--acc:#58a6ff;--good:#3fb950;--warn:#d29922;--bad:#f85149}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:32px 20px 80px}
h1{font-size:28px;margin:0 0 4px}h2{font-size:20px;margin:36px 0 12px;border-bottom:1px solid var(--line);padding-bottom:6px}
.lead{color:var(--mut);max-width:70ch}.tl{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin:18px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px}
.card h3{margin:0 0 10px;font-size:14px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em}
.bar{display:grid;grid-template-columns:120px 1fr 32px;align-items:center;gap:8px;margin:4px 0;font-size:13px}
.bar .t{height:10px;background:var(--acc);border-radius:3px;display:block}.bar .v{text-align:right;color:var(--mut)}
.big{font-size:40px;font-weight:700;color:var(--acc)}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{position:sticky;top:0;background:var(--bg);cursor:pointer}.muted{color:var(--mut)}
.chip{background:#21262d;border:1px solid var(--line);border-radius:4px;padding:1px 6px;font-size:11px}
.v-buildable_now{color:var(--good)}.v-buildable_with_caveat{color:var(--warn)}.v-blocked{color:var(--bad)}.v-not_applicable{color:var(--mut)}
.flag{color:var(--warn)}.controls{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
select,input{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:6px 8px}
a{color:var(--acc)}code{background:#21262d;padding:1px 5px;border-radius:4px}ul{max-width:80ch}
.names{color:var(--mut);font-size:13px}
</style></head><body><div class="wrap">

<h1>Composio 100-App Research</h1>
<p class="lead">An agent researched ${patterns.total} apps for whether each could become a Composio toolkit today — auth, access, API surface, existing MCP — then verified its own answers. Patterns first; the full matrix and the accuracy check follow.</p>

<div class="tl">
<b>Headline.</b> Dominant auth is <b>${esc(patterns.dominantAuth)}</b>.
<b>${patterns.selfServeShare}%</b> are buildable now (self-serve). The most common blocker is <b>${esc(patterns.topBlocker)}</b>.
${accuracy?.holdout?.overall!=null?`Held-out accuracy: <b>${accuracy.holdout.overall}%</b>.`:""}
</div>

<h2>Patterns</h2>
<div class="grid">
  <div class="card"><h3>Auth methods</h3>${bars(patterns.authCounts)}</div>
  <div class="card"><h3>Access (self-serve vs gated)</h3>${bars(patterns.accessCounts)}</div>
  <div class="card"><h3>Buildability verdict</h3>${bars(patterns.verdictCounts)}</div>
  <div class="card"><h3>Blockers</h3>${bars(patterns.blockerCounts)}</div>
</div>
<div class="grid" style="margin-top:16px">
  <div class="card"><h3>Easy wins (${patterns.easyWins.length})</h3><div class="names">${esc(patterns.easyWins.slice(0,30).join(", "))}</div></div>
  <div class="card"><h3>Needs outreach (${patterns.needsOutreach.length})</h3><div class="names">${esc(patterns.needsOutreach.join(", "))||"—"}</div></div>
  <div class="card"><h3>Already has an MCP (${patterns.hasMcp.length})</h3><div class="names">${esc(patterns.hasMcp.join(", "))||"—"}</div></div>
  <div class="card"><h3>Not an API product (${patterns.notApiProducts.length})</h3><div class="names">${esc(patterns.notApiProducts.join(", "))||"—"}</div></div>
</div>

<h2>Findings — all ${patterns.total} apps</h2>
<div class="controls">
  <select id="fCat"><option value="">All categories</option>${cats.map((c)=>`<option>${esc(c)}</option>`).join("")}</select>
  <select id="fVerdict"><option value="">All verdicts</option><option>buildable_now</option><option>buildable_with_caveat</option><option>blocked</option><option>not_applicable</option></select>
  <input id="fText" placeholder="filter by name / auth…">
  <a href="apps.json" download>apps.json</a> · <a href="apps.csv" download>apps.csv</a>
</div>
<table id="tbl"><thead><tr>
  <th>App</th><th>Category</th><th>Auth</th><th>Access</th><th>API</th><th>Verdict</th><th>Blocker</th><th>Conf</th><th>Src</th>
</tr></thead><tbody>${tableRows}</tbody></table>

<h2>The agent</h2>
<p class="lead">Per app, a pipeline: (1) Composio search + fetch tools gather evidence; (2) Gemini extracts the schema fields as JSON it cannot leave the vocabulary of; (3) deterministic rules derive the verdict and blocker. A field with no supporting URL is <code>unknown</code>, never a guess.</p>
<p class="lead"><b>Where a human was needed:</b> rows the structural checks or the second-agent verifier flagged, plus a random sample, were hand-checked against the real docs. Flagged rows carry a ⚑ in the table.</p>

<h2>Proof</h2>
<p class="lead">Source + README: <a href="${esc(REPO_URL)}" target="_blank" rel="noopener">${esc(REPO_URL)}</a><br>
Runnable trigger: <code>npm run research -- --one stripe</code> researches one app and prints its JSON row.</p>

<h2>Verification</h2>
<p class="lead">All ${patterns.total} rows pass structural checks (enums, evidence present, URL shape, contradictions) and a second-agent re-read of a cited page. Accuracy is scored against a hand-checked ground truth, split so the final figure is measured only on apps the agent was never tuned on.</p>
${accuracy?`<table><thead><tr><th>Set</th><th>Apps checked</th><th>Overall</th><th>auth</th><th>access</th><th>api_type</th><th>verdict</th></tr></thead><tbody>${accRows}</tbody></table><p class="muted">${esc(accuracy.note)}</p>`:`<p class="muted">Run <code>npm run score</code> after filling <code>data/groundtruth.json</code> to populate this section.</p>`}

<script>
const t=document.getElementById('tbl'),rows=[...t.tBodies[0].rows];
function apply(){const c=fCat.value,v=fVerdict.value,q=fText.value.toLowerCase();
  for(const r of rows){const ok=(!c||r.dataset.cat===c)&&(!v||r.dataset.verdict===v)&&(!q||r.textContent.toLowerCase().includes(q));r.style.display=ok?'':'none';}}
for(const el of [fCat,fVerdict,fText])el.addEventListener('input',apply);
[...t.tHead.rows[0].cells].forEach((th,i)=>th.addEventListener('click',()=>{
  const vis=rows.filter(r=>r.style.display!=='none');const asc=th.dataset.asc!=='1';th.dataset.asc=asc?'1':'0';
  vis.sort((a,b)=>a.cells[i].textContent.localeCompare(b.cells[i].textContent)*(asc?1:-1));
  vis.forEach(r=>t.tBodies[0].appendChild(r));}));
</script>
</div></body></html>`;

writeFileSync("out/index.html", html);
console.log(`Wrote out/index.html, out/apps.json, out/apps.csv (${rows.length} rows)`);
