// ─────────────────────────────────────────────────────────────
// Telegram Notifier – Step 5b
// ─────────────────────────────────────────────────────────────
// Sends formatted arbitrage opportunity alerts to Telegram
// with full cost breakdown and margin analysis.
// ─────────────────────────────────────────────────────────────

import TelegramBot from 'node-telegram-bot-api';
import config from '../config/index.js';
import logger from '../config/logger.js';

const bot = new TelegramBot(config.telegram.botToken, { polling: false });

/**
 * Send a full arbitrage alert to Telegram.
 *
 * @param {{
 *   ad: { title: string, price: number, url: string, location: string },
 *   weight: { total_weight_kg: number, console_model: string, confidence: string },
 *   cost: { adPriceEur: number, internalFeesEur: number, colissimoEur: number, colissimoBracket: string, totalCostEur: number, totalCostDzd: number },
 *   market: { recommended_selling_price_dzd: number, valid_listings: number },
 *   margin: { marginDzd: number, marginPercent: number }
 * }} data
 */
export async function sendArbitrageAlert(data) {
  const { ad, weight, cost, market, margin } = data;

  const emoji = margin.marginDzd >= 20_000 ? '🔥🔥🔥' : margin.marginDzd >= 15_000 ? '🔥🔥' : '🔥';

  const message = `
${emoji} <b>ARBITRAGE OPPORTUNITY</b> ${emoji}

<b>📦 Listing:</b> ${ad.title}
<b>📍 Location:</b> ${ad.location}
<b>🔗 Link:</b> ${ad.url}

━━━━━━ <b>WEIGHT ANALYSIS</b> ━━━━━━
Console: ${weight.console_model}
Estimated Weight: ${weight.total_weight_kg} kg
Confidence: ${weight.confidence}

━━━━━━ <b>COST BREAKDOWN (EUR)</b> ━━━━━━
Ad Price: ${cost.adPriceEur}€
FR Shipping/Protection: +${cost.internalFeesEur}€
Colissimo ${cost.colissimoBracket}: +${cost.colissimoEur}€
<b>Total EUR: ${cost.totalCostEur}€</b>

━━━━━━ <b>MARGIN ANALYSIS (DZD)</b> ━━━━━━
Total Cost: ${cost.totalCostDzd.toLocaleString()} DZD
Market Price: ${market.recommended_selling_price_dzd.toLocaleString()} DZD
<b>💰 MARGIN: ${margin.marginDzd.toLocaleString()} DZD (${margin.marginPercent}%)</b>
Market Data: ${market.valid_listings} valid listings analyzed

<i>⏰ ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Algiers' })}</i>
`.trim();

  try {
    await bot.sendMessage(config.telegram.chatId, message, { parse_mode: 'HTML' });
    logger.info(`[Telegram] Alert sent: ${ad.title} — margin ${margin.marginDzd} DZD`);
  } catch (err) {
    logger.error(`[Telegram] Failed to send alert: ${err.message}`);
  }
}

/**
 * Send a simple status/error message to Telegram.
 *
 * @param {string} text
 */
export async function sendStatusMessage(text) {
  try {
    await bot.sendMessage(config.telegram.chatId, text, { parse_mode: 'HTML' });
  } catch (err) {
    logger.error(`[Telegram] Status message failed: ${err.message}`);
  }
}
