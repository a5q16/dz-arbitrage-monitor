// ─────────────────────────────────────────────────────────────
// Leboncoin Poller via MCP – Step 1
// ─────────────────────────────────────────────────────────────
// Polls Leboncoin MCP for console listings with "Livraison
// possible" filter. Deduplicates by ad ID across poll cycles.
// ─────────────────────────────────────────────────────────────

import axios from 'axios';
import config from '../config/index.js';
import logger from '../config/logger.js';

/** @type {Set<string>} – track already-processed ad IDs */
const processedAds = new Set();

/**
 * Search Leboncoin via MCP for a given keyword.
 *
 * @param {string} keyword – e.g. "PS5", "Xbox Series X"
 * @returns {Promise<Array<{
 *   id: string,
 *   title: string,
 *   description: string,
 *   price: number,
 *   url: string,
 *   location: string,
 *   images: string[],
 *   shippable: boolean,
 *   sellerName: string
 * }>>}
 */
export async function searchLeboncoin(keyword) {
  logger.info(`[Leboncoin] Searching for: "${keyword}"`);

  try {
    const response = await axios.post(`${config.leboncoin.mcpEndpoint}/tools/search`, {
      keyword,
      filters: {
        shippable: true,                     // "Livraison possible"
        category: 'consoles_jeux_video',     // gaming consoles category
        sort_by: 'date',
        sort_order: 'desc',
      },
      limit: 20,
    });

    const ads = (response.data?.results || response.data || []).map((ad) => ({
      id: String(ad.id || ad.list_id),
      title: ad.title || ad.subject || '',
      description: ad.description || ad.body || '',
      price: Number(ad.price?.[0] || ad.price || 0),
      url: ad.url || `https://www.leboncoin.fr/ad/${ad.id || ad.list_id}`,
      location: ad.location?.city || ad.city || '',
      images: ad.images?.urls || ad.photos || [],
      shippable: true,
      sellerName: ad.owner?.name || ad.seller_name || '',
    }));

    return ads;
  } catch (err) {
    logger.error(`[Leboncoin] Search failed for "${keyword}": ${err.message}`);
    return [];
  }
}

/**
 * Poll all configured keywords, return only NEW (unprocessed) ads.
 *
 * @returns {Promise<Array>} – new ads across all keywords
 */
export async function pollNewListings() {
  const newAds = [];

  for (const keyword of config.leboncoin.keywords) {
    const ads = await searchLeboncoin(keyword);
    for (const ad of ads) {
      if (!processedAds.has(ad.id)) {
        processedAds.add(ad.id);
        newAds.push(ad);
      }
    }
  }

  logger.info(`[Leboncoin] Poll complete: ${newAds.length} new ads (${processedAds.size} total tracked)`);
  return newAds;
}

/**
 * Send a professional French message to a seller via Leboncoin MCP.
 *
 * @param {{ adId: string, sellerName: string, consoleModel: string }} params
 * @returns {Promise<boolean>} – true if message sent successfully
 */
export async function sendSellerMessage({ adId, sellerName, consoleModel }) {
  const message = `Bonjour ${sellerName || ''},

Je suis intéressé par votre annonce pour la ${consoleModel}. Avant de procéder, j'aurais quelques questions :

1. L'article est-il toujours disponible ?
2. Pourriez-vous me confirmer le poids exact du colis complet (console + accessoires + emballage) ?
3. Acceptez-vous l'envoi via Mondial Relay ?

Merci d'avance pour votre retour rapide.
Cordialement`;

  try {
    await axios.post(`${config.leboncoin.mcpEndpoint}/tools/send_message`, {
      ad_id: adId,
      message,
    });
    logger.info(`[Leboncoin] Message sent to seller for ad ${adId}`);
    return true;
  } catch (err) {
    logger.error(`[Leboncoin] Failed to message seller for ad ${adId}: ${err.message}`);
    return false;
  }
}
