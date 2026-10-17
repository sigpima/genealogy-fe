export type MemberStatus = 'living' | 'deceased' | 'unknown';

export const LIVING_MAX_AGE_YEARS = 100;

export function memberStatus(
  birth: number | null,
  death: number | null,
  currentYear: number = new Date().getFullYear()
): MemberStatus {
  if (death !== null) return 'deceased';
  if (birth === null) return 'unknown';
  return currentYear - birth <= LIVING_MAX_AGE_YEARS ? 'living' : 'unknown';
}

export function lifespanLabel(
  birth: number | null,
  death: number | null,
  currentYear: number = new Date().getFullYear()
): string | null {
  if (birth === null && death === null) return null;
  const status = memberStatus(birth, death, currentYear);
  if (status === 'living') return `${birth} – nay`;
  return `${birth ?? '?'} – ${death ?? '?'}`;
}
