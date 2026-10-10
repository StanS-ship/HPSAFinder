import { geocodeAddress } from '../geocoding/index.js';
import { queryHpsaForSpecialty } from '../hpsa/query.js';
import { checkMuaStatus } from '../mua/query.js';
import { calculateBonus } from '../bonus/calculate.js';
import { checkJ1BaselineEligibility } from '../j1/eligibility.js';
import {
  FULL_PARTIAL_COUNTY_DISCLAIMER,
  CMS_VERIFICATION_NOTE,
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
 * @property {'physician'|'psychiatrist'} specialty
 * @property {number} annualPaidAmount - estimated annual Medicare-paid amount
 * @property {number} [paidToAllowedRatio] - optional user planning estimate converting allowed charges to paid amounts
 * @property {string} [googleApiKey] - optional, enables the Google fallback geocoder
 */

/**
 * CMS pays the HPSA bonus based on designations in effect as of December 31
 * of the PRIOR year. An area designated during the current calendar year is
 * not bonus-eligible until January 1 of the next year.
 *
 * @param {Date} [now]
 * @returns {{cutoffDate: Date, nextYear: number}}
 */
export function cmsDesignationCutoff(now = new Date()) {
  const year = now.getUTCFullYear();
  return { cutoffDate: new Date(Date.UTC(year - 1, 11, 31)), nextYear: year + 1 };
}

/**
 * Classify a designated feature against the CMS December 31 cutoff.
 *
 * @param {object} feature - parsed HPSA feature
 * @param {Date} cutoffDate - December 31 of the prior year
 * @returns {'likely_eligible'|'not_yet_eligible'|'withdrawn'|'designation_date_missing'}
 */
export function classifyDesignation(feature, cutoffDate) {
  if (feature.hpsa_status_desc === 'Withdrawn') return 'withdrawn';

  const raw = feature.designation_dt;
  if (raw === null || raw === undefined || raw === '') return 'designation_date_missing';

  const designated = new Date(raw);
  if (Number.isNaN(designated.getTime())) return 'designation_date_missing';

  return designated.getTime() <= cutoffDate.getTime() ? 'likely_eligible' : 'not_yet_eligible';
}

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
  const { address, specialty, annualPaidAmount, paidToAllowedRatio, googleApiKey } = input;

  if (!address || !address.trim()) {
    throw new Error('address is required.');
  }
  if (!specialty || !(specialty in { physician: 1, psychiatrist: 1 })) {
    throw new Error('specialty must be one of: physician, psychiatrist.');
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
  let primaryResult;
  try {
    primaryResult = await queryHpsaForSpecialty(specialty, geocode.lon, geocode.lat);
  } catch (err) {
    onLog({ hpsaQueryFailed: true, error: err.message });
    return {
      status: 'hpsa_query_failed',
      message: 'We could not check the HPSA designation right now. Please try again shortly.',
      geocode,
      hpsa: null,
      mua,
      bonus: null,
    };
  }

  const { cutoffDate, nextYear } = cmsDesignationCutoff();
  const designationClass = classifyDesignation(primaryResult.eligibleFeatures[0] ?? {}, cutoffDate);

  const isEligible = primaryResult.eligibleFeatures.length > 0;

  // Step 3: check the other discipline so the dual-discipline annotation can
  // apply (psychiatrist queried both primary-care and mental-health layers;
  // for a physician, check mental health for the annotation).
  let otherResult = null;
  try {
    if (isEligible && specialty === 'physician') {
      otherResult = await queryHpsaForSpecialty('psychiatrist', geocode.lon, geocode.lat);
    } else if (isEligible && specialty === 'psychiatrist') {
      otherResult = await queryHpsaForSpecialty('physician', geocode.lon, geocode.lat);
    }
  } catch (err) {
    onLog({ otherDisciplineQueryFailed: true, error: err.message });
  }

  const bothDisciplines = Boolean(otherResult && otherResult.eligibleFeatures.length > 0);

  onLog({
    layersQueried: [primaryResult.layerId, otherResult?.layerId].filter(Boolean),
    hpsaEligible: isEligible,
    bothDisciplines,
  });

  if (!isEligible || designationClass === 'withdrawn') {
    return {
      status: 'not_in_hpsa',
      message: NOT_IN_HPSA_MESSAGE,
      geocode,
      hpsa: {
        discipline: primaryResult.discipline,
        layerId: primaryResult.layerId,
        eligibleFeatures: [],
        allFeatures: primaryResult.allFeatures,
          bothDisciplines: false,
      },
      mua,
      bonus: null,
      cmsVerificationNote: CMS_VERIFICATION_NOTE,
    };
  }

  // Step 4: bonus calculation — only for designations already in effect at
  // the CMS cutoff. A designation dated after the cutoff is reported as
  // "not yet bonus-eligible" with a projected next-year estimate instead.
  const bonus = calculateBonus(annualPaidAmount, { paidToAllowedRatio, bothDisciplines });

  const baseResult = {
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
    cmsVerificationNote: CMS_VERIFICATION_NOTE,
  };

  if (designationClass === 'not_yet_eligible') {
    return {
      ...baseResult,
      bonusEligibility: {
        classification: 'not_yet_eligible',
        cutoffDate: cutoffDate.toISOString(),
        nextYear,
      },
    };
  }

  if (designationClass === 'designation_date_missing') {
    return {
      ...baseResult,
      bonusEligibility: {
        classification: 'designation_date_missing',
        cutoffDate: cutoffDate.toISOString(),
      },
    };
  }

  return {
    ...baseResult,
    bonusEligibility: {
      classification: 'likely_eligible',
      cutoffDate: cutoffDate.toISOString(),
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
 *   4. Attach the state's Conrad 30 program link (or the HRSA PCO
 *      directory as a fallback) and the state-variation
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

  let j1Result;
  try {
    j1Result = await checkJ1BaselineEligibility(geocode.lon, geocode.lat, {
      geocodedStateAbbr: geocode.stateAbbr,
    });
  } catch (err) {
    onLog({ j1QueryFailed: true, error: err.message });
    return {
      status: 'j1_query_failed',
      message: 'We could not check the shortage-area designations right now. Please try again shortly.',
      geocode,
      j1: null,
    };
  }

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
      stateConrad30Program: j1Result.stateConrad30Program,
      stateVariationCaveat: J1_STATE_VARIATION_CAVEAT,
    },
  };
}

export { HPSA_LAYER_IDS };
