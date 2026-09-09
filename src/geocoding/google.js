import { GOOGLE_GEOCODER_BASE } from '../config/hrsaConfig.js';

/**
 * Geocode a single-line address using the Google Maps Geocoding API.
 * Intended as a fallback only (Section 2.2.2) — used when the Census
 * geocoder fails or returns a low-confidence match.
 *
 * @param {string} address
 * @param {string} apiKey - Google Geocoding API key (must have billing enabled)
 * @returns {Promise<{lat: number, lon: number, confidence: 'high'|'medium', matchedAddress: string} | null>}
 */
export async function geocodeWithGoogle(address, apiKey) {
  if (!apiKey) {
    throw new Error('Google geocoding requires an API key (GOOGLE_GEOCODING_API_KEY).');
  }

  const url = new URL(GOOGLE_GEOCODER_BASE);
  url.searchParams.set('address', address);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Google geocoder returned HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
    return null;
  }

  const best = data.results[0];
  const locationType = best.geometry?.location_type;
  // ROOFTOP / RANGE_INTERPOLATED are strong matches; APPROXIMATE is weaker.
  const confidence = locationType === 'ROOFTOP' || locationType === 'RANGE_INTERPOLATED' ? 'high' : 'medium';

  return {
    lat: best.geometry.location.lat,
    lon: best.geometry.location.lng,
    confidence,
    matchedAddress: best.formatted_address,
  };
}
