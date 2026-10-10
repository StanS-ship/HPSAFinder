import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONRAD30_PROGRAM_PAGES,
  CONRAD30_LINKS_LAST_VERIFIED,
  getConrad30ProgramLink,
} from '../src/config/conrad30Config.js';
import { STATE_FIPS_TO_INFO } from '../src/config/statesConfig.js';
import { HRSA_STATE_PCO_DIRECTORY_URL } from '../src/config/hrsaConfig.js';

const NO_STATE_PAGE = ['OH', 'PR'];

test('every state + DC (except documented fallbacks) has an https program page', () => {
  for (const { abbr } of Object.values(STATE_FIPS_TO_INFO)) {
    if (NO_STATE_PAGE.includes(abbr)) continue;
    const entry = CONRAD30_PROGRAM_PAGES[abbr];
    assert.ok(entry, `missing Conrad 30 page for ${abbr}`);
    assert.match(entry.url, /^https:\/\//, `${abbr} url must be https`);
    assert.ok(entry.agency, `${abbr} needs an agency name`);
  }
  assert.equal(Object.keys(CONRAD30_PROGRAM_PAGES).length, 50);
});

test('documented fallback states have no entry', () => {
  for (const abbr of NO_STATE_PAGE) assert.equal(CONRAD30_PROGRAM_PAGES[abbr], undefined);
});

test('looks up by abbreviation', () => {
  const link = getConrad30ProgramLink({ name: 'Texas', abbr: 'TX' }, STATE_FIPS_TO_INFO);
  assert.equal(link.isStateSpecific, true);
  assert.equal(link.url, CONRAD30_PROGRAM_PAGES.TX.url);
});

test('looks up by name when only a name is available (HPSA layer case)', () => {
  const link = getConrad30ProgramLink({ name: 'kansas', abbr: null }, STATE_FIPS_TO_INFO);
  assert.equal(link.url, CONRAD30_PROGRAM_PAGES.KS.url);
});

test('Ohio falls back to the HRSA directory', () => {
  const link = getConrad30ProgramLink({ name: 'Ohio', abbr: 'OH' }, STATE_FIPS_TO_INFO);
  assert.equal(link.isStateSpecific, false);
  assert.equal(link.url, HRSA_STATE_PCO_DIRECTORY_URL);
});

test('null or unknown state falls back to the HRSA directory', () => {
  assert.equal(getConrad30ProgramLink(null).url, HRSA_STATE_PCO_DIRECTORY_URL);
  assert.equal(getConrad30ProgramLink({ name: 'Atlantis', abbr: null }, STATE_FIPS_TO_INFO).isStateSpecific, false);
});

test('last-verified date is a valid ISO date', () => {
  assert.match(CONRAD30_LINKS_LAST_VERIFIED, /^\d{4}-\d{2}-\d{2}$/);
});
