export type PartialDate = {
  year: number | null;
  month: number | null;
  day: number | null;
  isLunar: boolean;
  leapMonth: boolean;
};

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * "15/08/1945", "08/1945", "15/08", "1945"; a month or day known without a year is fine (a giỗ only
 * needs the lunar day and month). The calendar only matters once a month is known, so a bare year
 * carries no suffix; lunar dates get " âm lịch" and, for a leap month, " (tháng nhuận)".
 */
export function formatPartialDate({ year, month, day, isLunar, leapMonth }: PartialDate): string | null {
  if (year === null && month === null && day === null) return null;
  if (month === null && day === null) return String(year);
  const parts: string[] = [];
  if (day !== null) parts.push(pad(day));
  if (month !== null) parts.push(pad(month));
  if (year !== null) parts.push(String(year));
  let text = parts.join('/');
  if (month !== null && isLunar) {
    text += ' âm lịch';
    if (leapMonth) text += ' (tháng nhuận)';
  }
  return text;
}

/** True when there is more than a bare year to show (so the full date deserves its own row). */
export function hasDayOrMonth(date: Pick<PartialDate, 'month' | 'day'>): boolean {
  return date.month !== null || date.day !== null;
}

/** Days in a month for the form's day input: lunar months have at most 30 days, solar ones vary. */
export function maxDayFor(month: number | null, isLunar: boolean, year: number | null): number {
  if (month === null) return 31;
  if (isLunar) return 30;
  if (month === 2 && year !== null && year >= 1 && !isLeapYear(year)) return 28;
  return new Date(Date.UTC(2000, month, 0)).getUTCDate(); // 2000 is a leap year: Feb -> 29
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
