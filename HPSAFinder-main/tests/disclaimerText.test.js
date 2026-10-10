import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTcpaConsent, NON_AFFILIATION_DISCLAIMER, FULL_PARTIAL_COUNTY_DISCLAIMER } from '../src/consent/disclaimerText.js';

test('renders TCPA consent text with the named agency substituted', () => {
  const text = renderTcpaConsent('Example Health System');
  assert.match(text, /Example Health System may contact me/);
  assert.match(text, /not required to consent/);
});

test('throws if no agency name is provided', () => {
  assert.throws(() => renderTcpaConsent(''));
});

test('non-affiliation disclaimer matches the brief verbatim', () => {
  assert.equal(
    NON_AFFILIATION_DISCLAIMER,
    "This calculator is an independent tool and is not affiliated with or endorsed by HRSA or CMS. Bonus eligibility and payment are determined solely by CMS based on official Medicare rules and HRSA's shortage-area designations. Always verify your eligibility and exact bonus amounts using official CMS and HRSA resources before making billing or contractual decisions."
  );
});

test('full/partial-county disclaimer matches the brief verbatim', () => {
  assert.equal(
    FULL_PARTIAL_COUNTY_DISCLAIMER,
    "This tool identifies whether your location falls within a designated HPSA. Some ZIP codes split across full- and partial-county HPSA boundaries may require an AQ modifier on claims. Verify your exact billing requirements with your MAC or CMS's published bonus ZIP code list."
  );
});
