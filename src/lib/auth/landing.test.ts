import { describe, expect, it } from 'vitest';
import { landingPath } from './landing';

describe('landingPath', () => {
  it('sends a superadmin with no family yet to the platform console', () => {
    expect(landingPath({ role: 'superadmin' }, 0)).toBe('/he-thong');
  });
  it('keeps a superadmin with families on the tree', () => {
    expect(landingPath({ role: 'superadmin' }, 2)).toBe('/');
  });
  it('sends nobody to the login page when there is no user', () => {
    expect(landingPath(null, 0)).toBe('/login');
    expect(landingPath(null, null)).toBe('/login');
  });
  it('treats an unknown count as "stay"', () => {
    expect(landingPath({ role: 'superadmin' }, null)).toBe('/');
  });
  it('leaves admins and members on the tree', () => {
    expect(landingPath({ role: 'admin' }, 0)).toBe('/');
    expect(landingPath({ role: 'member' }, 1)).toBe('/');
  });
});
