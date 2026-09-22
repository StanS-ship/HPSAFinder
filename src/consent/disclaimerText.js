/**
 * Verbatim legal/consent copy from Section 6 of the research brief.
 * DO NOT paraphrase or reword these strings — TCPA/FTC consent language
 * and the non-affiliation disclaimer need to match the reviewed text
 * exactly. If legal counsel needs to edit this copy, edit it here (single
 * source of truth) rather than inline in UI templates.
 */

/**
 * 6.1 — TCPA/FTC consent checkbox text. `{{AGENCY_NAME}}` must be replaced
 * with the actual named recruiter/hospital for each checkbox — render one
 * checkbox per named seller, and store the exact rendered text, a
 * timestamp, the user's IP, and which boxes were checked.
 */
export const TCPA_CONSENT_TEMPLATE =
  'By checking this box, I agree that {{AGENCY_NAME}} may contact me at the phone number and email I provide with information about physician and advanced-practice job opportunities. Contact may include calls or text messages using an automatic telephone dialing system or prerecorded/artificial voice. I understand that I am not required to consent as a condition of using this calculator or any services, and I can opt out at any time.';

/**
 * Renders the TCPA consent text for a specific named agency/hospital.
 * @param {string} agencyName
 * @returns {string}
 */
export function renderTcpaConsent(agencyName) {
  if (!agencyName || !agencyName.trim()) {
    throw new Error('agencyName is required to render TCPA consent text (one checkbox per named seller).');
  }
  return TCPA_CONSENT_TEMPLATE.replace('{{AGENCY_NAME}}', agencyName.trim());
}

/** 5.2 — Full/partial-county disclaimer (shown instead of computing an exact flag). */
export const FULL_PARTIAL_COUNTY_DISCLAIMER =
  "This tool identifies whether your location falls within a designated HPSA. Some ZIP codes split across full- and partial-county HPSA boundaries may require an AQ modifier on claims. Verify your exact billing requirements with your MAC or CMS's published bonus ZIP code list.";

/**
 * Shown alongside any MUA/MUP result. Unlike an HPSA designation, MUA/MUP
 * status does NOT trigger the CMS 10% Medicare bonus — it's relevant to
 * other things (FQHC/Section 330 eligibility, Rural Health Clinic
 * eligibility, National Health Service Corps site eligibility). Keep this
 * next to any MUA/MUP result so it's never mistaken for "another bonus."
 */
export const MUA_NO_BONUS_NOTE =
  'A Medically Underserved Area/Population (MUA/MUP) designation does not by itself trigger the CMS 10% Medicare HPSA bonus. It is used for other eligibility purposes, such as Federally Qualified Health Center (FQHC), Section 330, and Rural Health Clinic requirements. Check with HRSA or your MAC to confirm how it applies to your situation.';

/** 5.3 — Shown when a location is both a primary-care and mental-health HPSA. */
export const DUAL_DISCIPLINE_NOTE =
  'CMS pays only one 10% bonus per service even if the area is both a primary-care and mental-health HPSA.';

/** 5.5 — Shown when both geocoders fail or return low confidence. */
export const GEOCODE_FAILURE_MESSAGE =
  'We could not reliably locate this address. Please double-check the address format or contact your MAC/HRSA for an official determination.';

/** 5.5 — Shown when no HPSA polygon feature intersects the point. */
export const NOT_IN_HPSA_MESSAGE = 'Location is not in a geographic HPSA';

/** 6.2 — Non-affiliation disclaimer. */
export const NON_AFFILIATION_DISCLAIMER =
  "This calculator is an independent tool and is not affiliated with or endorsed by HRSA or CMS. Bonus eligibility and payment are determined solely by CMS based on official Medicare rules and HRSA's shortage-area designations. Always verify your eligibility and exact bonus amounts using official CMS and HRSA resources before making billing or contractual decisions.";

/** 6.2 — Referral-fee disclosure, only render this if referral fees actually apply. */
export const REFERRAL_FEE_DISCLOSURE =
  'Some links and referrals on this site are to organizations we partner with. We may receive a referral fee or commission if you choose to connect with them or accept a position. Our recommendations are based on our assessment of their services, but you should consider this financial relationship when evaluating them.';
