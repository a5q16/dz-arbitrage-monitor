// ─────────────────────────────────────────────────────────────
// Groq Weight Estimation – Step 2 of the pipeline
// ─────────────────────────────────────────────────────────────
// Sends ad title + description to Groq (LLaMA 3.3 70B) and
// receives a structured JSON with estimated package weight,
// identified items breakdown, and a confidence score.
// ─────────────────────────────────────────────────────────────

import Groq from 'groq-sdk';
import config from '../config/index.js';
import logger from '../config/logger.js';

const groq = new Groq({ apiKey: config.groq.apiKey });

// ── System Prompt ────────────────────────────────────────────
const WEIGHT_ESTIMATION_SYSTEM_PROMPT = `You are a logistics specialist AI for gaming electronics.
Your ONLY task: analyze a Leboncoin ad and estimate the TOTAL SHIPPING WEIGHT of the package.

## Rules
1. Identify EVERY physical item mentioned (console, controllers, games, cables, headsets, charging docks, etc.).
2. For each item, output its individual weight in kg using YOUR internal knowledge of product specs.
3. Add +0.3 kg for packaging materials (bubble wrap, cardboard box, foam inserts).
4. Output the TOTAL estimated weight rounded to 2 decimal places.
5. If the ad is ambiguous about what's included, assume the STANDARD retail bundle (console + 1 controller + cables).
6. Never underestimate. When uncertain between two weight values, always pick the higher one — customs overage fees are expensive.

## Reference Weights (net, without packaging)
- Xbox Series S console: 1.93 kg
- Xbox Series X console: 4.45 kg
- PS5 (disc edition): 4.5 kg
- PS5 Digital Edition: 3.9 kg
- PS5 Slim (disc): 3.2 kg
- PS5 Slim Digital: 2.6 kg
- DualSense / Xbox controller: 0.28 kg
- Standard game disc case: 0.08 kg
- Headset (avg gaming): 0.35 kg
- Charging dock: 0.18 kg
- HDMI cable: 0.05 kg
- Power cable: 0.15 kg

## Output Format — STRICT JSON, no markdown fences, no commentary
{
  "items": [
    { "name": "string", "quantity": 1, "unit_weight_kg": 0.00 }
  ],
  "packaging_kg": 0.30,
  "total_weight_kg": 0.00,
  "console_model": "string (e.g. 'PS5 Slim Digital', 'Xbox Series X')",
  "confidence": "high | medium | low"
}`;

// ── User Prompt Builder ──────────────────────────────────────
/**
 * Build the user prompt from ad data.
 * @param {{ title: string, description: string, price: number }} ad
 * @returns {string}
 */
function buildUserPrompt(ad) {
  return `Analyze this Leboncoin ad and estimate the total package weight.

TITLE: ${ad.title}

DESCRIPTION:
${ad.description}

PRICE: ${ad.price}€

Respond ONLY with the JSON object.`;
}

// ── Main Estimation Function ─────────────────────────────────
/**
 * Estimate total package weight for a Leboncoin ad using Groq.
 *
 * @param {{ title: string, description: string, price: number }} ad
 * @returns {Promise<{
 *   items: Array<{ name: string, quantity: number, unit_weight_kg: number }>,
 *   packaging_kg: number,
 *   total_weight_kg: number,
 *   console_model: string,
 *   confidence: 'high' | 'medium' | 'low'
 * }>}
 */
export async function estimateWeight(ad) {
  logger.info(`[Groq] Estimating weight for: "${ad.title}"`);

  const chatCompletion = await groq.chat.completions.create({
    model: config.groq.model,
    temperature: config.groq.temperature,
    max_tokens: config.groq.maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: WEIGHT_ESTIMATION_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(ad) },
    ],
  });

  const raw = chatCompletion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('[Groq] Empty response from weight estimation');
  }

  /** @type {any} */
  let result;
  try {
    result = JSON.parse(raw);
  } catch (err) {
    logger.error(`[Groq] Failed to parse JSON response: ${raw}`);
    throw new Error(`[Groq] Invalid JSON in weight estimation response`);
  }

  // ── Validation ──────────────────────────────────────────
  if (typeof result.total_weight_kg !== 'number' || result.total_weight_kg <= 0) {
    throw new Error(`[Groq] Invalid total_weight_kg: ${result.total_weight_kg}`);
  }
  if (result.total_weight_kg > 20) {
    logger.warn(`[Groq] Weight ${result.total_weight_kg}kg exceeds Colissimo 20kg limit`);
  }

  logger.info(`[Groq] Estimated weight: ${result.total_weight_kg}kg (${result.confidence} confidence) — ${result.console_model}`);
  return result;
}

export { WEIGHT_ESTIMATION_SYSTEM_PROMPT, buildUserPrompt };
