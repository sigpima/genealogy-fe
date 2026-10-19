import { describe, expect, it } from 'vitest';
import { buildUsersQuery, lastLoginLabel } from './users';

const now = new Date('2026-10-18T12:00:00+07:00');

describe('lastLoginLabel', () => {
  it('says "Chưa ghi nhận" when there is no value (old accounts included)', () => {
    expect(lastLoginLabel(null, now)).toBe('Chưa ghi nhận');
  });
  it('uses relative words for the last days and a date after that', () => {
    expect(lastLoginLabel('2026-10-18T08:00:00+07:00', now)).toBe('Hôm nay');
    expect(lastLoginLabel('2026-10-17T20:00:00+07:00', now)).toBe('Hôm qua');
    expect(lastLoginLabel('2026-10-15T09:00:00+07:00', now)).toBe('3 ngày trước');
    expect(lastLoginLabel('2026-09-01T09:00:00+07:00', now)).toBe('01/09/2026');
  });
});

describe('buildUsersQuery', () => {
  it('leaves blank filters out', () => {
    expect(buildUsersQuery({ q: '  ', status: '', role: '' })).toBe('');
    expect(buildUsersQuery({ q: ' Nguyễn ', status: 'pending', role: '' })).toBe('q=Nguy%E1%BB%85n&status=pending');
  });
});
