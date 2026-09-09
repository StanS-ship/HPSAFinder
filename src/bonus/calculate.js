import { CMS_BONUS_RATE, DEFAULT_PAYMENT_FACTOR } from '../config/hrsaConfig.js';

/**
 * Calculate the CMS HPSA bonus (Section 2.3 / 4.3 / 7.5).
 *
 * CMS pays a 10% bonus on the amount Medicare actually PAYS for eligible
 * physician professional services (PC/TC indicators 0,1,2,4,6,8) rendered
 * in a geographic HPSA — not on the Medicare-approved/allowed amount, and
 * not based on patient residence or the physician's home office location.
 *
 * The "payment factor" here is an explicit, user-configurable estimate of
 * the allowed-charge-to-paid-amount ratio, in case the user only knows
 * their allowed charges rather than what Medicare actually pays. It is
 * NOT an official CMS constant — do not hardcode a "typical" value as if
 * it were authoritative. Default is 1.0, meaning "treat the input as
 * already the paid amount" (no adjustment).
 *
 * @param {number} annualPaidAmount - estimated annual amount Medicare
 *   actually pays for eligible services (or allowed charges, if
 *   paymentFactor is used to convert).
 * @param {object} [options]
 * @param {number} [options.paymentFactor] - configurable multiplier applied
 *   to annualPaidAmount before computing the bonus. Defaults to
 *   DEFAULT_PAYMENT_FACTOR (1.0 unless overridden via env/config).
 * @param {boolean} [options.bothDisciplines] - true if the location is both
 *   a primary-care and mental-health HPSA; CMS pays only ONE 10% bonus per
 *   service in that case (Section 5.3), so this does not change the math,
 *   only the annotation the caller should show.
 * @returns {{
 *   adjustedPaidAmount: number,
 *   annualBonus: number,
 *   quarterlyBonus: number,
 *   bonusRate: number,
 *   paymentFactorUsed: number,
 *   note: string | null
 * }}
 */
export function calculateBonus(annualPaidAmount, options = {}) {
  const { paymentFactor = DEFAULT_PAYMENT_FACTOR, bothDisciplines = false } = options;

  if (typeof annualPaidAmount !== 'number' || Number.isNaN(annualPaidAmount) || annualPaidAmount < 0) {
    throw new Error('annualPaidAmount must be a non-negative number.');
  }
  if (typeof paymentFactor !== 'number' || Number.isNaN(paymentFactor) || paymentFactor <= 0) {
    throw new Error('paymentFactor must be a positive number.');
  }

  const adjustedPaidAmount = annualPaidAmount * paymentFactor;
  const annualBonus = adjustedPaidAmount * CMS_BONUS_RATE;
  const quarterlyBonus = annualBonus / 4;

  return {
    adjustedPaidAmount,
    annualBonus,
    quarterlyBonus,
    bonusRate: CMS_BONUS_RATE,
    paymentFactorUsed: paymentFactor,
    note: bothDisciplines
      ? 'CMS pays only one 10% bonus per service even if the area is both a primary-care and mental-health HPSA.'
      : null,
  };
}
