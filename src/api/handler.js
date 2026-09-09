import { geocodeAddress } from '../geocoding/index.js';
import { queryHpsaForSpecialty } from '../hpsa/query.js';
import { calculateBonus } from '../bonus/calculate.js';
import {
  FULL_PARTIAL_COUNTY_DISCLAIMER,
  GEOCODE_FAILURE_MESSAGE,
  NOT_IN_HPSA_MESSAGE,
} from '../consent/disclaimerText.js';
import { HPSA_LAYER_IDS } from '../config/hrsaConfig.js';

/**
 * @typedef {object} CalculatorInput
 * @property {string} address
 * @property {'physician'|'psychiatrist'|'dentist'} specialty
 * @property {number} annualPaidAmount - estimated annual Medicare-paid amount
 * @property {number} [paymentFactor] - optional override of the configurable payment-factor estimate
 * @property {string} [googleApiKey] - optional, enables the Google fallback geocoder
 */

/**
 * Runs the full pipeline described in Section 4 of the research brief:
 *   1. Geocode the address (Census, then Google fallback)
 *   2. Spatial-query the correct HPSA layer for the chosen specialty
 *   3. Also check the "other" primary-care/mental-health layer so we can
 *      surface the Section 5.3 dual-discipline annotation
 *   4. Apply the CMS bonus calculation
 *   5. Return a single structured result with disclaimers attached
 *
 * This function is deliberately framework- and host-agnostic — it takes a
 * plain object in and returns a plain object out, with no dependency on
 * any particular server, router, or hosting platform. Wire it into
 * Express, a serverless function, Bolt.new's backend, etc. by writing a
 * thin adapter around it.
 *
 * @param {CalculatorInput} input
 * @param {object} [options]
 * @param {(entry: object) => void} [options.onLog] - structured logging hook (Section 7.8)
 * @returns {Promise<object>} structured result — see inline shape below
 */
export async function calculateHpsaBonus(input, options = {}) {
  const { onLog = () => {} } = options;
  const { address, specialty, annualPaidAmount, paymentFactor, googleApiKey } = input;

  if (!address || !address.trim()) {
    throw new Error('address is required.');
  }
  if (!specialty || !(specialty in { physician: 1, psychiatrist: 1, dentist: 1 })) {
    throw new Error('specialty must be one of: physician, psychiatrist, dentist.');
  }
  if (typeof annualPaidAmount !== 'number' || Number.isNaN(annualPaidAmount) || annualPaidAmount < 0) {
    throw new Error('annualPaidAmount must be a non-negative number.');
  }

  // Step 1: geocode
  const geocode = await geocodeAddress(address, { googleApiKey, onLog });

  if (!geocode) {
    return {
      status: 'geocode_failed',
      message: GEOCODE_FAILURE_MESSAGE,
      geocode: null,
      hpsa: null,
      bonus: null,
    };
  }

  // Step 2: query the layer relevant to the chosen specialty
  const primaryResult = await queryHpsaForSpecialty(specialty, geocode.lon, geocode.lat);

  // Step 3: for physicians/psychiatrists, also check the other discipline
  // so we can apply the Section 5.3 "only one bonus" annotation when a
  // location is both a primary-care and mental-health HPSA.
  let otherResult = null;
  if (specialty === 'physician') {
    otherResult = await queryHpsaForSpecialty('psychiatrist', geocode.lon, geocode.lat);
  } else if (specialty === 'psychiatrist') {
    otherResult = await queryHpsaForSpecialty('physician', geocode.lon, geocode.lat);
  }

  const isEligible = primaryResult.eligibleFeatures.length > 0;
  const bothDisciplines = isEligible && Boolean(otherResult && otherResult.eligibleFeatures.length > 0);

  onLog({
    layersQueried: [primaryResult.layerId, otherResult?.layerId].filter(Boolean),
    hpsaEligible: isEligible,
    bothDisciplines,
  });

  if (!isEligible) {
    return {
      status: 'not_in_hpsa',
      message: NOT_IN_HPSA_MESSAGE,
      geocode,
      hpsa: {
        discipline: primaryResult.discipline,
        layerId: primaryResult.layerId,
        eligibleFeatures: [],
        allFeaturesReturned: primaryResult.allFeatures,
      },
      bonus: null,
    };
  }

  // Step 4: bonus calculation
  const bonus = calculateBonus(annualPaidAmount, { paymentFactor, bothDisciplines });

  return {
    status: 'eligible',
    message: null,
    geocode,
    hpsa: {
      discipline: primaryResult.discipline,
      layerId: primaryResult.layerId,
      eligibleFeatures: primaryResult.eligibleFeatures,
      bothDisciplines,
    },
    bonus,
    disclaimers: {
      fullPartialCounty: FULL_PARTIAL_COUNTY_DISCLAIMER,
    },
  };
}

export { HPSA_LAYER_IDS };
