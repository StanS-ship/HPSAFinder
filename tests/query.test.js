import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHpsaAttributes, isGeographicHpsa, isCurrentlyDesignated } from '../src/hpsa/query.js';

const rawFeature = {
  HPSA_SOURCE_ID: '1234567890',
  HPSA_TYP_CD: '1',
  HPSA_TYP_DESC: 'Geographic HPSA',
  HPSA_SCORE: 18,
  HPSA_STATUS_CD: 'D',
  HPSA_STATUS_DESC: 'Designated',
  RURAL_STATUS_CD: 'R',
  RURAL_STATUS_DESC: 'Rural',
  HPSA_DESIGNATION_DT: '2024-01-01',
  HPSA_WITHDRAWAL_DT: null,
  HPSA_POPULATION_TYP_CD: null,
  DISCIPLINE_CLASS_DESC: 'Primary Care',
  PRIMARY_STATE_NM: 'Kansas',
  PRIMARY_STATE_FIPS_CD: '20',
};

test('parses raw ArcGIS attributes into the normalized shape', () => {
  const parsed = parseHpsaAttributes(rawFeature);
  assert.equal(parsed.hpsa_source_id, '1234567890');
  assert.equal(parsed.hpsa_status_desc, 'Designated');
  assert.equal(parsed.population_typ_cd, null);
});

test('treats a null population_typ_cd as a geographic HPSA', () => {
  const parsed = parseHpsaAttributes(rawFeature);
  assert.equal(isGeographicHpsa(parsed), true);
});

test('treats a populated population_typ_cd as NOT a geographic HPSA', () => {
  const parsed = parseHpsaAttributes({ ...rawFeature, HPSA_POPULATION_TYP_CD: 'LI' });
  assert.equal(isGeographicHpsa(parsed), false);
});

test('treats "Designated" status as currently eligible', () => {
  const parsed = parseHpsaAttributes(rawFeature);
  assert.equal(isCurrentlyDesignated(parsed), true);
});

test('treats non-"Designated" status as not currently eligible', () => {
  const parsed = parseHpsaAttributes({ ...rawFeature, HPSA_STATUS_DESC: 'Proposed for Withdrawal' });
  assert.equal(isCurrentlyDesignated(parsed), false);
});
