import {
  HRSA_MAPSERVER_BASE,
  HPSA_LAYER_IDS,
  HPSA_OUT_FIELDS,
  ELIGIBLE_STATUS_DESC,
} from '../config/hrsaConfig.js';

/**
 * @typedef {object} HpsaAttributes
 * @property {string} hpsa_source_id
 * @property {string} hpsa_typ_desc
 * @property {number} hpsa_score
 * @property {string} hpsa_status_desc
 * @property {string} rural_status_desc
 * @property {string|null} population_typ_cd
 * @property {string} discipline_class_desc
 * @property {string} designation_dt
 * @property {string|null} withdrawal_dt
 */

/**
 * Query one HPSA perimeter-polygon layer with a point (Section 2.1.1).
 * No token/auth required — this is a public, read-only ArcGIS REST service
 * (Section 3.1).
 *
 * @param {number} layerId - one of HPSA_LAYER_IDS' values (2, 6, or 10)
 * @param {number} lon
 * @param {number} lat
 * @returns {Promise<HpsaAttributes[]>} parsed features (may be empty)
 */
export async function queryHpsaLayer(layerId, lon, lat) {
  const url = new URL(`${HRSA_MAPSERVER_BASE}/${layerId}/query`);
  url.searchParams.set('f', 'json');
  url.searchParams.set('geometryType', 'esriGeometryPoint');
  url.searchParams.set('geometry', `${lon},${lat}`);
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('where', '1=1');
  url.searchParams.set('outFields', HPSA_OUT_FIELDS.join(','));
  url.searchParams.set('returnGeometry', 'false');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`HRSA MapServer layer ${layerId} query returned HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`HRSA MapServer layer ${layerId} query error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const features = data.features ?? [];

  return features.map((f) => parseHpsaAttributes(f.attributes));
}

/**
 * Normalize a raw ArcGIS attributes object into the shape used throughout
 * the app. Keeps the verified live field names (Section 2.1.1) as the
 * single source of truth for parsing.
 *
 * @param {object} attrs - raw `attributes` object from an ArcGIS feature
 * @returns {HpsaAttributes}
 */
export function parseHpsaAttributes(attrs) {
  return {
    hpsa_source_id: attrs.HPSA_SOURCE_ID ?? null,
    hpsa_typ_cd: attrs.HPSA_TYP_CD ?? null,
    hpsa_typ_desc: attrs.HPSA_TYP_DESC ?? null,
    hpsa_score: attrs.HPSA_SCORE ?? null,
    hpsa_status_cd: attrs.HPSA_STATUS_CD ?? null,
    hpsa_status_desc: attrs.HPSA_STATUS_DESC ?? null,
    rural_status_cd: attrs.RURAL_STATUS_CD ?? null,
    rural_status_desc: attrs.RURAL_STATUS_DESC ?? null,
    population_typ_cd: attrs.HPSA_POPULATION_TYP_CD ?? null,
    population_typ_desc: attrs.HPSA_POPULATION_TYP_DESC ?? null,
    discipline_class_desc: attrs.DISCIPLINE_CLASS_DESC ?? null,
    designation_dt: attrs.HPSA_DESIGNATION_DT ?? null,
    withdrawal_dt: attrs.HPSA_WITHDRAWAL_DT ?? null,
    primary_state_nm: attrs.PRIMARY_STATE_NM ?? null,
    primary_state_fips_cd: attrs.PRIMARY_STATE_FIPS_CD ?? null,
  };
}

/**
 * A feature counts as a "geographic HPSA" for CMS bonus purposes when its
 * population-type code is null/blank (Section 5.1). Population-group and
 * facility designations are explicitly out of scope for the physician
 * bonus. Confirm against live sampling before relying on this in
 * production — HRSA has not published this as a fixed contract.
 *
 * @param {HpsaAttributes} feature
 * @returns {boolean}
 */
export function isGeographicHpsa(feature) {
  return feature.population_typ_cd === null || feature.population_typ_cd === '';
}

/**
 * A feature is currently eligible only if its status description matches
 * the live "active/designated" value (Section 5.5). Anything else (e.g.
 * "Proposed for Withdrawal") is not currently eligible.
 *
 * @param {HpsaAttributes} feature
 * @returns {boolean}
 */
export function isCurrentlyDesignated(feature) {
  return feature.hpsa_status_desc === ELIGIBLE_STATUS_DESC;
}

/**
 * Query ALL THREE HPSA disciplines (primary care, mental health, dental)
 * for a location, regardless of specialty. Used by the J-1 waiver
 * eligibility check (Section: J-1 baseline), where any active geographic
 * HPSA — of any discipline — counts toward the federal baseline
 * requirement, unlike the Medicare bonus which is specialty-specific.
 *
 * @param {number} lon
 * @param {number} lat
 * @returns {Promise<{discipline: string, layerId: number, eligibleFeatures: HpsaAttributes[]}[]>}
 */
export async function queryAllHpsaDisciplines(lon, lat) {
  const disciplines = Object.keys(HPSA_LAYER_IDS); // primary_care, mental_health, dental

  const results = await Promise.all(
    disciplines.map(async (discipline) => {
      const layerId = HPSA_LAYER_IDS[discipline];
      const allFeatures = await queryHpsaLayer(layerId, lon, lat);
      const eligibleFeatures = allFeatures.filter((f) => isGeographicHpsa(f) && isCurrentlyDesignated(f));
      return { discipline, layerId, eligibleFeatures };
    })
  );

  return results;
}

/**
 * Given a specialty, run the correct layer query/queries and return only
 * the features that are geographic + currently designated (Section 5.1,
 * 5.3, 5.5). If a location happens to intersect more than one polygon in
 * the layer (rare, but possible at boundary edges), all qualifying
 * features are returned — the bonus calculator only needs to know "is
 * this location HPSA-eligible for this discipline," not how many
 * overlapping polygons exist.
 *
 * @param {'physician'|'psychiatrist'|'dentist'} specialty
 * @param {number} lon
 * @param {number} lat
 * @returns {Promise<{layerId: number, discipline: string, eligibleFeatures: HpsaAttributes[], allFeatures: HpsaAttributes[]}>}
 */
export async function queryHpsaForSpecialty(specialty, lon, lat) {
  const disciplineByLayerName = {
    physician: 'primary_care',
    psychiatrist: 'mental_health',
    dentist: 'dental',
  };

  const discipline = disciplineByLayerName[specialty];
  if (!discipline) {
    throw new Error(`Unknown specialty "${specialty}". Expected one of: ${Object.keys(disciplineByLayerName).join(', ')}`);
  }

  const layerId = HPSA_LAYER_IDS[discipline];
  const allFeatures = await queryHpsaLayer(layerId, lon, lat);
  const eligibleFeatures = allFeatures.filter((f) => isGeographicHpsa(f) && isCurrentlyDesignated(f));

  return { layerId, discipline, eligibleFeatures, allFeatures };
}
