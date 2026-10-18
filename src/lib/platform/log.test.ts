import { describe, expect, it, vi } from 'vitest';
import { buildEventsQuery, eventDetail, platformActionLabel, type PlatformEvent } from './log';
import { enterFamily } from './trees';

const event = (action: string, details: PlatformEvent['details'] = null): PlatformEvent => ({
  id: 1, action, actor_name: 'Root', tree_id: 3, tree_name: 'Họ A', details, created_at: '2026-10-18T08:00:00+07:00',
});

describe('platform log labels', () => {
  it('names every action the console writes', () => {
    for (const a of ['tree.create', 'tree.update', 'tree.pause', 'tree.resume', 'tree.delete', 'admin.create', 'admin.promote', 'admin.update', 'admin.password_reset', 'support.enter']) {
      expect(platformActionLabel(a)).not.toBe(a);
    }
    expect(platformActionLabel('something.new')).toBe('something.new');
  });
  it('turns details into one readable line', () => {
    expect(eventDetail(event('tree.update', { changes: { name: ['Họ A', 'Họ B'] } }))).toBe('Tên: Họ A → Họ B');
    expect(eventDetail(event('admin.create', { email: 'a@x.vn' }))).toBe('a@x.vn');
    expect(eventDetail(event('admin.update', { email: 'a@x.vn', changes: { status: ['active', 'disabled'] } }))).toBe('a@x.vn · Trạng thái: active → disabled');
    expect(eventDetail(event('tree.delete', { slug: 'ho-a', members: 12, users: 3, media: 2, files: 5 }))).toBe('ho-a · 12 người, 3 tài khoản, 5 file');
    expect(eventDetail(event('support.enter'))).toBe('');
  });
});

describe('buildEventsQuery', () => {
  it('pages and adds only the filters that are set', () => {
    expect(buildEventsQuery({}, 0)).toBe('limit=50&offset=0');
    expect(buildEventsQuery({ action: 'tree.', treeId: 3, since: '2026-10-01', until: '2026-10-18' }, 50)).toBe('limit=50&offset=50&action=tree.&tree_id=3&since=2026-10-01&until=2026-10-18');
    expect(buildEventsQuery({ action: '', treeId: null }, 0)).toBe('limit=50&offset=0');
  });
});

describe('enterFamily', () => {
  it('logs the entry first and only then sets the acting-tree cookie', async () => {
    const order: string[] = [];
    const fetchFn = vi.fn(async () => { order.push('log'); return new Response(null, { status: 204 }); });
    const setCookie = vi.fn(() => order.push('cookie'));
    expect(await enterFamily(7, { fetchFn: fetchFn as unknown as typeof fetch, setCookie })).toBe(true);
    expect(order).toEqual(['log', 'cookie']);
    expect(fetchFn).toHaveBeenCalledWith('/api/trees/7/support', { method: 'POST', credentials: 'include' });
    expect(setCookie).toHaveBeenCalledWith('acting_tree=7; Path=/; Max-Age=31536000; SameSite=Lax');
  });
  it('does not switch when the entry could not be logged', async () => {
    const setCookie = vi.fn();
    expect(await enterFamily(7, { fetchFn: (async () => new Response(null, { status: 500 })) as unknown as typeof fetch, setCookie })).toBe(false);
    expect(await enterFamily(7, { fetchFn: (async () => { throw new Error('offline'); }) as unknown as typeof fetch, setCookie })).toBe(false);
    expect(setCookie).not.toHaveBeenCalled();
  });
});
