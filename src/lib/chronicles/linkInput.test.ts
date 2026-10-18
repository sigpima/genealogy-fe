import { describe, expect, it } from 'vitest';
import { normaliseLinkInput } from './linkInput';

describe('normaliseLinkInput', () => {
  it('adds https:// to a bare address', () => {
    expect(normaliseLinkInput('example.com')).toBe('https://example.com');
    expect(normaliseLinkInput('  www.gia-pha.vn/su-ky ')).toBe('https://www.gia-pha.vn/su-ky');
  });
  it('keeps http, https, mailto and site paths', () => {
    expect(normaliseLinkInput('http://a.example')).toBe('http://a.example');
    expect(normaliseLinkInput('https://a.example/x?y=1')).toBe('https://a.example/x?y=1');
    expect(normaliseLinkInput('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(normaliseLinkInput('/su-ky/abc')).toBe('/su-ky/abc');
  });
  it('turns an e-mail address into a mailto link', () => {
    expect(normaliseLinkInput('a@b.com')).toBe('mailto:a@b.com');
  });
  it('refuses anything that could run code or is empty', () => {
    expect(normaliseLinkInput('javascript:alert(1)')).toBeNull();
    expect(normaliseLinkInput('JaVaScRiPt:alert(1)')).toBeNull();
    expect(normaliseLinkInput('data:text/html,<b>')).toBeNull();
    expect(normaliseLinkInput('//evil.example')).toBeNull();
    expect(normaliseLinkInput('')).toBeNull();
    expect(normaliseLinkInput('   ')).toBeNull();
    expect(normaliseLinkInput('two words')).toBeNull();
  });
});
