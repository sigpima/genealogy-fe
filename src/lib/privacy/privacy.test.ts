import { describe, expect, it } from 'vitest';
import { changedLevels, FIELDS, publicNeedsPublicTree } from './privacy';

describe('privacy levels', () => {
  it('lists every field the API knows', () => {
    expect(FIELDS.map((f) => f.key).sort()).toEqual(['avatar', 'burial', 'email', 'hometown', 'notes', 'phone', 'residence']);
  });
  it('sends only the changed fields', () => {
    expect(changedLevels({ phone: 'member', email: 'member' }, { phone: 'admin', email: 'member' })).toEqual({ phone: 'admin' });
    expect(changedLevels({ phone: 'member' }, { phone: 'member' })).toEqual({});
  });
  it('warns that "public" does nothing on a private tree', () => {
    expect(publicNeedsPublicTree({ phone: 'public' }, 'private')).toContain('số điện thoại');
    expect(publicNeedsPublicTree({ phone: 'public' }, 'public')).toBeNull();
    expect(publicNeedsPublicTree({ phone: 'member' }, 'private')).toBeNull();
  });
});
