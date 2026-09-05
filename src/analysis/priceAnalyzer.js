// ─────────────────────────────────────────────────────────────
// Groq Price Analyzer – Step 4b
// ─────────────────────────────────────────────────────────────
// Takes raw scraped listings from Algerian marketplaces and
// uses Groq to filter spam, identify genuine console listings,
// and compute the realistic average selling price in DZD.
// ─────────────────────────────────────────────────────────────

import Groq from 'groq-sdk';
import config from '../config/index.js';
import logger from '../config/logger.js';

const groq = new Groq({ apiKey: config.groq.apiKey });

const PRICE_ANALYSIS_SYSTEM_PROMPT = `You are an Algerian marketplace pricing analyst.
You receive raw scraped listings from Facebook Marketplace Algeria and/or Ouedkniss.

## Your Tasks
1. FILTER OUT listings that are:
   - Accessories only (controllers, headsets, cases — NOT the console itself)
   - Spam / irrelevant listings
   - "Recherche" / "looking for" posts (demand, not supply)
   - Listings with unrealistic prices (< 30,000 DZD or > 200,000 DZD for a console)
   - Duplicate listings from the same seller

2. From the remaining VALID listings, determine the "Current Average Selling Price" in DZD.
   - Use the MEDIAN of valid prices (more robust than mean against outliers).
   - Separate by console model if mixed results are present.

3. Output STRICT JSON:
{
  "console_query": "string (what was searched for)",
  "total_scraped": 0,
  "valid_listings": 0,
  "filtered_out": 0,
  "filter_reasons": { "accessories_only": 0, "spam": 0, "recherche": 0, "unrealistic_price": 0, "duplicate": 0 },
  "price_analysis": [
    {
      "model": "string (e.g. 'PS5 Disc Edition', 'Xbox Series S')",
      "prices_dzd": [0],
      "median_price_dzd": 0,
      "min_price_dzd": 0,
      "max_price_dzd": 0,
      "sample_size": 0
    }
  ],
  "recommended_selling_price_dzd": 0,
  "market_notes": "string (brief observation about supply/demand)"
}`;

/**
 * Analyze raw scraped marketplace data to determine realistic selling price.
 *
 * @param {{ consoleModel: string, listings: Array<{ title: string, price?: string, description?: string, location?: string }> }} data
 * @returns {Promise<object>} parsed Groq analysis
 */
export async function analyzeMarketPrices(data) {
  logger.info(`[Groq] Analyzing ${data.listings.length} scraped listings for "${data.consoleModel}"`);

  const userPrompt = `Analyze these raw scraped listings from Algerian marketplaces for: "${data.consoleModel}"

RAW LISTINGS DATA:
${JSON.stringify(data.listings, null, 2)}

Filter spam/accessories and compute the realistic average selling price in DZD.
Respond ONLY with the JSON object.`;

  const completion = await groq.chat.completions.create({
    model: config.groq.model,
    temperature: 0.15,
    max_tokens: 2048,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PRICE_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('[Groq] Empty response from price analysis');

  const result = JSON.parse(raw);
  logger.info(
    `[Groq] Market price for ${data.consoleModel}: ${result.recommended_selling_price_dzd?.toLocaleString()} DZD (${result.valid_listings}/${result.total_scraped} valid)`,
  );

  return result;
}

export { PRICE_ANALYSIS_SYSTEM_PROMPT };
