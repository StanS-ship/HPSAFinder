import { geocodeWithCensus } from './census.js';
import { geocodeWithGoogle } from './google.js';

/**
 * @typedef {object} GeocodeResult
 * @property {number} lat
 * @property {number} lon
 * @property {'high'|'medium'|'low'} confidence
 * @property {string} matchedAddress
 * @property {'census'|'google'} source
 * @property {string|null} stateAbbr
 */

/**
 * Geocode an address: Census first, Google fallback on failure or
 * low-confidence match (Section 2.2 / 4, step 2-3).
 *
 * @param {string} address
 * @param {object} [options]
 * @param {string} [options.googleApiKey]
 * @param {(entry: object) => void} [options.onLog] - optional logging hook
 *   (Section 7.8: log geocoder used, match confidence, fallback usage).
 * @returns {Promise<GeocodeResult | null>} null if both geocoders fail.
 */
export async function geocodeAddress(address, options = {}) {
  const { googleApiKey, onLog = () => {} } = options;

  if (!address || !address.trim()) {
    throw new Error('An address is required.');
  }

  let censusResult = null;
  let censusError = null;

  try {
    censusResult = await geocodeWithCensus(address);
  } catch (err) {
    censusError = err;
  }

  if (censusResult && censusResult.confidence === 'high') {
    onLog({ geocoder: 'census', confidence: censusResult.confidence, fallbackUsed: false });
    return { ...censusResult, source: 'census' };
  }

  // Census either failed, found nothing, or returned a low-confidence match.
  onLog({
    geocoder: 'census',
    confidence: censusResult?.confidence ?? 'none',
    error: censusError?.message ?? null,
    fallbackTriggered: true,
  });

  if (!googleApiKey) {
    onLog({ geocoder: 'census', confidence: censusResult?.confidence ?? 'none', fallbackUsed: false, fallbackAvailable: false });
    return censusResult?.confidence === 'high' ? { ...censusResult, source: 'census' } : null;
  }

  try {
    const googleResult = await geocodeWithGoogle(address, googleApiKey);
    if (googleResult) {
      onLog({ geocoder: 'google', confidence: googleResult.confidence, fallbackUsed: true });
      return { ...googleResult, source: 'google' };
    }
  } catch (err) {
    onLog({ geocoder: 'google', error: err.message, fallbackUsed: true });
  }

  // Do not query shortage-area boundaries with a low-confidence location.
  return null;
}
