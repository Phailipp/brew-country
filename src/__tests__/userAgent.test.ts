import { describe, expect, it } from 'vitest';
import { coarseUserAgent } from '../domain/userAgent';
import { HOWTO_HASH, legalDocFromHash } from '../legal/docs';

describe('coarseUserAgent', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', 'Safari 17 / iOS 17'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36', 'Chrome 124 / Android 14'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.67', 'Edge 124 / Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0', 'Firefox 125 / macOS'],
    ['something odd', 'other / other'],
  ])('%s', (ua, expected) => {
    expect(coarseUserAgent(ua)).toBe(expected);
  });

  it('drops build numbers and device models', () => {
    const r = coarseUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36');
    expect(r).toBe('SamsungBrowser 24 / Android 14');
    expect(r).not.toMatch(/SM-S918B|\d+\.\d+/);
  });
});

describe('overlay hashes', () => {
  it('never capture app routes', () => {
    for (const h of ['#brauerei', '#admin', '', '#']) {
      expect(legalDocFromHash(h)).toBeNull();
      expect(h).not.toBe(HOWTO_HASH);
    }
    expect(legalDocFromHash('#datenschutz')).toBe('datenschutz');
  });
});
