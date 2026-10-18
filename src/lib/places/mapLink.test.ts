import { describe, expect, it } from 'vitest';
import { fallbackMapHref, linkCoordinates, looksLikeMapLink, mapHrefFor } from './mapLink';

describe('looksLikeMapLink', () => {
  it.each([
    'https://www.google.com/maps/place/Ha+Noi/@21.0285,105.8542,15z',
    'https://maps.app.goo.gl/AbCd123',
    'https://goo.gl/maps/xyz',
    '  https://maps.google.com/?q=21,105  ',
    'HTTPS://WWW.GOOGLE.COM/maps/x',
  ])('accepts %s', (url) => expect(looksLikeMapLink(url)).toBe(true));

  it.each([
    'http://www.google.com/maps',
    'javascript:alert(1)',
    'https://evil.com/maps',
    'https://google.com.evil.com/maps',
    'https://google.com@evil.com/',
    'https://goo.gl/other',
    'www.google.com/maps',
    'hello',
  ])('refuses %s', (url) => expect(looksLikeMapLink(url)).toBe(false));

  it('treats blank as fine (no link)', () => {
    expect(looksLikeMapLink('')).toBe(true);
    expect(looksLikeMapLink('   ')).toBe(true);
  });
});

describe('fallbackMapHref', () => {
  it('builds a Maps link for an old coordinate-only row', () => {
    expect(fallbackMapHref(21.5, 105.5)).toBe('https://www.google.com/maps?q=21.5,105.5');
  });
  it('is null without both numbers', () => {
    expect(fallbackMapHref(null, 1)).toBeNull();
    expect(fallbackMapHref(1, null)).toBeNull();
  });
});

describe('mapHrefFor', () => {
  it('prefers the saved link, then the coordinates', () => {
    expect(mapHrefFor('https://maps.app.goo.gl/x', 1, 2)).toBe('https://maps.app.goo.gl/x');
    expect(mapHrefFor(null, 1, 2)).toBe('https://www.google.com/maps?q=1,2');
    expect(mapHrefFor(null, null, null)).toBeNull();
  });
});

describe('linkCoordinates', () => {
  it('reads a position out of the usual Google Maps forms (the API does the same)', () => {
    expect(linkCoordinates('https://www.google.com/maps/place/Ha+Noi/@21.0285,105.8542,15z')).toEqual([21.0285, 105.8542]);
    expect(linkCoordinates('https://www.google.com/maps/place/x/data=!3d10.5!4d106.25')).toEqual([10.5, 106.25]);
    expect(linkCoordinates('https://maps.google.com/?q=21.03,105.85')).toEqual([21.03, 105.85]);
    expect(linkCoordinates('https://maps.google.com/?ll=-33.86,151.21&z=10')).toEqual([-33.86, 151.21]);
    expect(linkCoordinates('https://www.google.com/maps/place/21.5,105.5')).toEqual([21.5, 105.5]);
  });
  it('is null for a short link, no numbers, or out-of-range numbers', () => {
    expect(linkCoordinates('https://maps.app.goo.gl/AbCd123')).toBeNull();
    expect(linkCoordinates('https://www.google.com/maps/place/Ha+Noi')).toBeNull();
    expect(linkCoordinates('https://www.google.com/maps/@95.0,10.0,15z')).toBeNull();
    expect(linkCoordinates('')).toBeNull();
  });
});
