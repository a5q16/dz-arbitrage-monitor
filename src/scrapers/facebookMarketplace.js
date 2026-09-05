// ─────────────────────────────────────────────────────────────
// Facebook Marketplace Scraper via Apify – Step 4a
// ─────────────────────────────────────────────────────────────
// Uses the Apify Facebook Marketplace Actor to search for
// gaming consoles listed in Algeria. Returns normalized
// listing objects ready for Groq analysis.
// ─────────────────────────────────────────────────────────────

import { ApifyClient } from 'apify-client';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { withRateLimitGuard, isServicePaused } from '../config/rateLimiter.js';

const apify = new ApifyClient({ token: config.apify.token });

/**
 * Mapping of console models → Facebook Marketplace search queries.
 * Separate queries improve precision vs. a single broad search.
 */
const SEARCH_QUERIES = {
  'PS5':           ['PS5', 'Playstation 5', 'بلايستيشن 5'],
  'Xbox Series S': ['Xbox Series S', 'اكس بوكس سيريز اس'],
  'Xbox Series X': ['Xbox Series X', 'اكس بوكس سيريز اكس'],
};

/**
 * Run the Apify Facebook Marketplace actor for Algeria.
 *
 * @param {string} consoleModel – e.g. "PS5", "Xbox Series X"
 * @param {object} [options]
 * @param {string} [options.location]    – location filter (default: "Algeria")
 * @param {number} [options.maxListings] – max results to fetch (default: 15 for free tier)
 * @param {number} [options.maxPrice]    – max price filter in DZD
 * @returns {Promise<Array>}
 */
export async function scrapeFacebookMarketplace(consoleModel, options = {}) {
  if (isServicePaused('apify')) return [];

  const {
    location = 'Algeria',
    maxListings = 15,    // reduced from 30 for free tier
    maxPrice,
  } = options;

  const queries = SEARCH_QUERIES[consoleModel] || [consoleModel];
  logger.info(`[Apify/FB] Starting scrape for "${consoleModel}" in ${location} (queries: ${queries.join(', ')})`);

  const actorInput = {
    searchQueries: queries,
    location,
    maxItems: maxListings,
    maxPrice: maxPrice || undefined,
    category: 'electronics',
    sortBy: 'creation_date_descending',
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
    },
  };

  // ── Run Actor (wrapped with rate-limit guard) ──────────
  const run = await withRateLimitGuard('apify', () =>
    apify.actor(config.apify.fbActorId).call(actorInput, {
      waitSecs: 120,
    }),
  );

  if (!run) return [];   // rate-limited, skip gracefully

  logger.info(`[Apify/FB] Run ${run.id} finished with status: ${run.status}`);

  if (run.status !== 'SUCCEEDED') {
    logger.error(`[Apify/FB] Actor run failed: ${run.status}`);
    return [];
  }

  // ── Fetch Results from Dataset ─────────────────────────
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  logger.info(`[Apify/FB] Retrieved ${items.length} raw listings`);

  // ── Normalize Output ───────────────────────────────────
  const normalized = items.map((item) => ({
    title: item.title || item.name || '',
    price: item.price || item.priceText || null,
    description: item.description || item.body || null,
    location: item.location || item.locationText || item.city || null,
    url: item.url || item.link || null,
    imageUrl: item.imageUrl || item.image || item.thumbnail || null,
    postedAt: item.postedAt || item.createdAt || item.date || null,
    sellerName: item.sellerName || item.seller || null,
  }));

  return normalized;
}

/**
 * Scrape FB Marketplace for ALL console models and return combined results.
 *
 * @param {object} [options]
 * @returns {Promise<Record<string, Array>>} – keyed by console model
 */
export async function scrapeAllConsoles(options = {}) {
  const results = {};

  for (const model of Object.keys(SEARCH_QUERIES)) {
    try {
      results[model] = await scrapeFacebookMarketplace(model, options);
    } catch (err) {
      logger.error(`[Apify/FB] Failed to scrape "${model}": ${err.message}`);
      results[model] = [];
    }
  }

  return results;
}

// ── Standalone Execution ─────────────────────────────────────
// Run with: npm run scrape:fb
const isMain = process.argv[1]?.includes('facebookMarketplace');
if (isMain) {
  (async () => {
    const results = await scrapeAllConsoles();
    for (const [model, listings] of Object.entries(results)) {
      console.log(`\n═══ ${model}: ${listings.length} listings ═══`);
      listings.slice(0, 3).forEach((l) => console.log(`  • ${l.title} — ${l.price}`));
    }
  })();
}
