/** Shared, role-neutral timing rules. Penalty amounts and restrictions are policy settings. */
export type CancellationBand = 'Free' | 'Late' | 'VeryLate';
export type ArrivalBand = 'Grace' | 'Late' | 'Decision' | 'NoShowEligible';
const minute = 60_000;
const hour = 60 * minute;
export function cancellationBand(startsAt: Date, at: Date): CancellationBand {
  const remaining = startsAt.getTime() - at.getTime();
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error('Cancellations must occur before the appointment starts');
  if (remaining > 24 * hour) return 'Free';
  if (remaining < 2 * hour) return 'VeryLate';
  return 'Late';
}
export function arrivalBand(startsAt: Date, at: Date, communicated: boolean): ArrivalBand {
  const late = at.getTime() - startsAt.getTime();
  if (!Number.isFinite(late)) throw new Error('Invalid appointment time');
  if (late <= 10 * minute) return 'Grace';
  if (late < 15 * minute) return 'Late';
  if (late <= 30 * minute || communicated) return 'Decision';
  return 'NoShowEligible';
}
