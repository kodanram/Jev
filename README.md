# Jev + Gemini demos

Six interactive demos of [TypeSafe's Jev](https://www.langchain.com/blog/building-a-harness-with-jev), a system that returns typed, probabilistic decisions. Gemini writes generated text and supplies the structured-output baseline.

**Jev makes a decision. Gemini writes the words. Your TypeScript code owns the control flow.**

## Quickstart

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Node 22.6 or later is required. The app works without keys in clearly labelled simulated mode.

## API keys

| Key | Purpose |
| --- | --- |
| `TYPESAFE_API_KEY` | Enables live Jev decisions |
| `GEMINI_API_KEY` | Enables Gemini 3.5 Flash-Lite, Gemini 2.5 Flash, and Gemini 3.1 Pro Preview calls |

Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey). Keep secrets in `.env`; never commit them.

## Demos

- **How Jev works** — illustrative comparison of generated text and a typed decision.
- **LLM router** — Jev chooses a Gemini tier and escalates low-confidence choices.
- **Ticket triage** — one Jev call produces six support signals; TypeScript routes discard, escalation, or auto-reply.
- **Inbox at scale** — parallel email classification and an optional Gemini structured-output comparison.
- **Slop filter** — classifies incoming posts with configurable feed rules.
- **Title scorer** — Gemini proposes titles and Jev ranks them in parallel.
- **Cost at scale** — compares Jev with the configured Gemini model tiers.

## Architecture

```text
Browser UI → Node HTTP server → Jev and Gemini → JSON response → animated UI
```

- `src/config.ts` defines Gemini models, price estimates, health state, and the per-session budget.
- `src/llm.ts` uses the official `@google/genai` SDK. It calls `generateContent`, reads Gemini token usage, and requests JSON mode for Zod-validated structured output.
- `src/jev.ts` is the common typed-decision wrapper.
- `src/router.ts`, `src/triage.ts`, and `src/usecases.ts` contain demo-specific questions and plain TypeScript business rules.
- `src/server.ts` provides a small HTTP API and serves `public/`.
- `public/` is framework-free browser code that renders the controls, charts, and animated pipeline diagrams.

## Cost guard and fallback

`DEMO_BUDGET_USD` defaults to `$0.50` for each server process. When the limit is reached or Gemini is unavailable, paid Gemini calls use clearly labelled simulated output. Jev is measured but never blocked. The model-price estimates in `src/config.ts` should be reviewed before external reporting.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the server at `http://localhost:3000` |
| `npm run dev` | Start with file watching |
| `npm run typecheck` | Type-check the project |
