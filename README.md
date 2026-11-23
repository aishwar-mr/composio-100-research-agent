# Composio 100-App Research Agent

I built an agent that researches 100 apps to decide whether each one could become a
Composio toolkit today, verifies its own answers with a deterministic (no-LLM) check,
and produces a single self-explanatory case-study page. This README explains what I
built, how to run it, and what I found — all of it consistent with the numbers on the
[live case-study page](https://aishwar-mr.github.io/composio-100-research-agent/).

## What I set out to do

For each app I capture a fixed schema: a one-line summary, the auth method(s), whether
a developer can self-serve credentials or is gated, the API type and rough breadth,
whether an MCP server already exists, a buildability verdict, the main blocker, and a
source URL for every field. Then I cluster the results into patterns, and I verify the
output so I can say how much of it to trust.

I cared most about two things the brief stresses: **insight over a raw table**, and
**honest, measurable accuracy**.

## The stack I chose

- **TypeScript + Node**, run with `tsx`.
- **LLM: free tiers with automatic fallback.** I use Groq (`openai/gpt-oss-120b`) and
  Google Gemini (AI Studio free tier) and fall back from one to the other on a
  rate-limit or 503. Neither needs a credit card. This fallback is the single reason
  the run completed — the free tiers throttle hard, and leaning on one alone stalls.
- **Search + fetch:** I planned to use Composio's own search toolkit, but every
  published version of `COMPOSIO_SEARCH` is retired server-side and refuses to execute.
  I report that as a finding rather than hiding it, and I moved search to a direct
  DuckDuckGo HTML fetch with plain page reading. Composio's role in the final pipeline
  is therefore smaller than I intended, which I state openly.

## How the agent works

Per app, the pipeline is:

1. **Discover + fetch** the app's docs (hint URL, then targeted searches for auth,
   pricing/access, API reference, and MCP).
2. **Extract** the schema with the LLM, constrained to valid JSON. Every field must
   carry a source URL and a supporting snippet, or it is `unknown` — never a guess.
3. **Derive** the verdict and blocker with plain deterministic rules (`src/derive.ts`),
   not with the model, so they can never contradict the data they summarise.
4. **Cross-check** with the 3-layer verifier (below).
5. **Human-check** every flagged row plus a random sample against the real docs.

The run checkpoints after every app, so a rate-limit stop never loses finished work and
a re-run resumes from the gap.

## The verification — deterministic, no LLM

I deliberately do **not** use a model to verify, so the results reproduce exactly and
every flag explains itself. Three independent layers:

1. **Structural** (offline): every value is in its allowed vocabulary; confident rows
   have evidence; the verdict/blocker is re-derived from the rules and must match; no
   internal contradictions.
2. **Grounding** (re-fetch each cited page): is the link live, is it on the vendor's own
   domain, and does the page actually contain the claimed term (checked for the
   high-precision fields, auth and API type).
3. **Corroboration** (independent search): a fresh search must also surface the claim.

I split flags into **hard errors** (something is wrong) and **soft signals** (couldn't
auto-confirm — usually a JavaScript-rendered doc that a raw fetch can't read, or a
one-line search snippet). Each app ends up **clean**, **unconfirmed**, or **error**.

I also run a deterministic **v2 fix pass** (`src/fix.ts`) that only ever weakens claims
(e.g. downgrades an MCP claim with no URL to `unknown`, drops malformed evidence links,
caps confidence where grounding is weak). This is what moved my hard-error count down
between the first and second pass.

## What I found (matches the case-study page exactly)

Researched **93 of 100** apps (7 unresolved — see Limitations).

- **Dominant auth:** OAuth2 (57 apps), then API key (53) and bearer token (35).
- **Buildable now:** **75%** (70 `buildable_now`), plus 18 `buildable_with_caveat`,
  3 `blocked`, 2 `not_applicable`.
- **Most common blocker:** `paid_plan` (8), then `admin_approval` (6).
- **Needs outreach (blocked):** Gladly, LinkedIn Ads, Otter AI.
- **Not an API product:** Sherlock and Mermaid CLI (both CLIs, correctly excluded).
- **Already has an MCP:** 34 apps, so there's nothing to build there.

**Verification result:** of 93 rows, **32 clean / 51 unconfirmed / 10 hard errors**.
The v2 fix loop cut hard errors from **18 → 10**. The top flag reasons are
`page_missing_term` (45) and `auth_not_corroborated` (35), which are dominated by
JavaScript-rendered docs and short snippets, not wrong answers — which is exactly why
those are soft signals and go to the human sample.

## Repository layout

```
data/apps.json              the 100 apps (id, name, category, hint URL)
data/groundtruth.template.json  copy to groundtruth.json for the hand-check
src/types.ts                the schema and all enums
src/composio.ts             search + fetch layer (DuckDuckGo + direct fetch)
src/gemini.ts               LLM layer: Groq + Gemini with fallback and backoff
src/research.ts             the per-app research pipeline
src/derive.ts               deterministic verdict/blocker rules
src/run.ts                  CLI: research one app or all 100 (checkpointed)
src/crosscheck.ts           the 3-layer no-LLM verifier
src/fix.ts                  the deterministic v2 fix pass
src/score.ts                accuracy scoring vs the hand-checked ground truth
src/patterns.ts             clusters the rows into the headline patterns
src/page.ts                 builds out/index.html + apps.json + apps.csv
scripts/                    small key/model/version test helpers
```

## How to run it

```bash
npm install
cp .env.example .env        # add COMPOSIO_API_KEY, GEMINI_API_KEY, GROQ_API_KEY
```

| Step | Command |
| --- | --- |
| Check keys | `npm run test:keys` |
| Research one app (the runnable trigger) | `npm run research -- --one stripe` |
| Research all 100 (resumes if interrupted) | `npm run research -- --all` |
| Cross-check all rows | `npm run crosscheck` |
| Apply the v2 fix pass | `npm run fix` then `npm run crosscheck` again |
| Score vs hand-checked truth | fill `data/groundtruth.json`, then `npm run score` |
| Build the page | `npm run page` → `out/index.html` |

## Where a human was needed

The agent did the research; I stepped in where it couldn't be trusted automatically:
every row the cross-check flagged, plus a random sample, I checked by hand against the
real docs. The verifier doesn't prove correctness — it narrows *where* to look — so the
reported accuracy rests on that human sample.

## Limitations (stated honestly)

- **93 of 100.** Seven apps failed when both free LLM providers were rate-limited at the
  same moment; they resolve on a re-run but I'm reporting the run as it stands.
- **Composio's search toolkit is retired**, so I use DuckDuckGo + direct fetch instead.
- **Term-matching is literal, not semantic**, so a claim phrased unusually surfaces as a
  soft flag for the human rather than silently passing — the safe direction to err.
- **Free-tier limits**, not the apps, were the main constraint on throughput.

## Consistency with the case-study page

Every figure above is read from the same generated files (`out/apps.crosschecked.json`
and `out/crosscheck-report.json`) that `src/page.ts` uses to build `out/index.html`, and
the page also embeds the full summary as JSON in a `<script id="agent-summary">` tag. So
the README and the HTML can't drift: 93 apps, 75% buildable now, OAuth2 dominant,
`paid_plan` top blocker, and 32 clean / 51 unconfirmed / 10 errors are identical in both.
