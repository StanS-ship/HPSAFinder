import { geocodeAddress } from '../geocoding/index.js';
import { queryHpsaForSpecialty } from '../hpsa/query.js';
import { checkMuaStatus } from '../mua/query.js';
import { calculateBonus } from '../bonus/calculate.js';
import { checkJ1BaselineEligibility } from '../j1/eligibility.js';
import {
  FULL_PARTIAL_COUNTY_DISCLAIMER,
  GEOCODE_FAILURE_MESSAGE,
  NOT_IN_HPSA_MESSAGE,
  MUA_NO_BONUS_NOTE,
  J1_BASELINE_ELIGIBLE_NOTE,
  J1_BASELINE_NOT_ELIGIBLE_NOTE,
  J1_HHS_PROGRAM_ELIGIBLE_NOTE,
  J1_STATE_VARIATION_CAVEAT,
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
      mua: null,
      bonus: null,
    };
  }

  // MUA/MUP lookup is informational and independent of specialty/bonus —
  // run it alongside the HPSA lookup rather than gating it on eligibility.
  // A failure here should not block the HPSA/bonus result the user came
  // for, so it's caught and surfaced as a soft error instead of thrown.
  let mua = null;
  try {
    const muaStatus = await checkMuaStatus(geocode.lon, geocode.lat);
    mua = {
      isInMua: muaStatus.isInMua,
      activeFeatures: muaStatus.activeFeatures,
      note: MUA_NO_BONUS_NOTE,
    };
    onLog({ muaChecked: true, isInMua: muaStatus.isInMua });
  } catch (err) {
    mua = { error: err.message, note: MUA_NO_BONUS_NOTE };
    onLog({ muaChecked: true, error: err.message });
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
      mua,
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
    mua,
    bonus,
    disclaimers: {
      fullPartialCounty: FULL_PARTIAL_COUNTY_DISCLAIMER,
    },
  };
}

/**
 * @typedef {object} J1CheckerInput
 * @property {string} address
 * @property {string} [googleApiKey] - optional, enables the Google fallback geocoder
 */

/**
 * Runs the J-1 Visa Waiver baseline eligibility pipeline:
 *   1. Geocode the address (Census, then Google fallback) — same
 *      geocoding module as the bonus calculator.
 *   2. Check the federal baseline: is this location within an active
 *      geographic HPSA (any discipline) or an active MUA/MUP designation.
 *   3. Flag whether it separately meets the HHS J-1 program's HPSA
 *      score >= 7 threshold.
 *   4. Attach the state PCO directory link and the state-variation
 *      caveat — this checker does NOT evaluate individual state Conrad 30
 *      rules (see J1_STATE_VARIATION_CAVEAT for why).
 *
 * Framework-agnostic, same as calculateHpsaBonus — plain object in, plain
 * object out.
 *
 * @param {J1CheckerInput} input
 * @param {object} [options]
 * @param {(entry: object) => void} [options.onLog]
 * @returns {Promise<object>} structured result
 */
export async function checkJ1Eligibility(input, options = {}) {
  const { onLog = () => {} } = options;
  const { address, googleApiKey } = input;

  if (!address || !address.trim()) {
    throw new Error('address is required.');
  }

  const geocode = await geocodeAddress(address, { googleApiKey, onLog });

  if (!geocode) {
    return {
      status: 'geocode_failed',
      message: GEOCODE_FAILURE_MESSAGE,
      geocode: null,
      j1: null,
    };
  }

  const j1Result = await checkJ1BaselineEligibility(geocode.lon, geocode.lat, {
    geocodedStateAbbr: geocode.stateAbbr,
  });

  onLog({
    j1BaselineMet: j1Result.meetsBaseline,
    j1HhsThresholdMet: j1Result.meetsHhsProgramThreshold,
    state: j1Result.state?.abbr ?? j1Result.state?.name ?? null,
  });

  return {
    status: j1Result.meetsBaseline ? 'eligible' : 'not_eligible',
    geocode,
    j1: {
      meetsBaseline: j1Result.meetsBaseline,
      baselineNote: j1Result.meetsBaseline ? J1_BASELINE_ELIGIBLE_NOTE : J1_BASELINE_NOT_ELIGIBLE_NOTE,
      maxHpsaScore: j1Result.maxHpsaScore,
      meetsHhsProgramThreshold: j1Result.meetsHhsProgramThreshold,
      hhsProgramNote: j1Result.meetsHhsProgramThreshold ? J1_HHS_PROGRAM_ELIGIBLE_NOTE : null,
      hpsaByDiscipline: j1Result.hpsaByDiscipline,
      mua: j1Result.mua,
      state: j1Result.state,
      statePcoDirectoryUrl: j1Result.statePcoDirectoryUrl,
      stateVariationCaveat: J1_STATE_VARIATION_CAVEAT,
    },
  };
}

export { HPSA_LAYER_IDS };
