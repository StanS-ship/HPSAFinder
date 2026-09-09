import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBonus } from '../src/bonus/calculate.js';

test('calculates 10% annual bonus and quarterly split with default payment factor', () => {
  const result = calculateBonus(100000);
  assert.equal(result.annualBonus, 10000);
  assert.equal(result.quarterlyBonus, 2500);
  assert.equal(result.bonusRate, 0.10);
  assert.equal(result.paymentFactorUsed, 1.0);
  assert.equal(result.note, null);
});

test('applies a custom payment factor before computing the bonus', () => {
  const result = calculateBonus(100000, { paymentFactor: 0.8 });
  assert.equal(result.adjustedPaidAmount, 80000);
  assert.equal(result.annualBonus, 8000);
  assert.equal(result.quarterlyBonus, 2000);
});

test('attaches the dual-discipline note when bothDisciplines is true', () => {
  const result = calculateBonus(50000, { bothDisciplines: true });
  assert.match(result.note, /only one 10% bonus/);
});

test('rejects negative amounts', () => {
  assert.throws(() => calculateBonus(-1));
});

test('rejects non-positive payment factors', () => {
  assert.throws(() => calculateBonus(1000, { paymentFactor: 0 }));
});
