import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMuaAttributes, isCurrentlyDesignatedMua } from '../src/mua/query.js';

const rawMuaFeature = {
  SOURCE_ID: '9876543210',
  DESIGNATION_DT: '2023-05-01',
  DESIGNATION_TYPE_DESCRIPTION: 'Medically Underserved Area',
  UPDATE_DT: '2023-05-01',
  STATUS_CODE: 'D',
  STATUS_DESCRIPTION: 'Designated',
  SERVICE_AREA_NAME: 'Example County',
  SERVICE_AREA_TYPE_DESCRIPTION: 'Whole County',
  US_MEXICO_BORDER_100KM_INDICATOR: 'N',
  STATE_FIPS_CODE: '20',
};

test('parses raw MUA/MUP ArcGIS attributes into the normalized shape', () => {
  const parsed = parseMuaAttributes(rawMuaFeature);
  assert.equal(parsed.source_id, '9876543210');
  assert.equal(parsed.service_area_name, 'Example County');
  assert.equal(parsed.designation_type_desc, 'Medically Underserved Area');
});

test('treats "Designated" status as currently active for MUA/MUP', () => {
  const parsed = parseMuaAttributes(rawMuaFeature);
  assert.equal(isCurrentlyDesignatedMua(parsed), true);
});

test('treats a non-"Designated" status as not currently active for MUA/MUP', () => {
  const parsed = parseMuaAttributes({ ...rawMuaFeature, STATUS_DESCRIPTION: 'Withdrawn' });
  assert.equal(isCurrentlyDesignatedMua(parsed), false);
});

test('handles missing/null fields gracefully', () => {
  const parsed = parseMuaAttributes({});
  assert.equal(parsed.source_id, null);
  assert.equal(parsed.status_desc, null);
  assert.equal(isCurrentlyDesignatedMua(parsed), false);
});
