export type LunarDate = { day: number; month: number; year: number; leap: boolean };

/** One thing on one day, as `GET /api/calendar/month|upcoming` returns it. */
export type CalendarItem = {
  date: string; // YYYY-MM-DD
  kind: 'death_anniversary' | 'event';
  title: string;
  subtitle: string | null;
  lunar: LunarDate;
  member_id: number | null;
  event_id: number | null;
  years: number | null;
  time_text: string | null;
  location: string | null;
  event_kind: EventKind | null;
  description: string | null;
};

export type CalendarDay = {
  date: string;
  lunar_day: number;
  lunar_month: number;
  lunar_year: number;
  lunar_leap: boolean;
};

export type MonthView = { year: number; month: number; days: CalendarDay[]; items: CalendarItem[]; incomplete: number };

export type EventKind = 'gathering' | 'wedding' | 'birthday' | 'memorial' | 'other';
export type CalendarSystem = 'solar' | 'lunar';

export type FamilyEvent = {
  id: number;
  title: string;
  kind: EventKind;
  calendar: CalendarSystem;
  year: number | null;
  month: number;
  day: number;
  repeats_yearly: boolean;
  time_text: string | null;
  location: string | null;
  description: string | null;
};

export type Subscription = { enabled: boolean; path: string | null };
export type ReminderSettings = { days: number[]; email: boolean };
export const REMINDER_CHOICES = [0, 1, 3, 7, 14, 30] as const;

export type AppNotification = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read: boolean;
};
export type NotificationList = { unread: number; items: AppNotification[] };

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  gathering: 'Họp mặt',
  wedding: 'Cưới hỏi',
  birthday: 'Sinh nhật / mừng thọ',
  memorial: 'Giỗ / tưởng niệm',
  other: 'Khác',
};

export const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** The small lunar label under a day number: the day, and "d/m" on the first of a lunar month ("1/3 nhuận" if leap). */
export function lunarLabel(day: CalendarDay): string {
  if (day.lunar_day !== 1) return String(day.lunar_day);
  return `1/${day.lunar_month}${day.lunar_leap ? 'n' : ''}`;
}

export function monthTitle(year: number, month: number): string {
  return `Tháng ${month} năm ${year}`;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export type GridCell = { day: CalendarDay | null; items: CalendarItem[] };

/** Weeks of 7 cells, Monday first; blanks pad the first and last week. */
export function monthGrid(days: CalendarDay[], items: CalendarItem[]): GridCell[][] {
  if (days.length === 0) return [];
  const byDate = new Map<string, CalendarItem[]>();
  for (const item of items) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);
  const [y, m, d] = days[0].date.split('-').map(Number);
  const leading = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
  const cells: GridCell[] = [
    ...Array.from({ length: leading }, () => ({ day: null, items: [] })),
    ...days.map((day) => ({ day, items: byDate.get(day.date) ?? [] })),
  ];
  while (cells.length % 7 !== 0) cells.push({ day: null, items: [] });
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** "hôm nay", "ngày mai", "3 ngày nữa" for the upcoming list. */
export function relativeDays(date: string, today: string): string {
  const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (diff === 0) return 'hôm nay';
  if (diff === 1) return 'ngày mai';
  if (diff < 0) return `${-diff} ngày trước`;
  return `${diff} ngày nữa`;
}

export function formatDayMonth(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${pad2(d)}/${pad2(m)}`;
}

export function formatFullDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

/** `?ngay=2024-09-17` (from a notification) -> {year, month, date}; anything else -> null. */
export function parseDayParam(search: string): { year: number; month: number; date: string } | null {
  const raw = new URLSearchParams(search).get('ngay');
  const match = raw?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  return { year, month, date: raw! };
}

export function feedUrl(origin: string, path: string): string {
  return `${origin}/api${path}`;
}

export function reminderLabel(days: number): string {
  return days === 0 ? 'Đúng ngày' : days === 1 ? 'Trước 1 ngày' : `Trước ${days} ngày`;
}

// ---------------------------------------------------------------------------------------------------
// The event form

export type EventForm = {
  title: string;
  kind: EventKind;
  calendar: CalendarSystem;
  year: string;
  month: string;
  day: string;
  repeats_yearly: boolean;
  time_text: string;
  location: string;
  description: string;
};

export const EMPTY_EVENT_FORM: EventForm = {
  title: '',
  kind: 'gathering',
  calendar: 'lunar',
  year: '',
  month: '',
  day: '',
  repeats_yearly: true,
  time_text: '',
  location: '',
  description: '',
};

export function eventToForm(event: FamilyEvent): EventForm {
  return {
    title: event.title,
    kind: event.kind,
    calendar: event.calendar,
    year: event.year === null ? '' : String(event.year),
    month: String(event.month),
    day: String(event.day),
    repeats_yearly: event.repeats_yearly,
    time_text: event.time_text ?? '',
    location: event.location ?? '',
    description: event.description ?? '',
  };
}

export type EventPayloadResult = { ok: true; payload: Omit<FamilyEvent, 'id'> } | { ok: false; error: string };

/** Check the form like the API will and turn it into the request body. */
export function eventPayload(form: EventForm): EventPayloadResult {
  const title = form.title.trim();
  if (!title) return { ok: false, error: 'Hãy nhập tên sự kiện.' };
  const month = Number(form.month);
  const day = Number(form.day);
  if (!Number.isInteger(month) || month < 1 || month > 12) return { ok: false, error: 'Tháng phải là số từ 1 đến 12.' };
  const maxDay = form.calendar === 'lunar' ? 30 : 31;
  if (!Number.isInteger(day) || day < 1 || day > maxDay) return { ok: false, error: `Ngày phải là số từ 1 đến ${maxDay}.` };
  let year: number | null = null;
  if (form.year.trim()) {
    year = Number(form.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return { ok: false, error: 'Năm phải nằm trong khoảng 1900–2100.' };
  } else if (!form.repeats_yearly) {
    return { ok: false, error: 'Sự kiện một lần cần có năm.' };
  }
  if (form.calendar === 'solar') {
    const probe = new Date(Date.UTC(year ?? 2000, month - 1, day));
    if (probe.getUTCMonth() !== month - 1) return { ok: false, error: 'Ngày dương lịch này không tồn tại.' };
  }
  const time = form.time_text.trim();
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, error: 'Giờ phải có dạng 08:30.' };
  return {
    ok: true,
    payload: {
      title,
      kind: form.kind,
      calendar: form.calendar,
      year,
      month,
      day,
      repeats_yearly: form.repeats_yearly,
      time_text: time || null,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
    },
  };
}
