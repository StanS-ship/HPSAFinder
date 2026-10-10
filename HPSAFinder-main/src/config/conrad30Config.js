import { HRSA_STATE_PCO_DIRECTORY_URL } from './hrsaConfig.js';

/**
 * Date every URL in CONRAD30_PROGRAM_PAGES was last checked against the
 * state's own health department site. State agencies move these pages
 * fairly often (site redesigns, agency reorganizations), so re-verify the
 * whole table at least once a year, ideally each August/September before
 * the October 1 start of the federal fiscal year when most Conrad 30
 * cycles open.
 */
export const CONRAD30_LINKS_LAST_VERIFIED = '2026-10-10';

/**
 * Official Conrad 30 (state J-1 visa waiver) program page for each state,
 * keyed by USPS abbreviation. Each entry was verified on the date above.
 *
 * States intentionally NOT listed fall back to HRSA's live-maintained
 * Primary Care Office directory (HRSA_STATE_PCO_DIRECTORY_URL):
 *   - OH: the current Ohio Department of Health program page URL could
 *         not be confirmed on the last verification pass.
 *   - PR: not researched.
 *
 * Notes on a few entries:
 *   - IN: the Indiana Department of Health runs the program with the
 *         Indiana Primary Health Care Association, whose page IDOH's
 *         guidelines direct applicants to.
 *   - LA: LDH's own FAQ points to its Well-Ahead Louisiana site.
 *   - WY: links to the Primary Care Office page cited in Wyoming's
 *         current Conrad 30 guidelines (no separate program page).
 */
export const CONRAD30_PROGRAM_PAGES = Object.freeze({
  AL: { agency: 'Alabama Department of Public Health', url: 'https://www.alabamapublichealth.gov/ruralhealth/j1visa.html' },
  AK: { agency: 'Alaska Department of Health', url: 'https://health.alaska.gov/en/services/j-1-physician-visa-waiver-program/' },
  AZ: { agency: 'Arizona Department of Health Services', url: 'https://www.azdhs.gov/prevention/health-systems-development/workforce-programs/j-1-visa-waiver/index.php' },
  AR: { agency: 'Arkansas Department of Health', url: 'https://healthy.arkansas.gov/programs-services/prevention-healthy-living/rural-health-primary-care/j-1-visa-waiver-program' },
  CA: { agency: 'California Department of Health Care Access and Information', url: 'https://hcai.ca.gov/workforce/health-workforce/california-primary-care-office/j-1-visa-waiver-program/' },
  CO: { agency: 'Colorado Department of Public Health and Environment', url: 'https://cdphe.colorado.gov/prevention-and-wellness/health-access/international-medical-graduates/j-1-visa-waiver-program' },
  CT: { agency: 'Connecticut Department of Public Health', url: 'https://portal.ct.gov/dph/knowledge-base/articles/primary-care-office/j-1-visa-program' },
  DE: { agency: 'Delaware Health and Social Services', url: 'https://dhss.delaware.gov/dph/homepage/about/sections/hpr/j-1-visa/' },
  DC: { agency: 'DC Health', url: 'https://dchealth.dc.gov/service/j1-visa-waiver-program' },
  FL: { agency: 'Florida Department of Health', url: 'https://www.floridahealth.gov/licensing-regulations/provider-partner-resources/for-health-professionals/conrad-30/' },
  GA: { agency: 'Georgia Department of Community Health', url: 'https://dch.georgia.gov/georgias-j-1-visa-waiver-program' },
  HI: { agency: 'Hawaii State Department of Health', url: 'https://health.hawaii.gov/opcrh/home/conrad-30-j-1-visa-waiver/' },
  ID: { agency: 'Idaho Department of Health and Welfare', url: 'https://healthandwelfare.idaho.gov/providers/rural-health-and-underserved-areas/recruitment-and-retention' },
  IL: { agency: 'Illinois Department of Public Health', url: 'https://dph.illinois.gov/topics-services/life-stages-populations/rural-underserved-populations/j1-waiver-program.html' },
  IN: { agency: 'Indiana Department of Health / Indiana Primary Health Care Association', url: 'https://www.indianapca.org/j1-visa-waiver-program/' },
  IA: { agency: 'Iowa Department of Health and Human Services', url: 'https://hhs.iowa.gov/health-prevention/providers-professionals/rural-health/j1-waiver-and-pniw' },
  KS: { agency: 'Kansas Department of Health and Environment', url: 'https://www.kdhe.ks.gov/261/J-1-Visa-Waiver-Program' },
  KY: { agency: 'Kentucky Cabinet for Health and Family Services', url: 'https://chfs.ky.gov/agencies/dph/dpqi/hcab/Pages/j1visawaiver.aspx' },
  LA: { agency: 'Louisiana Department of Health (Well-Ahead Louisiana)', url: 'https://www.wellaheadla.com/louisiana-conrad-30/' },
  ME: { agency: 'Maine CDC Rural Health and Primary Care Program', url: 'https://www.maine.gov/dhhs/mecdc/public-health-systems/rhpc/j1-visa-waiver-program.shtml' },
  MD: { agency: 'Maryland Department of Health', url: 'https://health.maryland.gov/pophealth/pages/j-1-visa-waiver-program.aspx' },
  MA: { agency: 'Massachusetts Department of Public Health', url: 'https://www.mass.gov/how-to/apply-for-the-conrad-30-j-1-visa-waiver-program' },
  MI: { agency: 'Michigan Department of Health and Human Services', url: 'https://www.michigan.gov/mdhhs/doing-business/providers/medgrad/j1visa/j-1-visa-waiver-program-overview' },
  MN: { agency: 'Minnesota Department of Health', url: 'https://www.health.state.mn.us/facilities/ruralhealth/j1/index.html' },
  MS: { agency: 'Mississippi State Department of Health', url: 'https://msdh.ms.gov/page/44,455,111,304.html' },
  MO: { agency: 'Missouri Department of Health and Senior Services', url: 'https://health.mo.gov/providers/primary-care/j-1-visa-waiver-program' },
  MT: { agency: 'Montana Department of Public Health and Human Services', url: 'https://dphhs.mt.gov/ecfsd/primarycare/j1visaprogram' },
  NE: { agency: 'Nebraska Department of Health and Human Services', url: 'https://dhhs.ne.gov/Pages/Rural-Health-Visa-Waiver.aspx' },
  NV: { agency: 'Nevada Division of Public and Behavioral Health', url: 'https://dpbh.nv.gov/Programs/Conrad30/Conrad30-Home/' },
  NH: { agency: 'New Hampshire Department of Health and Human Services', url: 'https://www.dhhs.nh.gov/programs-services/health-care/rural-health-primary-care/j-1-visa-waiver-program' },
  NJ: { agency: 'New Jersey Department of Health', url: 'https://www.nj.gov/health/fhs/primarycare/provider-placement' },
  NM: { agency: 'New Mexico Department of Health', url: 'https://nmhealth.org/about/phd/pchb/oprh/jvwp/' },
  NY: { agency: 'New York State Department of Health', url: 'https://www.health.ny.gov/professionals/j-1_visa_waivers/' },
  NC: { agency: 'North Carolina Office of Rural Health', url: 'https://www.ncdhhs.gov/j-1-visa-waiver-guidelines' },
  ND: { agency: 'North Dakota Health and Human Services', url: 'https://hhs.nd.gov/health/primary-care-office/J-1-visa' },
  OK: { agency: 'Oklahoma State Department of Health', url: 'https://oklahoma.gov/health/health-education/community-outreach/community-development-services/office-of-primary-care-and-rural-health-development/j-1-visa-waiver-conrad-30-program.html' },
  OR: { agency: 'Oregon Health Authority', url: 'https://www.oregon.gov/oha/hpa/hp-pco/pages/j1.aspx' },
  PA: { agency: 'Pennsylvania Department of Health', url: 'https://www.pa.gov/agencies/health/healthcare-and-public-health-professionals/primary-care/physician-visa-waiver' },
  RI: { agency: 'Rhode Island Department of Health', url: 'https://health.ri.gov/healthcare/physician-visa-waiver-program' },
  SC: { agency: 'South Carolina Department of Public Health', url: 'https://dph.sc.gov/professionals/south-carolina-primary-care-office/pco-j-1-waiver' },
  SD: { agency: 'South Dakota Department of Health', url: 'https://doh.sd.gov/health-care-professionals/rural-health/j-1-waiver-program/' },
  TN: { agency: 'Tennessee Department of Health', url: 'https://www.tn.gov/health/health-program-areas/division-of-health-disparities-elimination-/rural-health/j1.html' },
  TX: { agency: 'Texas Department of State Health Services', url: 'https://www.dshs.texas.gov/texas-primary-care-office-tpco/texas-conrad-30-j-1-visa-waiver-program' },
  UT: { agency: 'Utah Office of Primary Care and Rural Health', url: 'https://ruralhealth.utah.gov/j-1-visa-waivers/' },
  VT: { agency: 'Vermont Department of Health', url: 'https://www.healthvermont.gov/systems/health-professionals/j1-visa' },
  VA: { agency: 'Virginia Department of Health', url: 'https://www.vdh.virginia.gov/health-equity/conrad-30-waiver-program-overview/' },
  WA: { agency: 'Washington State Department of Health', url: 'https://doh.wa.gov/public-health-provider-resources/health-workforce-and-primary-care-systems-development/j-1-visa-waiver-program' },
  WV: { agency: 'West Virginia State Office of Rural Health', url: 'https://dhhr.wv.gov/ruralhealth/j1conrad30arc/Pages/default.aspx' },
  WI: { agency: 'Wisconsin Department of Health Services', url: 'https://www.dhs.wisconsin.gov/primarycare/j-1visa/index.htm' },
  WY: { agency: 'Wyoming Department of Health', url: 'https://health.wyo.gov/publichealth/rural/officeofruralhealth/primary-care-office/' },
});

/**
 * @typedef {object} Conrad30ProgramLink
 * @property {string} url - the state's program page, or the HRSA directory
 * @property {string|null} agency - administering agency, null on fallback
 * @property {boolean} isStateSpecific - false when falling back to HRSA
 */

/**
 * Resolve the Conrad 30 program link for a state. Accepts the state
 * object produced by checkJ1BaselineEligibility() ({name, abbr}, either of
 * which may be null), since the HPSA layer only supplies a state name.
 *
 * @param {{name?: string|null, abbr?: string|null}|null} state
 * @param {Record<string, {name: string, abbr: string}>} [stateTable] - FIPS
 *   table used to map a name to an abbreviation
 * @returns {Conrad30ProgramLink}
 */
export function getConrad30ProgramLink(state, stateTable = {}) {
  const fallback = { url: HRSA_STATE_PCO_DIRECTORY_URL, agency: null, isStateSpecific: false };
  if (!state) return fallback;

  let abbr = typeof state.abbr === 'string' ? state.abbr.trim().toUpperCase() : null;
  if (!abbr && typeof state.name === 'string') {
    const wanted = state.name.trim().toLowerCase();
    const match = Object.values(stateTable).find((s) => s.name.toLowerCase() === wanted);
    abbr = match ? match.abbr : null;
  }

  const entry = abbr ? CONRAD30_PROGRAM_PAGES[abbr] : null;
  return entry ? { url: entry.url, agency: entry.agency, isStateSpecific: true } : fallback;
}
