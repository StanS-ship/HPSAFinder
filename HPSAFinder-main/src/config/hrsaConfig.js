/**
 * Central configuration for HRSA / Census / Google endpoints and layer IDs.
 *
 * Values here were confirmed directly against the live HRSA MapServer
 * metadata (Section 2.1 of the research brief) on 2026-09-09:
 *   https://gisportal.hrsa.gov/server/rest/services/Shortage/HealthProfessionalShortageAreas_FS/MapServer
 *   https://gisportal.hrsa.gov/server/rest/services/Shortage/HealthProfessionalShortageAreas_FS/MapServer/10
 *
 * Do NOT hardcode layer IDs or field names anywhere else in the codebase —
 * import them from here so a future HRSA schema change only needs to be
 * fixed in one place.
 */

export const HRSA_MAPSERVER_BASE =
  'https://gisportal.hrsa.gov/server/rest/services/Shortage/HealthProfessionalShortageAreas_FS/MapServer';

/**
 * Perimeter-polygon layer IDs, verified live (Section 2.1 / 2.1.1).
 * These are the ONLY layers to use for point-in-polygon queries — the
 * point layers (1/5/9) and component-polygon layers (3/7/11) are not
 * appropriate substitutes for this use case.
 */
export const HPSA_LAYER_IDS = Object.freeze({
  dental: 2,
  mental_health: 6,
  primary_care: 10,
});

/** Specialty → discipline routing (Section 5.3). */
export const SPECIALTY_TO_DISCIPLINE = Object.freeze({
  physician: 'primary_care',
  psychiatrist: 'mental_health',
  dentist: 'dental',
});

export const CENSUS_GEOCODER_BASE = 'https://geocoding.geo.census.gov/geocoder';

export const GOOGLE_GEOCODER_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Default Census benchmark. "Public_AR_Current" is Census's own stable
 * alias for whichever dataset is presently current (confirmed against
 * Census's Geocoding Services API documentation), so it is expected to
 * remain valid indefinitely. Per the brief, treat it as configurable
 * rather than a permanent literal: it can be overridden via the
 * CENSUS_BENCHMARK env var, and src/geocoding/census.js reconfirms it
 * against the live /benchmarks endpoint at startup.
 */
export const DEFAULT_CENSUS_BENCHMARK = 'Public_AR_Current';

/**
 * Medically Underserved Area / Population (MUA/MUP) service. This is a
 * SEPARATE HRSA feature service from HPSA — different MapServer, different
 * schema, and importantly, a different consequence: MUA/MUP status does
 * NOT trigger the CMS 10% Medicare bonus the way an HPSA designation does.
 * MUA/MUP is instead used for things like FQHC/Section 330 eligibility,
 * Rural Health Clinic eligibility, and National Health Service Corps
 * site eligibility. Keep this informational, not part of bonus math.
 *
 * Verified live against:
 *   https://gisportal.hrsa.gov/server/rest/services/Shortage/MedicallyUnderservedAreas_FS/MapServer
 *   https://gisportal.hrsa.gov/server/rest/services/Shortage/MedicallyUnderservedAreas_FS/MapServer/0
 */
export const MUA_MAPSERVER_BASE =
  'https://gisportal.hrsa.gov/server/rest/services/Shortage/MedicallyUnderservedAreas_FS/MapServer';

/** The one perimeter-polygon layer covering both MUA and MUP designations. */
export const MUA_LAYER_ID = 0;

/** Verified live fields for the MUA/MUP perimeter-polygon layer (Layer 0). */
export const MUA_OUT_FIELDS = Object.freeze([
  'SOURCE_ID',
  'DESIGNATION_DT',
  'DESIGNATION_TYPE_DESCRIPTION',
  'UPDATE_DT',
  'STATUS_CODE',
  'STATUS_DESCRIPTION',
  'SERVICE_AREA_NAME',
  'SERVICE_AREA_TYPE_DESCRIPTION',
  'US_MEXICO_BORDER_100KM_INDICATOR',
  'STATE_FIPS_CODE',
]);

/**
 * Verified live response fields for the perimeter-polygon layers
 * (Section 2.1.1). Confirmed field-by-field against Layer 10's live
 * schema. Field names are IDENTICAL across layers 2/6/10 (same feature
 * service schema), so this single list applies to all three.
 */
export const HPSA_OUT_FIELDS = Object.freeze([
  'HPSA_SOURCE_ID',
  'HPSA_SCORE',
  'HPSA_STATUS_CD',
  'HPSA_STATUS_DESC',
  'HPSA_TYP_CD',
  'HPSA_TYP_DESC',
  'RURAL_STATUS_CD',
  'RURAL_STATUS_DESC',
  'HPSA_DESIGNATION_DT',
  'HPSA_WITHDRAWAL_DT',
  'HPSA_POPULATION_TYP_CD',
  'HPSA_POPULATION_TYP_DESC',
  'DISCIPLINE_CLASS_DESC',
  'PRIMARY_STATE_NM',
  'PRIMARY_STATE_FIPS_CD',
]);

/**
 * HPSA_STATUS_DESC value treated as currently eligible (Section 5.5).
 * Anything else (e.g. "Proposed for Withdrawal") is treated as not
 * currently eligible. Confirm this string against live data before
 * relying on it for production billing decisions — HRSA has not
 * published a fixed enum contract for this field.
 */
export const ELIGIBLE_STATUS_DESC = 'Designated';

/**
 * MUA/MUP STATUS_DESCRIPTION value treated as currently active. Assumed
 * to mirror the HPSA layer's "Designated" convention since both come from
 * the same HRSA Shortage Designation Management System, but this has NOT
 * been sampled against live MUA data the way HPSA's was — confirm with a
 * live query before relying on it for eligibility decisions.
 */
export const MUA_ELIGIBLE_STATUS_DESC = 'Designated';

/**
 * CMS bonus rules (Section 2.3 / 4.3).
 */
export const CMS_BONUS_RATE = 0.10; // 10% of the amount Medicare actually pays

/**
 * The "payment factor" (allowed-charge-to-paid-amount ratio) is explicitly
 * NOT an official CMS-published constant — it's a planning approximation.
 * Keep it user-configurable (env var or UI input), default to 1.0 (i.e.,
 * "treat the input amount as already the paid amount") so the app never
 * silently invents a multiplier.
 */
export const DEFAULT_PAYMENT_FACTOR = Number(
  (typeof process !== 'undefined' && process.env && process.env.DEFAULT_PAYMENT_FACTOR) || 1.0
);

/**
 * J-1 Visa Waiver (Conrad 30 / HHS program) related constants.
 *
 * IMPORTANT SCOPE NOTE: Conrad 30 program rules vary by state and change
 * annually (federal fiscal year), with no live, structured, HRSA-hosted
 * API the way HPSA/MUA data has. This app deliberately does NOT attempt
 * to encode each state's specific rules (score cutoffs, Medicaid-percent
 * requirements, specialty priority, slot availability) — that data isn't
 * available in a form that can be kept reliably current. Instead:
 *   - We check the one federal-level constant that IS stable and
 *     verifiable: the HHS J-1 Visa Waiver Program's HPSA score >= 7
 *     threshold (a separate, unlimited-slot program from Conrad 30).
 *   - We route the user to HRSA's own live-maintained directory of state
 *     Primary Care Offices for anything state-specific, rather than
 *     hardcoding 50 individual URLs that would go stale over time.
 */

/**
 * Minimum HPSA score required for the separate, federally-run HHS J-1
 * Visa Waiver Program (primary care / general psychiatry only, unlimited
 * slots — distinct from the 30-slot state Conrad 30 programs). Verified
 * against multiple state Primary Care Office program manuals and the
 * Rural Health Information Hub's J-1 waiver overview.
 */
export const HHS_J1_PROGRAM_MIN_HPSA_SCORE = 7;

/**
 * HRSA's own, live-maintained directory of every state/territory Primary
 * Care Office (the office that administers each state's Conrad 30
 * program). Used as the single link-out destination for all states
 * instead of hardcoding individual state program URLs, since HRSA keeps
 * this page current and we cannot reliably do the same for 50+ pages.
 */
export const HRSA_STATE_PCO_DIRECTORY_URL =
  'https://bhw.hrsa.gov/workforce-shortage-areas/shortage-designation/contact-state-primary-care-office';
