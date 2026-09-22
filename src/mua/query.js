import { MUA_MAPSERVER_BASE, MUA_LAYER_ID, MUA_OUT_FIELDS, MUA_ELIGIBLE_STATUS_DESC } from '../config/hrsaConfig.js';

/**
 * @typedef {object} MuaAttributes
 * @property {string|null} source_id
 * @property {string|null} designation_dt
 * @property {string|null} designation_type_desc
 * @property {string|null} update_dt
 * @property {string|null} status_cd
 * @property {string|null} status_desc
 * @property {string|null} service_area_name
 * @property {string|null} service_area_type_desc
 * @property {string|null} us_mexico_border_100km_indicator
 * @property {string|null} state_fips_cd
 */

/**
 * Query the MUA/MUP perimeter-polygon layer (Layer 0) with a point.
 * Public, read-only ArcGIS REST service — no token/auth required, same
 * as the HPSA layers.
 *
 * IMPORTANT: an MUA/MUP designation is informational for this app — it
 * does NOT trigger the CMS 10% Medicare bonus the way an HPSA
 * designation does. Do not feed its result into the bonus calculator.
 *
 * @param {number} lon
 * @param {number} lat
 * @returns {Promise<MuaAttributes[]>} parsed features (may be empty)
 */
export async function queryMuaLayer(lon, lat) {
  const url = new URL(`${MUA_MAPSERVER_BASE}/${MUA_LAYER_ID}/query`);
  url.searchParams.set('f', 'json');
  url.searchParams.set('geometryType', 'esriGeometryPoint');
  url.searchParams.set('geometry', `${lon},${lat}`);
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('where', '1=1');
  url.searchParams.set('outFields', MUA_OUT_FIELDS.join(','));
  url.searchParams.set('returnGeometry', 'false');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`HRSA MUA MapServer query returned HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`HRSA MUA MapServer query error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const features = data.features ?? [];
  return features.map((f) => parseMuaAttributes(f.attributes));
}

/**
 * Normalize a raw ArcGIS attributes object into the shape used throughout
 * the app, matching the live-verified MUA/MUP layer schema.
 *
 * @param {object} attrs - raw `attributes` object from an ArcGIS feature
 * @returns {MuaAttributes}
 */
export function parseMuaAttributes(attrs) {
  return {
    source_id: attrs.SOURCE_ID ?? null,
    designation_dt: attrs.DESIGNATION_DT ?? null,
    designation_type_desc: attrs.DESIGNATION_TYPE_DESCRIPTION ?? null,
    update_dt: attrs.UPDATE_DT ?? null,
    status_cd: attrs.STATUS_CODE ?? null,
    status_desc: attrs.STATUS_DESCRIPTION ?? null,
    service_area_name: attrs.SERVICE_AREA_NAME ?? null,
    service_area_type_desc: attrs.SERVICE_AREA_TYPE_DESCRIPTION ?? null,
    us_mexico_border_100km_indicator: attrs.US_MEXICO_BORDER_100KM_INDICATOR ?? null,
    state_fips_cd: attrs.STATE_FIPS_CODE ?? null,
  };
}

/**
 * Whether a feature represents a currently active MUA/MUP designation.
 *
 * NOTE: this assumes STATUS_DESCRIPTION uses the same "Designated" /
 * withdrawn convention as the HPSA layers (both come from HRSA's shared
 * Shortage Designation Management System), but this has not been
 * confirmed against a live sample the way the HPSA status value was.
 * Re-verify against a real query response before relying on this for
 * anything beyond informational display.
 *
 * @param {MuaAttributes} feature
 * @returns {boolean}
 */
export function isCurrentlyDesignatedMua(feature) {
  return feature.status_desc === MUA_ELIGIBLE_STATUS_DESC;
}

/**
 * Look up MUA/MUP status for a location. Returns ALL intersecting
 * features (a point can fall in both an MUA and a separate MUP, or in
 * more than one overlapping designation at a boundary), each flagged
 * with whether it's currently active.
 *
 * @param {number} lon
 * @param {number} lat
 * @returns {Promise<{isInMua: boolean, activeFeatures: MuaAttributes[], allFeatures: MuaAttributes[]}>}
 */
export async function checkMuaStatus(lon, lat) {
  const allFeatures = await queryMuaLayer(lon, lat);
  const activeFeatures = allFeatures.filter(isCurrentlyDesignatedMua);

  return {
    isInMua: activeFeatures.length > 0,
    activeFeatures,
    allFeatures,
  };
}
