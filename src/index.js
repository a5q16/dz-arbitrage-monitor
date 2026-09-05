// ─────────────────────────────────────────────────────────────
// Main Pipeline Orchestrator
// ─────────────────────────────────────────────────────────────
// Ties together all 5 steps:
//   1. Poll Leboncoin → 2. Groq Weight → 3. Colissimo Cost
//   → 4. Scrape DZ Markets → 5. Validate & Alert
// ─────────────────────────────────────────────────────────────

import 'dotenv/config';
import { CronJob } from 'cron';
import config from './config/index.js';
import logger from './config/logger.js';
import { pollNewListings, sendSellerMessage } from './sourcing/leboncoinPoller.js';
import { estimateWeight } from './analysis/weightEstimator.js';
import { computeLandedCost } from './analysis/costCalculator.js';
import { scrapeFacebookMarketplace } from './scrapers/facebookMarketplace.js';
import { scrapeOuedkniss } from './scrapers/ouedkniss.js';
import { analyzeMarketPrices } from './analysis/priceAnalyzer.js';
import { sendArbitrageAlert, sendStatusMessage } from './notifications/telegram.js';

/** Cache of market prices to avoid scraping DZ markets for every single ad */
const marketPriceCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (free-tier: DZ prices don't change that fast)

/**
 * Get (or fetch) market price for a console model.
 */
async function getMarketPrice(consoleModel) {
  const cached = marketPriceCache.get(consoleModel);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    logger.info(`[Cache] Using cached market price for ${consoleModel}`);
    return cached.data;
  }

  // Scrape both sources in parallel
  const [fbListings, okListings] = await Promise.allSettled([
    scrapeFacebookMarketplace(consoleModel),
    scrapeOuedkniss(consoleModel),
  ]);

  const allListings = [
    ...(fbListings.status === 'fulfilled' ? fbListings.value : []),
    ...(okListings.status === 'fulfilled' ? okListings.value : []),
  ];

  if (allListings.length === 0) {
    logger.warn(`[Market] No listings found for ${consoleModel} on DZ markets`);
    return null;
  }

  const analysis = await analyzeMarketPrices({ consoleModel, listings: allListings });
  marketPriceCache.set(consoleModel, { data: analysis, fetchedAt: Date.now() });

  return analysis;
}

/**
 * Get a rough fallback selling price for pre-screening.
 * Matches partial model names to fallback prices.
 */
function getFallbackPrice(consoleModel) {
  // Try exact match first, then partial
  if (config.fallbackPrices[consoleModel]) return config.fallbackPrices[consoleModel];
  const key = Object.keys(config.fallbackPrices).find((k) =>
    consoleModel.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(consoleModel.toLowerCase()),
  );
  return key ? config.fallbackPrices[key] : 100_000; // safe conservative fallback
}

/**
 * Process a single Leboncoin ad through the full pipeline.
 * FREE-TIER STRATEGY:
 *   Step 2 (Groq weight) is cheap → always run
 *   Step 3 (Colissimo calc) is free → always run
 *   Step 4 (DZ scraping) is EXPENSIVE → only if pre-screening passes
 */
async function processAd(ad) {
  try {
    // ── Step 2: Weight Estimation (Groq — cheap) ─────────
    const weight = await estimateWeight(ad);
    if (!weight) {
      logger.warn(`[Pipeline] Groq rate-limited, skipping ad ${ad.id}`);
      return;
    }

    // ── Step 3: Cost Calculation (free, local) ───────────
    const cost = computeLandedCost({
      adPriceEur: ad.price,
      weightKg: weight.total_weight_kg,
    });

    // ── PRE-SCREENING GATE (free-tier conservation) ──────
    // Use hardcoded fallback prices to check if this ad is even
    // worth scraping DZ markets for. Saves Apify/ScrapingBee credits.
    const fallbackPrice = getFallbackPrice(weight.console_model);
    const roughMargin = fallbackPrice - cost.totalCostDzd;

    if (roughMargin < config.business.minMarginDzd * 0.5) {
      // Not even close — skip expensive scraping entirely
      logger.info(
        `[Pipeline] ⏭️ PRE-SCREEN SKIP: "${ad.title}" — rough margin ${roughMargin.toLocaleString()} DZD (fallback ${fallbackPrice.toLocaleString()} - cost ${cost.totalCostDzd.toLocaleString()}) is below 50% of threshold`,
      );
      return;
    }

    logger.info(
      `[Pipeline] ✅ PRE-SCREEN PASS: rough margin ${roughMargin.toLocaleString()} DZD — proceeding to live market scrape`,
    );

    // ── Step 4: Market Price Lookup (EXPENSIVE) ──────────
    const market = await getMarketPrice(weight.console_model);
    if (!market || !market.recommended_selling_price_dzd) {
      // Fall back to hardcoded price if scraping failed/rate-limited
      logger.warn(`[Pipeline] No live market data for ${weight.console_model}, using fallback price`);
      const marginDzd = roughMargin;
      const marginPercent = Math.round((marginDzd / cost.totalCostDzd) * 100);

      if (marginDzd >= config.business.minMarginDzd) {
        logger.info(`[Pipeline] ✅ OPPORTUNITY (fallback) — margin ${marginDzd.toLocaleString()} DZD`);
        await sendSellerMessage({ adId: ad.id, sellerName: ad.sellerName, consoleModel: weight.console_model });
        await sendArbitrageAlert({
          ad, weight, cost,
          market: { recommended_selling_price_dzd: fallbackPrice, valid_listings: 0 },
          margin: { marginDzd, marginPercent },
        });
      }
      return;
    }

    // ── Step 5: Validation with live data ────────────────
    const marginDzd = market.recommended_selling_price_dzd - cost.totalCostDzd;
    const marginPercent = Math.round((marginDzd / cost.totalCostDzd) * 100);

    logger.info(
      `[Pipeline] Ad "${ad.title}": cost=${cost.totalCostDzd} DZD, sell=${market.recommended_selling_price_dzd} DZD, margin=${marginDzd} DZD (${marginPercent}%)`,
    );

    if (marginDzd >= config.business.minMarginDzd) {
      logger.info(`[Pipeline] ✅ OPPORTUNITY FOUND — margin ${marginDzd} DZD >= ${config.business.minMarginDzd} DZD threshold`);

      await sendSellerMessage({
        adId: ad.id,
        sellerName: ad.sellerName,
        consoleModel: weight.console_model,
      });

      await sendArbitrageAlert({
        ad, weight, cost, market,
        margin: { marginDzd, marginPercent },
      });
    } else {
      logger.info(`[Pipeline] ❌ Below threshold — margin ${marginDzd} DZD < ${config.business.minMarginDzd} DZD`);
    }
  } catch (err) {
    logger.error(`[Pipeline] Error processing ad ${ad.id}: ${err.message}`, { stack: err.stack });
  }
}

/**
 * Single poll cycle: fetch new ads → process each through pipeline.
 */
async function runCycle() {
  logger.info('═══════════════════════════════════════════════');
  logger.info('[Cycle] Starting new poll cycle...');

  const newAds = await pollNewListings();

  if (newAds.length === 0) {
    logger.info('[Cycle] No new ads found');
    return;
  }

  logger.info(`[Cycle] Processing ${newAds.length} new ads...`);

  // Process ads sequentially to respect API rate limits
  for (const ad of newAds) {
    await processAd(ad);
  }

  logger.info(`[Cycle] Cycle complete. Processed ${newAds.length} ads.`);
}

// ── Entry Point ──────────────────────────────────────────────
async function main() {
  logger.info('🚀 DZ Arbitrage Monitor starting...');
  logger.info(`   Poll interval: ${config.business.pollIntervalMs / 1000}s`);
  logger.info(`   Min margin: ${config.business.minMarginDzd.toLocaleString()} DZD`);
  logger.info(`   EUR/DZD rate: ${config.business.eurToDzd}`);
  logger.info(`   Keywords: ${config.leboncoin.keywords.join(', ')}`);

  await sendStatusMessage('🤖 <b>DZ Arbitrage Monitor started</b>\nPolling Leboncoin for opportunities...');

  // Run first cycle immediately
  await runCycle();

  // Schedule recurring cycles
  const intervalMinutes = Math.round(config.business.pollIntervalMs / 60_000);
  const cronExpr = `*/${intervalMinutes} * * * *`;

  const job = new CronJob(cronExpr, runCycle, null, true, 'Europe/Paris');
  logger.info(`[Scheduler] Cron job started: ${cronExpr}`);
  job.start();
}

main().catch((err) => {
  logger.error(`[Fatal] ${err.message}`, { stack: err.stack });
  process.exit(1);
});
