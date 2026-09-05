import 'dotenv/config';

/** @type {Readonly<import('./types').AppConfig>} */
const config = Object.freeze({
  // ── Groq ──────────────────────────────────────────────
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',   // fast + accurate
    temperature: 0.1,                     // near-deterministic for weight estimation
    maxTokens: 1024,
  },

  // ── Apify ─────────────────────────────────────────────
  apify: {
    token: process.env.APIFY_API_TOKEN,
    fbActorId: process.env.APIFY_FB_ACTOR_ID || 'apify/facebook-marketplace-scraper',
  },

  // ── ScrapingBee ───────────────────────────────────────
  scrapingBee: {
    apiKey: process.env.SCRAPINGBEE_API_KEY,
  },

  // ── Telegram ──────────────────────────────────────────
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },

  // ── Leboncoin MCP ─────────────────────────────────────
  leboncoin: {
    mcpEndpoint: process.env.LEBONCOIN_MCP_ENDPOINT || 'http://localhost:3001',
    keywords: ['Xbox Series S', 'Xbox Series X', 'Playstation 5', 'PS5'],
    filters: { shippable: true },       // "Livraison possible"
  },

  // ── Business Logic ────────────────────────────────────
  business: {
    eurToDzd: Number(process.env.EUR_TO_DZD_RATE) || 280,
    internalFrShippingFee: Number(process.env.INTERNAL_FR_SHIPPING_FEE) || 15,
    minMarginDzd: Number(process.env.MIN_MARGIN_DZD) || 10_000,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 900_000, // 15 min default (free tier)
  },

  // ── Fallback Market Prices (DZD) ──────────────────────
  // Used for quick pre-screening BEFORE burning Apify/ScrapingBee credits.
  // Only ads that pass this rough check will trigger paid scraping.
  fallbackPrices: {
    'PS5':              135_000,
    'PS5 Disc Edition': 135_000,
    'PS5 Digital':      115_000,
    'PS5 Slim':         120_000,
    'PS5 Slim Digital': 105_000,
    'Xbox Series X':    110_000,
    'Xbox Series S':     70_000,
  },

  // ── Rate-Limit / Free-Tier Backoff ────────────────────
  rateLimits: {
    backoffMs: 60_000,         // pause 1 min after a 429/402
    maxBackoffMs: 600_000,     // max pause 10 min
    maxRetriesPerCycle: 2,     // retry at most 2× per poll cycle
  },

  // ── Colissimo Algeria Tariff (EUR) ────────────────────
  colissimo: [
    { maxKg: 0.5,  price: 23.79 },
    { maxKg: 1,    price: 28.39 },
    { maxKg: 2,    price: 31.09 },
    { maxKg: 5,    price: 39.89 },
    { maxKg: 10,   price: 66.09 },
    { maxKg: 15,   price: 89.59 },
    { maxKg: 20,   price: 109.49 },
  ],
});

export default config;
