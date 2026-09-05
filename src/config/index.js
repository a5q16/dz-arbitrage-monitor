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
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 300_000,
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
