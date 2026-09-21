export type ModelKey = "geminiFlashLite" | "geminiFlash" | "geminiPro";
export type Tier = "light" | "standard" | "frontier";

export interface ModelInfo {
  id: string;
  label: string;
  /** USD per 1M tokens. Keep these current before using them externally. */
  inPerM: number;
  outPerM: number;
}

export const MODELS: Record<ModelKey, ModelInfo> = {
  geminiFlashLite: { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", inPerM: 0.3, outPerM: 2.5 },
  geminiFlash: { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", inPerM: 0.3, outPerM: 2.5 },
  geminiPro: { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", inPerM: 2, outPerM: 12 },
};

export const GEMINI = {
  label: "Gemini",
  tiers: { light: "geminiFlashLite", standard: "geminiFlash", frontier: "geminiPro" } satisfies Record<Tier, ModelKey>,
  small: "geminiFlashLite" as ModelKey,
  mid: "geminiFlash" as ModelKey,
  big: "geminiPro" as ModelKey,
};

export const JEV_IN_PER_M = 0.042;
export const hasJevKey = () => Boolean(process.env.TYPESAFE_API_KEY?.trim());
export const hasGeminiKey = () => Boolean(process.env.GEMINI_API_KEY?.trim());
export const costUsd = (model: ModelInfo, inTok: number, outTok: number) => (inTok * model.inPerM + outTok * model.outPerM) / 1e6;
export const jevCostUsd = (inTok: number) => (inTok * JEV_IN_PER_M) / 1e6;

let spentUsd = 0;
let capUsd = Number(process.env.DEMO_BUDGET_USD ?? 0.5);
export const budget = {
  spent: () => spentUsd,
  cap: () => capUsd,
  charge: (usd: number) => { spentUsd += usd; },
  setCap: (usd: number) => { capUsd = usd; },
  exhausted: () => spentUsd >= capUsd,
};

const COOL_DOWN_MS = 10 * 60_000;
let down = { until: 0, reason: "" };
export type GeminiState = "live" | "simulated" | "unavailable" | "budget";
export function geminiState(): { state: GeminiState; note: string } {
  if (!hasGeminiKey()) return { state: "simulated", note: "No GEMINI_API_KEY set" };
  if (budget.exhausted()) return { state: "budget", note: `Demo budget of $${capUsd.toFixed(2)} reached` };
  if (Date.now() < down.until) return { state: "unavailable", note: down.reason };
  return { state: "live", note: "" };
}
export const geminiUsable = () => geminiState().state === "live";

export function accountError(err: unknown): string | null {
  const e = err as { status?: number; message?: string };
  const message = e?.message ?? "";
  if (e?.status === 401 || e?.status === 403) return message || "Gemini rejected the API key";
  if ((e?.status === 400 || e?.status ===429) && /usage limit|credit|billing|spend|quota|resource exhausted/i.test(message)) return message;
  return null;
}
export function markGeminiDown(reason: string) { down = { until: Date.now() + COOL_DOWN_MS, reason }; }
export function resetGemini() { down = { until: 0, reason: "" }; }
