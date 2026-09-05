// ─────────────────────────────────────────────────────────────
// Ouedkniss Scraper via ScrapingBee – Step 4a (secondary)
// ─────────────────────────────────────────────────────────────
// Bypasses Ouedkniss Cloudflare protection using ScrapingBee's
// premium proxies + JS rendering, then parses listings with
// Cheerio.
// ─────────────────────────────────────────────────────────────

import ScrapingBeeClient from 'scrapingbee';
import * as cheerio from 'cheerio';
import config from '../config/index.js';
import logger from '../config/logger.js';

const client = new ScrapingBeeClient(config.scrapingBee.apiKey);

/**
 * Search Ouedkniss for a console model.
 *
 * @param {string} query – e.g. "PS5", "Xbox Series X"
 * @param {object} [options]
 * @param {number} [options.maxPages] – pages to scrape (default: 2)
 * @returns {Promise<Array<{ title: string, price: string | null, description: string | null, location: string | null, url: string }>>}
 */
export async function scrapeOuedkniss(query, options = {}) {
  const { maxPages = 2 } = options;
  const allListings = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://www.ouedkniss.com/recherche?q=${encodeURIComponent(query)}&page=${page}`;
    logger.info(`[ScrapingBee/Ouedkniss] Fetching page ${page}: ${url}`);

    try {
      const response = await client.get({
        url,
        params: {
          render_js: 'true',              // execute JS (Cloudflare challenge)
          premium_proxy: 'true',          // premium residential proxies
          country_code: 'dz',             // Algerian IP for local pricing
          wait: 5000,                     // wait 5s for dynamic content
          block_resources: 'false',       // allow all resources for CF bypass
        },
      });

      if (response.status !== 200) {
        logger.warn(`[ScrapingBee/Ouedkniss] Page ${page} returned status ${response.status}`);
        continue;
      }

      const $ = cheerio.load(response.data);
      const pageListings = parseOuedknissListings($);
      allListings.push(...pageListings);

      logger.info(`[ScrapingBee/Ouedkniss] Page ${page}: ${pageListings.length} listings found`);
    } catch (err) {
      logger.error(`[ScrapingBee/Ouedkniss] Page ${page} failed: ${err.message}`);
    }
  }

  logger.info(`[ScrapingBee/Ouedkniss] Total for "${query}": ${allListings.length} listings`);
  return allListings;
}

/**
 * Parse Ouedkniss search results HTML.
 * NOTE: Selectors may need updating if Ouedkniss changes their DOM.
 *
 * @param {cheerio.CheerioAPI} $ – loaded Cheerio instance
 * @returns {Array<{ title: string, price: string | null, description: string | null, location: string | null, url: string }>}
 */
function parseOuedknissListings($) {
  const listings = [];

  // Ouedkniss uses various card-like containers — try common patterns
  const selectors = [
    '.listing-card',
    '[class*="announcementCard"]',
    '.search-result-item',
    'a[href*="/annonce/"]',
  ];

  const cardSelector = selectors.find((sel) => $(sel).length > 0) || selectors[0];

  $(cardSelector).each((_i, el) => {
    const $card = $(el);
    const title = $card.find('[class*="title"], h2, h3, .card-title').first().text().trim();
    const priceRaw = $card.find('[class*="price"], .price').first().text().trim();
    const location = $card.find('[class*="location"], [class*="city"], .location').first().text().trim();
    const href = $card.attr('href') || $card.find('a').first().attr('href') || '';
    const url = href.startsWith('http') ? href : `https://www.ouedkniss.com${href}`;

    if (title) {
      listings.push({
        title,
        price: priceRaw || null,
        description: null,  // detailed description requires individual page scrape
        location: location || null,
        url,
      });
    }
  });

  return listings;
}

// ── Standalone Execution ─────────────────────────────────────
const isMain = process.argv[1]?.includes('ouedkniss');
if (isMain) {
  (async () => {
    for (const q of ['PS5', 'Xbox Series S', 'Xbox Series X']) {
      const results = await scrapeOuedkniss(q);
      console.log(`\n═══ ${q}: ${results.length} listings ═══`);
      results.slice(0, 3).forEach((l) => console.log(`  • ${l.title} — ${l.price}`));
    }
  })();
}
