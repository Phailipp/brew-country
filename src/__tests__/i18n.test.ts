import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import {
  t, setLocale, getLocale, subscribeLocale, detectLocale,
  fmtNumber, fmtPercent, percentSuffix, collator, LOCALE_STORAGE_KEY,
} from '../i18n/locale';

/** Every leaf path of a message tree ("venue.kind.pub", "common.points.one", …). */
function paths(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  return Object.entries(node as Record<string, unknown>)
    .flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k))
    .sort();
}

describe('i18n catalogue', () => {
  it('has exactly the same keys in English as in German', () => {
    expect(paths(en)).toEqual(paths(de));
  });

  it('keeps the same placeholders in both languages', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const leaf = (root: unknown, p: string) => p.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown>)[k], root) as string;
    for (const p of paths(de)) {
      expect(vars(leaf(en, p)), p).toEqual(vars(leaf(de, p)));
    }
  });

  it('has no empty texts', () => {
    const leaf = (root: unknown, p: string) => p.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown>)[k], root) as string;
    for (const p of paths(en)) expect(leaf(en, p).trim(), p).not.toBe('');
  });
});

describe('t()', () => {
  afterEach(() => setLocale('de'));

  it('interpolates placeholders', () => {
    setLocale('de');
    expect(t('venue.tooFar', { distance: 120, radius: 60 }))
      .toBe('Du bist 120 m entfernt. Einchecken geht nur vor Ort (max. 60 m).');
    setLocale('en');
    expect(t('venue.tooFar', { distance: 120, radius: 60 }))
      .toBe('You’re 120 m away. You can only check in on site (max. 60 m).');
  });

  it('formats numeric placeholders for the locale', () => {
    setLocale('de');
    expect(t('sim.onMap', { count: 1234 })).toBe('1.234 Demo-Stimmen auf der Karte');
    setLocale('en');
    expect(t('sim.onMap', { count: 1234 })).toBe('1,234 demo votes on the map');
  });

  it('picks the plural form in German', () => {
    setLocale('de');
    expect(t('common.points', { count: 1 })).toBe('1 Punkt');
    expect(t('common.points', { count: 3 })).toBe('3 Punkte');
    expect(t('common.points', { count: 2.5 })).toBe('2,5 Punkte');
    expect(t('weekly.daysLeft', { count: 1 })).toBe('noch 1 Tag');
    expect(t('weekly.daysLeft', { count: 0 })).toBe('noch 0 Tage');
  });

  it('picks the plural form in English', () => {
    setLocale('en');
    expect(t('common.points', { count: 1 })).toBe('1 point');
    expect(t('common.points', { count: 3 })).toBe('3 points');
    expect(t('common.points', { count: 2.5 })).toBe('2.5 points');
    expect(t('map.playersOnline', { count: 1 })).toBe('1 player online');
    expect(t('map.playersOnline', { count: 7 })).toBe('7 players online');
  });

  it('leaves unknown placeholders alone and returns plain texts as is', () => {
    setLocale('de');
    expect(t('passport.title')).toBe('Dein Bierpass');
    expect(t('finder.rules', {})).toBe('{beer} regiert');
  });
});

describe('locale state', () => {
  afterEach(() => setLocale('de'));

  it('persists the choice, sets <html lang> and notifies subscribers', () => {
    const seen: string[] = [];
    const off = subscribeLocale(() => seen.push(getLocale()));
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    setLocale('en'); // no change, no event
    setLocale('de');
    off();
    setLocale('en');
    expect(seen).toEqual(['en', 'de']);
  });

  it('survives blocked storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => setLocale('en')).not.toThrow();
    expect(getLocale()).toBe('en');
    spy.mockRestore();
  });
});

describe('start language', () => {
  it('prefers the saved choice', () => {
    expect(detectLocale('en', ['de-DE'])).toBe('en');
    expect(detectLocale('de', ['en-US'])).toBe('de');
  });

  it('falls back to navigator.languages: de* is German, English otherwise', () => {
    expect(detectLocale(null, ['de-AT', 'en'])).toBe('de');
    expect(detectLocale(null, ['de'])).toBe('de');
    expect(detectLocale(null, ['en-US', 'de-DE'])).toBe('en');
    expect(detectLocale(null, ['fr-FR', 'de-CH'])).toBe('de');
    expect(detectLocale(null, ['fr-FR', 'es'])).toBe('en');
    expect(detectLocale('xx', ['dex'])).toBe('en');
    expect(detectLocale(null, [])).toBe('en');
    expect(detectLocale(null, undefined)).toBe('en');
  });

  describe('on module load', () => {
    let languages: PropertyDescriptor | undefined;
    beforeEach(() => {
      vi.resetModules();
      localStorage.clear();
      languages = Object.getOwnPropertyDescriptor(Navigator.prototype, 'languages');
    });
    afterEach(() => {
      if (languages) Object.defineProperty(Navigator.prototype, 'languages', languages);
      localStorage.clear();
    });
    const withLanguages = (langs: string[]) =>
      Object.defineProperty(Navigator.prototype, 'languages', { configurable: true, get: () => langs });

    it('reads navigator.languages when nothing is saved', async () => {
      withLanguages(['de-DE', 'en']);
      const m = await import('../i18n/locale');
      expect(m.getLocale()).toBe('de');
      expect(document.documentElement.lang).toBe('de');
    });

    it('uses English for other browser languages', async () => {
      withLanguages(['it-IT']);
      const m = await import('../i18n/locale');
      expect(m.getLocale()).toBe('en');
      expect(document.documentElement.lang).toBe('en');
    });

    it('restores the saved language', async () => {
      withLanguages(['de-DE']);
      localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
      const m = await import('../i18n/locale');
      expect(m.getLocale()).toBe('en');
    });
  });
});

describe('formatters', () => {
  afterEach(() => setLocale('de'));

  it('format numbers, percentages and sort by locale', () => {
    setLocale('de');
    expect(fmtNumber(1234.56)).toBe('1.234,6');
    expect(fmtPercent(0.42)).toBe('42 %');
    expect(percentSuffix()).toBe(' %');
    expect(['Zwickel', 'Äpfel', 'Bier'].sort(collator().compare)).toEqual(['Äpfel', 'Bier', 'Zwickel']);
    setLocale('en');
    expect(fmtNumber(1234.56)).toBe('1,234.6');
    expect(fmtPercent(0.42)).toBe('42%');
    expect(percentSuffix()).toBe('%');
  });
});
