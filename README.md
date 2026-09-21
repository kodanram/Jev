# Jev + Gemini demos

An interactive, framework-free Node.js application demonstrating where a typed decision model and a generative model fit in the same AI workflow.

**Jev makes structured decisions. Gemini generates text or provides a structured-output baseline. Plain TypeScript owns the business rules.**

The UI contains seven demos: an overview, model router, support-ticket triage, inbox classification, feed/slop filtering, title ranking, and cost calculator.

## How the system works

```text
Browser UI
    │ fetch JSON
    ▼
Node HTTP server (`src/server.ts`)
    ├── Jev: typed choices, scores, and probabilities
    └── Gemini: generated text and JSON-mode LLM baselines
    │
    ▼
JSON result with latency, token usage, cost, and simulated/live state
    │
    ▼
Browser updates pipeline diagrams, race lanes, charts, and result cards
```

There is no database, authentication layer, build step, or external inbox connection. The backend serves the static browser files and exposes focused JSON endpoints for each pipeline stage.

## Gemini integration

The app uses the official [`@google/genai`](https://www.npmjs.com/package/@google/genai) SDK in `src/llm.ts`.

| Role | Model | Used for |
| --- | --- | --- |
| Lightweight | `gemini-3.5-flash-lite` | Ticket/email classification baseline, title generation, ordinary auto-replies |
| Standard | `gemini-2.5-flash` | Router's standard tier and escalated support replies |
| Frontier | `gemini-3.1-pro-preview` | Router's most capable tier and always-top-model comparison |

### Two Gemini call types

1. `complete()` calls `generateContent` when the app needs prose, for example answering a routed prompt or writing a support reply.
2. `parseWith()` calls `generateContent` with `responseMimeType: "application/json"` and a JSON Schema generated from Zod. The returned JSON is validated again by Zod before application code uses it. This powers the Gemini classifier baseline.

Each successful Gemini response reports input/output tokens and calculated cost. The model estimates live in `src/config.ts`; review them before quoting them externally because provider prices change.

## Jev integration

`src/jev.ts` is the shared Jev wrapper. Each demo defines typed questions using:

- `choice` — choose one label and return probabilities/confidence.
- `score` — place input on an application-defined scale.
- `noul` — return a probability for a yes/no statement.

The wrapper normalizes the answers into simple TypeScript values and attaches latency, input-token count, cost, and `simulated` state. If `TYPESAFE_API_KEY` is not configured, each demo falls back to a small local heuristic so that the UI remains explorable.

## Demo pipelines

### Model router

1. Jev assigns the prompt to `light`, `standard`, or `frontier`.
2. If the selected tier's confidence is below `0.60`, normal TypeScript escalates it by one tier.
3. Gemini generates the final answer using the selected model.
4. Optionally, Gemini Pro answers the same prompt as an always-top-model baseline.

The router measures cost and latency; it does not claim to measure answer quality.

### Ticket triage

One Jev call produces six signals: department, urgency, frustration, refund probability, churn probability, and spam probability. `decideAction()` applies deterministic rules:

- High-confidence spam is discarded.
- Churn, urgency, frustration, or a billing refund request escalates the ticket.
- Other tickets receive an automatic reply.

Gemini 3.5 Flash-Lite can classify the same ticket as an optional comparison. Gemini Flash writes escalated replies; Flash-Lite writes ordinary replies.

### Inbox at scale

The UI requests generated fixture emails from `GET /api/inbox/sample?n=<count>`. `makeEmails()` in `src/samples.ts` creates these deterministic demo messages locally; the app never reads Gmail or a user inbox.

Jev classifies each email in parallel for category, urgency, scam probability, and reply requirement. The optional Gemini comparison is deliberately limited to 50 emails so a demo run cannot create excessive API use.

### Feed filter and title scorer

- The feed filter uses Jev to label each local sample post as breaking, golden nugget, hot take, promotion, AI slop, or noise. Browser rules can hide slop immediately.
- For title scoring, Gemini generates candidate titles. Jev scores each candidate independently for click appeal, clarity, clickbait, and specificity, then the browser ranks them using the calculated composite score.

## Source map

| File | Responsibility |
| --- | --- |
| `src/server.ts` | Native Node HTTP server, input validation, API routing, static-file serving, health and budget endpoints |
| `src/config.ts` | Gemini model IDs, tier mapping, estimated prices, API-key checks, budget, and provider cooldown state |
| `src/llm.ts` | Gemini SDK adapter for text completion and schema-validated JSON output |
| `src/jev.ts` | Shared Jev client wrapper with metrics and simulated fallback |
| `src/router.ts` | Router questions, local fallback heuristic, confidence escalation |
| `src/triage.ts` | Ticket questions, Zod baseline schema, routing rules, reply generation |
| `src/usecases.ts` | Inbox, feed, and title-scoring questions and Gemini baseline/title generation |
| `src/samples.ts` | Router prompts, support tickets, feed posts, and generated email fixtures |
| `public/index.html` | Tabbed application shell |
| `public/app.js` | API calls, per-demo state, result rendering, and browser-side orchestration |
| `public/flow.js` | Pipeline diagrams, race lanes, donut chart, and formatting helpers |
| `public/style.css` | Responsive light/dark styling |

## API endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/status` | Gemini/Jev availability, model metadata, and current budget |
| `GET /api/samples` | Local router, ticket, and feed fixtures |
| `GET /api/inbox/sample?n=60` | Generate local inbox fixtures |
| `POST /api/route/decide` | Ask Jev for a router decision |
| `POST /api/route/answer` | Ask the selected Gemini tier for a text answer |
| `POST /api/triage/jev` | Triage a ticket with Jev and apply routing rules |
| `POST /api/triage/llm` | Run Gemini's structured ticket-classification baseline |
| `POST /api/triage/reply` | Generate a Gemini support reply |
| `POST /api/inbox/jev` and `/api/inbox/llm` | Classify one email with Jev or Gemini |
| `POST /api/feed/label` | Label one feed post with Jev |
| `POST /api/titles/generate` and `/api/titles/score` | Generate Gemini title candidates and score them with Jev |
| `POST /api/gemini/reset` | Clear a Gemini availability cooldown and probe the API again |
| `POST /api/budget` | Change the in-memory demo spend cap |

## Setup

### Requirements

- Node.js `22.6` or newer.
- A Gemini API key for live Gemini output.
- A TypeSafe API key for live Jev output.

### Install and run

```bash
npm install
Copy-Item .env.example .env # PowerShell
npm start
```

Open `http://localhost:3000`.

For automatic server restarts while editing source files:

```bash
npm run dev
```

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | For live Gemini calls | API key from [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `TYPESAFE_API_KEY` | For live Jev calls | API key for TypeSafe Jev |
| `PORT` | No | HTTP port; defaults to `3000` |
| `DEMO_BUDGET_USD` | No | Maximum real Gemini spend for one server process; defaults to `0.50` |

Keep real keys in `.env`, which is ignored by Git. Do not commit them.

## Availability, cost, and simulated mode

The application starts without API keys. Missing keys, an exhausted budget, or an account-level Gemini failure cause Gemini text calls to return a clearly marked simulated response. The header status pill explains the current state.

Account-level Gemini errors place Gemini in a ten-minute cooldown. Use the status pill to re-check immediately after correcting a key or billing problem. The budget is process-local and resets whenever the server restarts.

The UI does not present a failed Gemini classifier as a comparison result: its race lane is shown as unavailable instead. This avoids comparing Jev measurements with fabricated LLM measurements.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm start` | Run the application on `http://localhost:3000` |
| `npm run dev` | Run with Node's file watcher |
| `npm run typecheck` | Check the TypeScript project without emitting files |

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| `EADDRINUSE` on port `3000` | Stop the process using the port, or set `PORT=3001` before starting the app. |
| Gemini classifier shows unavailable | Check the status pill, API key, billing, and current model availability. Restart after changing `.env`. |
| Everything is simulated | Add `GEMINI_API_KEY` and/or `TYPESAFE_API_KEY`, then restart the server. |
| A model returns `404` | Update the model ID in `src/config.ts` to the current Gemini model available to the account. |
