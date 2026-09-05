// ─────────────────────────────────────────────────────────────
// Rate-Limit & Free-Tier Guard Utility
// ─────────────────────────────────────────────────────────────
// Shared helper that detects 429/402 responses from any API,
// tracks per-service backoff state, and exposes a sleep helper.
// ─────────────────────────────────────────────────────────────

import config from './index.js';
import logger from './logger.js';

/** Per-service backoff state: { pausedUntil, currentBackoffMs } */
const serviceState = new Map();

/**
 * Check if a service is currently in backoff.
 * @param {string} serviceName
 * @returns {boolean}
 */
export function isServicePaused(serviceName) {
  const state = serviceState.get(serviceName);
  if (!state) return false;
  if (Date.now() >= state.pausedUntil) {
    serviceState.delete(serviceName);
    logger.info(`[RateLimit] ${serviceName} backoff expired, resuming`);
    return false;
  }
  const remainSec = Math.round((state.pausedUntil - Date.now()) / 1000);
  logger.warn(`[RateLimit] ${serviceName} still paused for ${remainSec}s`);
  return true;
}

/**
 * Put a service into backoff with exponential increase.
 * @param {string} serviceName
 * @param {number} [statusCode] – HTTP status that triggered this
 */
export function triggerBackoff(serviceName, statusCode) {
  const prev = serviceState.get(serviceName);
  const prevBackoff = prev?.currentBackoffMs || config.rateLimits.backoffMs;
  // Exponential backoff: double each time, cap at maxBackoffMs
  const nextBackoff = Math.min(prevBackoff * 2, config.rateLimits.maxBackoffMs);

  serviceState.set(serviceName, {
    pausedUntil: Date.now() + nextBackoff,
    currentBackoffMs: nextBackoff,
  });

  const reason = statusCode === 429 ? 'RATE LIMITED (429)'
    : statusCode === 402 ? 'PAYMENT REQUIRED (402)'
    : `HTTP ${statusCode || 'error'}`;

  logger.warn(`[RateLimit] ⚠️ ${serviceName} ${reason} — pausing for ${nextBackoff / 1000}s`);
}

/**
 * Check if an error/response indicates a rate-limit or billing issue.
 * @param {Error | any} err
 * @returns {number | null} – the status code if rate-limited, null otherwise
 */
export function detectRateLimitStatus(err) {
  const status = err?.status || err?.response?.status || err?.statusCode;
  if (status === 429 || status === 402) return status;
  // Groq SDK sometimes wraps differently
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('rate_limit') || msg.includes('rate limit')) return 429;
  if (msg.includes('insufficient') || msg.includes('quota')) return 402;
  return null;
}

/**
 * Wrap an async API call with rate-limit detection and backoff.
 * Returns null (instead of crashing) if the service is paused or rate-limited.
 *
 * @template T
 * @param {string} serviceName
 * @param {() => Promise<T>} fn
 * @returns {Promise<T | null>}
 */
export async function withRateLimitGuard(serviceName, fn) {
  if (isServicePaused(serviceName)) return null;

  try {
    return await fn();
  } catch (err) {
    const status = detectRateLimitStatus(err);
    if (status) {
      triggerBackoff(serviceName, status);
      return null;
    }
    throw err; // re-throw non-rate-limit errors
  }
}

/** Simple sleep helper */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
