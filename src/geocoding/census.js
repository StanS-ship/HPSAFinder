import { CENSUS_GEOCODER_BASE, DEFAULT_CENSUS_BENCHMARK } from '../config/hrsaConfig.js';

let cachedBenchmark = null;

/**
 * Confirms the configured Census benchmark name is still valid by checking
 * it against the live /geocoder/benchmarks endpoint (Section 2.2.1).
 * Falls back to the configured default (with a warning) if the check
 * itself fails — a transient network error here should not block
 * geocoding entirely.
 *
 * @param {string} [configuredBenchmark]
 * @returns {Promise<string>} a benchmark name safe to use
 */
export async function resolveCensusBenchmark(configuredBenchmark = DEFAULT_CENSUS_BENCHMARK) {
  if (cachedBenchmark) return cachedBenchmark;

  try {
    const res = await fetch(`${CENSUS_GEOCODER_BASE}/benchmarks?format=json`);
    if (!res.ok) throw new Error(`benchmarks endpoint returned HTTP ${res.status}`);
    const data = await res.json();
    const names = (data.benchmarks || []).map((b) => b.benchmarkName);

    if (names.includes(configuredBenchmark)) {
      cachedBenchmark = configuredBenchmark;
    } else if (names.length > 0) {
      console.warn(
        `[census] Configured benchmark "${configuredBenchmark}" was not found live. ` +
          `Falling back to first available benchmark: "${names[0]}". ` +
          `Live benchmarks: ${names.join(', ')}`
      );
      cachedBenchmark = names[0];
    } else {
      console.warn('[census] Benchmarks endpoint returned no benchmarks; using configured default.');
      cachedBenchmark = configuredBenchmark;
    }
  } catch (err) {
    console.warn(`[census] Could not verify benchmark against live endpoint (${err.message}); using configured default "${configuredBenchmark}".`);
    cachedBenchmark = configuredBenchmark;
  }

  return cachedBenchmark;
}

/**
 * Very light confidence check: does the matched city/ZIP look like it
 * corresponds to what the user typed? This is intentionally forgiving —
 * its job is only to catch obviously-wrong matches, not to be a full
 * address-validation engine.
 *
 * @param {string} inputAddress
 * @param {object} match - a single addressMatches[] entry from Census
 * @returns {boolean}
 */
function looksConfident(inputAddress, match) {
  if (!match || !match.addressComponents) return false;
  const lowerInput = inputAddress.toLowerCase();
  const { zip, city } = match.addressComponents;

  const zipOk = !zip || lowerInput.includes(zip);
  const cityOk = !city || lowerInput.includes(String(city).toLowerCase());

  // Require at least one of the two signals to line up with the input.
  return zipOk || cityOk;
}

/**
 * Geocode a single-line address using the Census Bureau's free geocoder.
 *
 * @param {string} address
 * @returns {Promise<{lat: number, lon: number, confidence: 'high'|'low', matchedAddress: string} | null>}
 *   null if no usable match was found.
 */
export async function geocodeWithCensus(address) {
  const benchmark = await resolveCensusBenchmark();
  const url = new URL(`${CENSUS_GEOCODER_BASE}/locations/onelineaddress`);
  url.searchParams.set('address', address);
  url.searchParams.set('benchmark', benchmark);
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Census geocoder returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const matches = data?.result?.addressMatches ?? [];

  if (matches.length === 0) return null;

  const best = matches[0];
  const confidence = looksConfident(address, best) ? 'high' : 'low';

  return {
    lat: best.coordinates.y,
    lon: best.coordinates.x,
    confidence,
    matchedAddress: best.matchedAddress,
    stateAbbr: best.addressComponents?.state ?? null,
  };
}
