/**
 * Splits an amount typed by the user (gross) into what the platform keeps (commission) and what is really ours (net).
 * Minor units in, minor units out. Wysper keeps 15 %: 25.00 typed -> 3.75 commission -> 21.25 counted as our gain.
 */
export function applyCommission(grossMinor: number, percent: number) {
  const safe = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const commissionMinor = Math.round((grossMinor * safe) / 100);
  return { grossMinor, commissionMinor, netMinor: grossMinor - commissionMinor, percent: safe };
}
