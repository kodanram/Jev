import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { MODELS, accountError, budget, costUsd, geminiUsable, markGeminiDown, type ModelKey } from "./config.ts";

let client: GoogleGenAI | undefined;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

export interface Completion { model: ModelKey; text: string; inputTokens: number; outputTokens: number; latencyMs: number; costUsd: number; simulated: boolean }
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const jitter = (base: number) => Math.round(base * (0.85 + Math.random() * 0.3));
const SIM: Record<ModelKey, { latency: number; outTok: number }> = {
  geminiFlashLite: { latency: 700, outTok: 140 }, geminiFlash: { latency: 1500, outTok: 380 }, geminiPro: { latency: 3200, outTok: 520 },
};

export async function complete(model: ModelKey, prompt: string, opts: { system?: string; maxTokens?: number } = {}): Promise<Completion> {
  const info = MODELS[model], started = performance.now();
  const simulate = async (): Promise<Completion> => {
    const sim = SIM[model], inputTokens = Math.ceil(prompt.length / 4) + 20;
    await sleep(jitter(sim.latency));
    return { model, text: `[Simulated ${info.label} response: Gemini is unavailable, so this is a placeholder.]`, inputTokens, outputTokens: sim.outTok, latencyMs: Math.round(performance.now() - started), costUsd: costUsd(info, inputTokens, sim.outTok), simulated: true };
  };
  if (!geminiUsable()) return simulate();
  try {
    const response = await gemini().models.generateContent({ model: info.id, contents: prompt, config: { systemInstruction: opts.system, maxOutputTokens: opts.maxTokens ?? 500 } });
    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0, outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0, cost = costUsd(info, inputTokens, outputTokens);
    budget.charge(cost);
    return { model, text: response.text?.trim() || "[Gemini returned no text.]", inputTokens, outputTokens, latencyMs: Math.round(performance.now() - started), costUsd: cost, simulated: false };
  } catch (err) {
    const reason = accountError(err);
    if (!reason) throw err;
    markGeminiDown(reason);
    return simulate();
  }
}

export interface Parsed<T> { value: T; inputTokens: number; outputTokens: number; latencyMs: number; costUsd: number }
/** Gemini JSON mode supplies syntactically-valid JSON; Zod remains the application boundary. */
export async function parseWith<S extends z.ZodType>(model: ModelKey, schema: S, prompt: string, system: string): Promise<Parsed<z.infer<S>>> {
  const info = MODELS[model];
  if (!geminiUsable()) throw new Error("Gemini is unavailable");
  const started = performance.now();
  try {
    const response = await gemini().models.generateContent({
      model: info.id, contents: prompt,
      config: { systemInstruction: system, maxOutputTokens: 500, responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema) },
    });
    const value = schema.parse(JSON.parse(response.text || ""));
    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0, outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0, cost = costUsd(info, inputTokens, outputTokens);
    budget.charge(cost);
    return { value, inputTokens, outputTokens, latencyMs: Math.round(performance.now() - started), costUsd: cost };
  } catch (err) {
    const reason = accountError(err);
    if (reason) markGeminiDown(reason);
    throw err;
  }
}
