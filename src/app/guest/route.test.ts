import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /guest', () => {
  it('remembers the demo family for this browser and goes to the home page', async () => {
    const res = await GET();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/'); // relative on purpose: behind a proxy the request's own origin is not the public one
    expect(res.headers.get('set-cookie')).toBe('tree_slug=demo; Path=/; Max-Age=31536000; SameSite=Lax');
  });
});
