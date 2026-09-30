import { de } from './de';
import { en } from './en';

/**
 * Framework-free i18n core: current locale, message lookup and Intl formatters.
 * Domain code may import this (no React); components use `./index`.
 */

export type Locale = 'de' | 'en';
export const LOCALES: readonly Locale[] = ['de', 'en'];
/** Endonyms for the language switcher: always shown in their own language. */
export const LOCALE_NAMES: Record<Locale, string> = { de: 'Deutsch', en: 'English' };
export const LOCALE_STORAGE_KEY = 'bc_locale';

export interface Plural { readonly one: string; readonly other: string }

/** Same shape as `de`, but every text is a plain string (what `en` must satisfy). */
export type Messages<T = typeof de> = { -readonly [K in keyof T]: T[K] extends string ? string : Messages<T[K]> };

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Plural ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>
}[keyof T & string];

/** Every translatable text, as a dot path ("venue.checkIn"). */
export type Key = Leaves<typeof de>;
export type Params = Record<string, string | number>;

const CATALOG: Record<Locale, Messages> = { de, en };

// ── Detection & state ────────────────────────────────────────────────
const asLocale = (v: string | null | undefined): Locale | null =>
  v === 'de' || v === 'en' ? v : null;

/**
 * Start language: the saved choice, else the first German or English entry
 * of the browser languages ("de*" → German), else English.
 */
export function detectLocale(stored: string | null | undefined, languages: readonly string[] | undefined): Locale {
  const saved = asLocale(stored);
  if (saved) return saved;
  for (const lang of languages ?? []) {
    const l = lang.toLowerCase();
    if (l === 'de' || l.startsWith('de-')) return 'de';
    if (l === 'en' || l.startsWith('en-')) return 'en';
  }
  return 'en';
}

function readStored(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
  } catch {
    return null; // storage blocked
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages?.length) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

function applyDocumentLang(l: Locale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

let current: Locale = detectLocale(readStored(), browserLanguages());
applyDocumentLang(current);

const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function setLocale(l: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, l);
  } catch {
    // storage blocked: the choice lasts for this session
  }
  if (l === current) return;
  current = l;
  applyDocumentLang(l);
  listeners.forEach((fn) => fn());
}

export function subscribeLocale(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// ── Lookup ───────────────────────────────────────────────────────────
function lookup(locale: Locale, key: string): string | Plural | undefined {
  let node: unknown = CATALOG[locale];
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || (node && typeof node === 'object' && 'other' in node) ? node as string | Plural : undefined;
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

/** The raw template for a key (plural form chosen by `count`). */
export function template(key: Key, count?: number, locale: Locale = current): string {
  const entry = lookup(locale, key) ?? lookup('de', key);
  if (entry === undefined) return key;
  if (typeof entry === 'string') return entry;
  let rules = pluralRules.get(locale);
  if (!rules) pluralRules.set(locale, rules = new Intl.PluralRules(locale));
  return rules.select(count ?? 0) === 'one' ? entry.one : entry.other;
}

/** Split a template into text and `{name}` placeholders. */
export function interpolate<T>(tpl: string, params: Record<string, T>, fmt: (v: T) => string | T): (string | T)[] {
  const out: (string | T)[] = [];
  let last = 0;
  for (const m of tpl.matchAll(/\{(\w+)\}/g)) {
    if (!(m[1] in params)) continue;
    if (m.index > last) out.push(tpl.slice(last, m.index));
    out.push(fmt(params[m[1]]));
    last = m.index + m[0].length;
  }
  if (last < tpl.length) out.push(tpl.slice(last));
  return out;
}

/**
 * Translate a key. `{name}` placeholders take `params`; numbers are
 * formatted for the locale. Plural entries (`{ one, other }`) pick their
 * form by `params.count`.
 */
export function t(key: Key, params?: Params): string {
  const count = typeof params?.count === 'number' ? params.count : undefined;
  const tpl = template(key, count);
  if (!params) return tpl;
  return interpolate<string | number>(tpl, params, (v) => (typeof v === 'number' ? fmtNumber(v) : v)).join('');
}

// ── Formatters ───────────────────────────────────────────────────────
/** BCP 47 tag used for Intl. */
export function intlLocale(l: Locale = current): string {
  return l === 'de' ? 'de-DE' : 'en-GB';
}

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const id = `${current}|${JSON.stringify(opts)}`;
  let f = numberFormats.get(id);
  if (!f) numberFormats.set(id, f = new Intl.NumberFormat(intlLocale(), opts));
  return f;
}

/** "1.234,5" / "1,234.5" (at most one decimal unless asked otherwise). */
export function fmtNumber(n: number, opts: Intl.NumberFormatOptions = { maximumFractionDigits: 1 }): string {
  return numberFormat(opts).format(n);
}

/** Ratio 0..1 → "42 %" / "42%". */
export function fmtPercent(ratio: number, maximumFractionDigits = 0): string {
  return numberFormat({ style: 'percent', maximumFractionDigits }).format(ratio);
}

/** What follows the number in a percentage (" %" in German, "%" in English). */
export function percentSuffix(): string {
  return fmtPercent(0).replace(/^0/, '');
}

const collators = new Map<Locale, Intl.Collator>();

/** Locale-aware string comparison: `list.sort(collator().compare)`. */
export function collator(): Intl.Collator {
  let c = collators.get(current);
  if (!c) collators.set(current, c = new Intl.Collator(intlLocale()));
  return c;
}

const timeFormats = new Map<string, Intl.DateTimeFormat>();

/** Date/time in the current locale. */
export function fmtDate(ms: number, opts: Intl.DateTimeFormatOptions): string {
  const id = `${current}|${JSON.stringify(opts)}`;
  let f = timeFormats.get(id);
  if (!f) timeFormats.set(id, f = new Intl.DateTimeFormat(intlLocale(), opts));
  return f.format(ms);
}
