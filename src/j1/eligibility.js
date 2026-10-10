import { queryAllHpsaDisciplines } from '../hpsa/query.js';
import { checkMuaStatus } from '../mua/query.js';
import { lookupStateByFips, STATE_FIPS_TO_INFO } from '../config/statesConfig.js';
import { HHS_J1_PROGRAM_MIN_HPSA_SCORE, HRSA_STATE_PCO_DIRECTORY_URL } from '../config/hrsaConfig.js';
import { getConrad30ProgramLink } from '../config/conrad30Config.js';

/**
 * @typedef {object} J1EligibilityResult
 * @property {boolean} meetsBaseline - true if HPSA (any discipline) or MUA/MUP is active here
 * @property {boolean} meetsHhsProgramThreshold - true if the highest active HPSA score is >= 7
 * @property {number|null} maxHpsaScore - highest score among active HPSA features, or null if none
 * @property {{discipline: string, layerId: number, eligibleFeatures: object[]}[]} hpsaByDiscipline
 * @property {{isInMua: boolean, activeFeatures: object[]}} mua
 * @property {{name: string, abbr: string}|null} state
 * @property {string} statePcoDirectoryUrl - HRSA's live-maintained state PCO directory link
 * @property {{url: string, agency: string|null, isStateSpecific: boolean}} stateConrad30Program -
 *   the state's own Conrad 30 program page, or the HRSA directory if none is on file
 */

/**
 * Checks the FEDERAL BASELINE only for J-1 Conrad 30 / HHS waiver
 * eligibility at a location: is it within an active geographic HPSA (any
 * discipline) or an active MUA/MUP designation. Does NOT evaluate any
 * individual state's additional Conrad 30 rules (score cutoffs for
 * specific specialties, Medicaid-percent requirements, slot availability)
 * — see J1_STATE_VARIATION_CAVEAT for why that's out of scope by design.
 *
 * @param {number} lon
 * @param {number} lat
 * @param {object} [options]
 * @param {string|null} [options.geocodedStateAbbr] - state abbreviation from
 *   the geocoder, if available; preferred over deriving state from HPSA/MUA
 *   attributes since it reflects the actual input address most directly.
 * @returns {Promise<J1EligibilityResult>}
 */
export async function checkJ1BaselineEligibility(lon, lat, options = {}) {
  const { geocodedStateAbbr = null } = options;

  const hpsaByDiscipline = await queryAllHpsaDisciplines(lon, lat);
  let muaStatus;
  try {
    muaStatus = await checkMuaStatus(lon, lat);
  } catch (err) {
    muaStatus = { isInMua: false, activeFeatures: [], allFeatures: [], error: err.message };
  }

  const allActiveHpsaFeatures = hpsaByDiscipline.flatMap((d) => d.eligibleFeatures);
  const hasActiveHpsa = allActiveHpsaFeatures.length > 0;
  const meetsBaseline = hasActiveHpsa || muaStatus.isInMua;

  const scores = allActiveHpsaFeatures
    .map((f) => Number(f.hpsa_score))
    .filter((n) => !Number.isNaN(n));
  const maxHpsaScore = scores.length > 0 ? Math.max(...scores) : null;
  const meetsHhsProgramThreshold = maxHpsaScore !== null && maxHpsaScore >= HHS_J1_PROGRAM_MIN_HPSA_SCORE;

  // Resolve a state name/abbr for the PCO directory link: prefer the
  // geocoder's own state, then fall back to whatever HPSA/MUA features
  // returned (HPSA gives a state name directly; MUA only gives a FIPS code).
  let state = null;
  if (geocodedStateAbbr) {
    const stateInfo = Object.values(STATE_FIPS_TO_INFO).find((candidate) => candidate.abbr === geocodedStateAbbr);
    state = stateInfo ? { ...stateInfo } : { name: null, abbr: geocodedStateAbbr };
  } else {
    const hpsaWithState = allActiveHpsaFeatures.find((f) => f.primary_state_nm);
    if (hpsaWithState) {
      state = { name: hpsaWithState.primary_state_nm, abbr: null };
    } else {
      const muaWithState = muaStatus.activeFeatures.find((f) => f.state_fips_cd);
      if (muaWithState) {
        state = lookupStateByFips(muaWithState.state_fips_cd);
      }
    }
  }

  return {
    meetsBaseline,
    meetsHhsProgramThreshold,
    maxHpsaScore,
    hpsaByDiscipline,
    mua: { isInMua: muaStatus.isInMua, activeFeatures: muaStatus.activeFeatures },
    state,
    statePcoDirectoryUrl: HRSA_STATE_PCO_DIRECTORY_URL,
    stateConrad30Program: getConrad30ProgramLink(state, STATE_FIPS_TO_INFO),
  };
}
