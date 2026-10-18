import { describe, expect, it } from 'vitest';
import { actionLabel } from '../requests/requests';
import { buildAuditQuery, KIND_LABELS, kindOfAction } from './audit';

describe('audit labels', () => {
  it('names every action the admin console writes', () => {
    for (const action of ['user.create', 'user.update', 'user.approve', 'user.password_reset', 'security.login_failed', 'security.locked', 'settings.update', 'privacy.update', 'calendar.enable', 'calendar.regenerate', 'calendar.disable', 'data.export', 'book.export']) {
      expect(actionLabel(action)).not.toBe(action);
    }
    expect(actionLabel('security.locked')).toMatch(/khoá/);
  });
  it('names every action the API can write (so the admin never reads "card.create")', () => {
    const all = [
      'member.create', 'member.update', 'member.delete', 'member.split', 'member.avatar', 'marriage.create', 'marriage.update',
      'branch.create', 'branch.update', 'branch.delete', 'request.approve', 'request.reject', 'article.create', 'article.update', 'article.delete',
      'timeline.create', 'timeline.update', 'timeline.delete', 'poem.update', 'event.create', 'event.update', 'event.delete',
      'card.create', 'card.update', 'card.delete', 'place.create', 'place.update', 'place.delete', 'place.migrate',
      'media.upload', 'media.update', 'media.delete',
    ];
    expect(all.filter((a) => actionLabel(a) === a)).toEqual([]);
  });
  it('labels the four kinds', () => {
    expect(Object.keys(KIND_LABELS)).toEqual(['data', 'people', 'security', 'settings']);
  });
  it('tells which kind an action belongs to (for the security rows to stand out)', () => {
    expect(kindOfAction('security.login_failed')).toBe('security');
    expect(kindOfAction('user.update')).toBe('people');
    expect(kindOfAction('privacy.update')).toBe('settings');
    expect(kindOfAction('calendar.regenerate')).toBe('settings');
    expect(kindOfAction('member.create')).toBe('data');
  });
});

describe('buildAuditQuery', () => {
  it('always pages, and only adds the filters that are set', () => {
    expect(buildAuditQuery({}, 0)).toBe('limit=50&offset=0');
    expect(buildAuditQuery({ kind: 'security', since: '2026-10-01', until: '2026-10-18', memberId: 7 }, 50)).toBe(
      'limit=50&offset=50&member_id=7&kind=security&since=2026-10-01&until=2026-10-18',
    );
    expect(buildAuditQuery({ kind: '' }, 0)).toBe('limit=50&offset=0');
  });
});
