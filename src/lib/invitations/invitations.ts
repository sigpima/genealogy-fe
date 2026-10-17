export type RsvpResponse = 'yes' | 'no' | 'maybe';

export const RESPONSE_LABELS: Record<RsvpResponse, string> = {
  yes: 'Tham dự',
  no: 'Không tham dự được',
  maybe: 'Chưa chắc',
};

export type PublicCard = {
  family: string;
  title: string;
  kind: string | null;
  date: string;
  lunar: { day: number; month: number; year: number; leap: boolean };
  time_text: string | null;
  message: string | null;
  place: { name: string; address: string | null; latitude: number | null; longitude: number | null } | null;
  closed: boolean;
  totals: { yes: number; people: number };
  guest: { name: string; response: RsvpResponse | null; party_size: number; note: string | null } | null;
};

export type RespondResult = PublicCard & { token: string };

export type Counts = { yes: number; no: number; maybe: number; pending: number; people: number };

export type Rsvp = {
  id: number;
  name: string;
  response: RsvpResponse | null;
  party_size: number;
  note: string | null;
  personal_token: string;
  path: string;
  responded_at: string | null;
};

export type Card = {
  id: number;
  event_id: number;
  event_title: string;
  date: string;
  token: string;
  path: string;
  message: string | null;
  closes_on: string | null;
  closed: boolean;
  expired: boolean;
  counts: Counts;
};

export type CardDetail = Card & { responses: Rsvp[] };

/** Where a browser keeps the personal token of the answer it gave through an open link, so the guest can change it later. */
export function storageKey(openToken: string): string {
  return `gia-pha:thiep:${openToken}`;
}

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** "Thứ hai, 07/04/2025". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function lunarLine(lunar: PublicCard['lunar']): string {
  return `Tức ngày ${lunar.day} tháng ${lunar.month}${lunar.leap ? ' (nhuận)' : ''} năm ${lunar.year} âm lịch`;
}

/** "Đã có 12 người xác nhận tham dự" / "Hãy là người đầu tiên xác nhận". */
export function totalsLine(totals: PublicCard['totals']): string {
  if (totals.yes === 0) return 'Chưa có ai xác nhận. Bạn là người đầu tiên?';
  return `Đã có ${totals.yes} lượt xác nhận, tổng ${totals.people} người tham dự`;
}

export type AnswerResult =
  | { ok: true; body: { name?: string; response: RsvpResponse; party_size?: number; note: string | null } }
  | { ok: false; error: string };

/** Check the answer form like the API will. `needName` is true on the open link. */
export function answerPayload(form: { name: string; response: RsvpResponse | ''; partySize: string; note: string }, needName: boolean): AnswerResult {
  if (needName && !form.name.trim()) return { ok: false, error: 'Hãy cho biết tên của bạn.' };
  if (form.name.trim().length > 150) return { ok: false, error: 'Tên quá dài.' };
  if (form.response === '') return { ok: false, error: 'Hãy chọn tham dự, không tham dự hoặc chưa chắc.' };
  let party: number | undefined;
  if (form.response === 'yes') {
    party = Number(form.partySize);
    if (!Number.isInteger(party) || party < 1 || party > 20) return { ok: false, error: 'Số người phải từ 1 đến 20.' };
  }
  if (form.note.length > 500) return { ok: false, error: 'Lời nhắn tối đa 500 ký tự.' };
  return {
    ok: true,
    body: {
      ...(needName ? { name: form.name.trim() } : {}),
      response: form.response,
      ...(party !== undefined ? { party_size: party } : {}),
      note: form.note.trim() || null,
    },
  };
}

export function invitationErrorMessage(status: number): string {
  if (status === 404) return 'Không tìm thấy thiệp mời này. Có thể đường dẫn đã sai hoặc thiệp đã bị thu hồi.';
  if (status === 409) return 'Thiệp mời này đã đóng hoặc đã nhận đủ số trả lời.';
  if (status === 422) return 'Thông tin chưa hợp lệ. Hãy kiểm tra tên, số người và lời nhắn.';
  return 'Không gửi được. Vui lòng thử lại.';
}

/** "3 tham dự (8 người) · 1 không · 2 chưa chắc · 4 chưa trả lời" for the admin's card header. */
export function countsLine(c: Counts): string {
  return [`${c.yes} tham dự (${c.people} người)`, `${c.no} không`, `${c.maybe} chưa chắc`, `${c.pending} chưa trả lời`].join(' · ');
}

/** One name per line / comma -> a clean list (blank lines dropped, repeats removed). */
export function parseNames(text: string): string[] {
  return [...new Set(text.split(/[\n;,]+/).map((n) => n.trim()).filter(Boolean))];
}

export function fullLink(origin: string, path: string): string {
  return `${origin}${path}`;
}
