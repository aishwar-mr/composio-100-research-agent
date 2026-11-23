# Composio 100-App Research Agent

An agent that researches 100 apps for whether each could become a Composio
toolkit today, verifies its own answers, and emits a self-explanatory case-study
page. Tools come from the **Composio SDK** (web search + URL fetch); reasoning
comes from **Gemini** (Google AI Studio free tier).

## What it produces

- `out/apps.v1.json` — first-pass research for all 100 apps (frozen baseline).
- `out/apps.verified.json` — the same rows with verification `flags`.
- `out/accuracy.json` — accuracy vs a hand-checked ground truth (tuning + holdout).
- `out/index.html` + `out/apps.json` + `out/apps.csv` — the page to deploy, with downloads.

## Setup

```bash
npm install
cp .env.example .env     # then paste your COMPOSIO_API_KEY and GEMINI_API_KEY
```

Get keys: Composio dashboard → Settings → API keys; Gemini → Google AI Studio → API key.
In the Composio dashboard, choose **"build an agent with the SDK"** (not the MCP-client path).

## Build it step by step (each step is independently testable)

Run the steps in order. Each test confirms one layer before you depend on it.

| Step | Command | Confirms |
|---|---|---|
| 1. Keys | `npm run test:keys` | Both keys load; Composio client builds; Gemini answers. |
| 2. Composio tools | `npm run test:search` | `COMPOSIO_SEARCH_WEB` + `COMPOSIO_SEARCH_FETCH_URL_CONTENT` return data. |
| 3. Gemini JSON | `npm run test:gemini` | Gemini returns schema-constrained JSON. |
| 4. One app | `npm run test:one -- stripe` | The full pipeline (gather → extract → derive) on one app. |
| 5. Smoke run | `npm run research -- --all --limit 5` | 5 apps end to end, checkpointed to `out/apps.v1.json`. |
| 6. Full run | `npm run research -- --all` | All 100 (resumes if interrupted). |
| 7. Verify | `npm run verify -- --agent` | Structural + second-agent checks → `out/apps.verified.json`. |
| 8. Score | `npm run score` | Accuracy vs `data/groundtruth.json` → `out/accuracy.json`. |
| 9. Page | `npm run page` | `out/index.html` + data downloads. |

**If step 2 fails**, the Composio `tools.execute` signature or tool slugs differ in
your installed SDK version. Fix it in `src/composio.ts` only — everything else
calls through that wrapper.

## The runnable trigger

```bash
npm run research -- --one stripe      # research a single app, print its JSON row
```

## Hand-checking (where the human is needed)

1. `npm run verify -- --agent` flags rows (enum errors, missing evidence,
   contradictions, second-agent disagreements). Flagged rows show ⚑ on the page.
2. Copy `data/groundtruth.template.json` → `data/groundtruth.json` and fill ~30
   apps by hand from their real docs. Mark each `"set": "tuning"` or `"holdout"`.
3. Fix the agent using only tuning-set misses, re-run, then `npm run score`.
   The **holdout** number is the honest final accuracy.

## Deploy

Push to GitHub, then serve `out/` on GitHub Pages (or copy `out/index.html`,
`apps.json`, `apps.csv` to a `docs/` folder and enable Pages on it).
Set `REPO_URL` in `.env` so the page links back to the source.

## Design notes

- **Evidence or `unknown`.** No field is set without a supporting URL; this is the
  main defense against hallucination.
- **Fixed vocabularies.** Every categorical field is an enum, so patterns are counted, not guessed.
- **Deterministic verdict/blocker.** Computed in `src/derive.ts`, never by the LLM.
- **Free-tier aware.** Cached nothing destructive, retries with backoff, runs in
  sequence with pauses, and checkpoints after every app.
