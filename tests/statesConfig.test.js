import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupStateByFips, STATE_FIPS_TO_INFO } from '../src/config/statesConfig.js';

test('looks up a state by 2-digit FIPS code', () => {
  assert.deepEqual(lookupStateByFips('20'), { name: 'Kansas', abbr: 'KS' });
});

test('tolerates a single-digit FIPS code by zero-padding', () => {
  assert.deepEqual(lookupStateByFips('6'), { name: 'California', abbr: 'CA' });
});

test('tolerates a numeric (not string) FIPS code', () => {
  assert.deepEqual(lookupStateByFips(48), { name: 'Texas', abbr: 'TX' });
});

test('returns null for null/undefined input', () => {
  assert.equal(lookupStateByFips(null), null);
  assert.equal(lookupStateByFips(undefined), null);
});

test('returns null for an unrecognized FIPS code', () => {
  assert.equal(lookupStateByFips('99'), null);
});

test('table covers all 50 states plus DC', () => {
  const names = Object.values(STATE_FIPS_TO_INFO).map((s) => s.name);
  assert.ok(names.includes('District of Columbia'));
  // 50 states + DC + Puerto Rico in this table
  assert.equal(names.length, 52);
});
