// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, getStoredTheme, setStoredTheme } from './storage';
import { isThemeId } from './themes';

beforeEach(() => {
  window.localStorage.clear();
});

describe('getStoredTheme', () => {
  it('returns the heritage default when nothing is stored', () => {
    expect(getStoredTheme()).toBe('heritage');
  });

  it('keeps a previously chosen theme instead of forcing heritage', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'modern');
    expect(getStoredTheme()).toBe('modern');
  });

  it('returns the stored theme when it is a valid id', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'warm');
    expect(getStoredTheme()).toBe('warm');
  });

  it('falls back to the default when the stored value is invalid', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme');
    expect(getStoredTheme()).toBe('heritage');
  });
});

describe('setStoredTheme', () => {
  it('persists the theme id for later retrieval', () => {
    setStoredTheme('elegant');
    expect(getStoredTheme()).toBe('elegant');
  });
});

describe('isThemeId', () => {
  it('accepts heritage and rejects unknown ids', () => {
    expect(isThemeId('heritage')).toBe(true);
    expect(isThemeId('nope')).toBe(false);
    expect(isThemeId(null)).toBe(false);
  });
});
