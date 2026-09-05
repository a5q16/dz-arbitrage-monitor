// ─────────────────────────────────────────────────────────────
// Colissimo Algeria Shipping Calculator – Step 3
// ─────────────────────────────────────────────────────────────

import config from '../config/index.js';
import logger from '../config/logger.js';

/**
 * Look up the Colissimo Algeria shipping cost for a given weight.
 *
 * @param {number} weightKg – total package weight in kilograms
 * @returns {{ shippingEur: number, bracket: string }}
 * @throws if weight exceeds 20 kg (Colissimo max)
 */
export function getColissimoRate(weightKg) {
  const bracket = config.colissimo.find((b) => weightKg <= b.maxKg);

  if (!bracket) {
    throw new Error(
      `[Colissimo] Weight ${weightKg}kg exceeds maximum bracket (20kg). Cannot ship via Colissimo.`,
    );
  }

  logger.info(`[Colissimo] ${weightKg}kg → bracket ≤${bracket.maxKg}kg = ${bracket.price}€`);
  return { shippingEur: bracket.price, bracket: `≤${bracket.maxKg}kg` };
}

/**
 * Compute the full landed cost in DZD.
 *
 * Total Cost (DZD) = (Ad Price + Internal FR Fees + Colissimo) × EUR_TO_DZD
 *
 * @param {{ adPriceEur: number, weightKg: number }} params
 * @returns {{
 *   adPriceEur: number,
 *   internalFeesEur: number,
 *   colissimoEur: number,
 *   colissimoBracket: string,
 *   totalCostEur: number,
 *   totalCostDzd: number,
 *   exchangeRate: number
 * }}
 */
export function computeLandedCost({ adPriceEur, weightKg }) {
  const { shippingEur, bracket } = getColissimoRate(weightKg);
  const internalFees = config.business.internalFrShippingFee;
  const totalEur = adPriceEur + internalFees + shippingEur;
  const totalDzd = Math.round(totalEur * config.business.eurToDzd);

  const breakdown = {
    adPriceEur,
    internalFeesEur: internalFees,
    colissimoEur: shippingEur,
    colissimoBracket: bracket,
    totalCostEur: Math.round(totalEur * 100) / 100,
    totalCostDzd: totalDzd,
    exchangeRate: config.business.eurToDzd,
  };

  logger.info(
    `[Cost] ${adPriceEur}€ + ${internalFees}€ (FR) + ${shippingEur}€ (Colissimo) = ${totalEur.toFixed(2)}€ → ${totalDzd.toLocaleString()} DZD`,
  );

  return breakdown;
}
