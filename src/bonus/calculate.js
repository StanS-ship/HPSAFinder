import { CMS_BONUS_RATE } from '../config/hrsaConfig.js';
import { DUAL_DISCIPLINE_NOTE } from '../consent/disclaimerText.js';

/**
 * Calculate the CMS HPSA bonus (Section 2.3 / 4.3 / 7.5).
 *
 * CMS pays a 10% bonus on the amount Medicare actually PAYS for eligible
 * physician professional services (PC/TC indicators 0,1,2,4,6,8) rendered
 * in a geographic HPSA — not on the Medicare-approved/allowed amount, and
 * not based on patient residence or the physician's home office location.
 *
 * The "paidToAllowedRatio" is an explicit, user-configurable estimate of
 * the allowed-charge-to-paid-amount ratio, in case the user only knows
 * their allowed charges rather than what Medicare actually pays. It is
 * NOT an official CMS constant — do not hardcode a "typical" value as if
 * it were authoritative. Default is 1.0, meaning "treat the input as
 * already the paid amount" (no adjustment).
 *
 * @param {number} annualPaidAmount - estimated annual amount Medicare
 *   actually pays for eligible services (or allowed charges, if
 *   paidToAllowedRatio is used to convert).
 * @param {object} [options]
 * @param {number} [options.paidToAllowedRatio] - configurable multiplier applied
 *   to annualPaidAmount before computing the bonus. Defaults to 1.0.
 * @param {boolean} [options.bothDisciplines] - true if the location is both
 *   a primary-care and mental-health HPSA; CMS pays only ONE 10% bonus per
 *   service in that case (Section 5.3), so this does not change the math,
 *   only the annotation the caller should show.
 * @returns {{
 *   adjustedPaidAmount: number,
 *   annualBonus: number,
 *   quarterlyBonus: number,
 *   bonusRate: number,
 *   paidToAllowedRatioUsed: number,
 *   note: string | null
 * }}
 */
export function calculateBonus(annualPaidAmount, options = {}) {
  const { paidToAllowedRatio = 1.0, bothDisciplines = false } = options;

  if (typeof annualPaidAmount !== 'number' || Number.isNaN(annualPaidAmount) || annualPaidAmount < 0) {
    throw new Error('annualPaidAmount must be a non-negative number.');
  }
  if (typeof paidToAllowedRatio !== 'number' || Number.isNaN(paidToAllowedRatio) || paidToAllowedRatio <= 0) {
    throw new Error('paidToAllowedRatio must be a positive number.');
  }

  const adjustedPaidAmount = annualPaidAmount * paidToAllowedRatio;
  const annualBonus = adjustedPaidAmount * CMS_BONUS_RATE;
  const quarterlyBonus = annualBonus / 4;

  return {
    adjustedPaidAmount,
    annualBonus,
    quarterlyBonus,
    bonusRate: CMS_BONUS_RATE,
    paidToAllowedRatioUsed: paidToAllowedRatio,
    note: bothDisciplines ? DUAL_DISCIPLINE_NOTE : null,
  };
}
