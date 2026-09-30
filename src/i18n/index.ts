import { createElement, Fragment, useSyncExternalStore, type ReactNode } from 'react';
import { getLocale, interpolate, subscribeLocale, template, fmtNumber, type Key, type Locale } from './locale';

export {
  t, getLocale, setLocale, subscribeLocale, detectLocale,
  fmtNumber, fmtPercent, fmtDate, percentSuffix, collator, intlLocale,
  LOCALES, LOCALE_NAMES, LOCALE_STORAGE_KEY,
} from './locale';
export type { Key, Locale, Params, Messages } from './locale';

/** Current locale; the component re-renders when it changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

/**
 * Like `t`, but placeholders may be React nodes (links, <strong>, …):
 * `tr('venue.rules', { beer: <strong>{name}</strong> })`.
 */
export function tr(key: Key, params: Record<string, ReactNode>): ReactNode {
  const count = typeof params.count === 'number' ? params.count : undefined;
  const parts = interpolate<ReactNode>(template(key, count), params, (v) => (typeof v === 'number' ? fmtNumber(v) : v));
  return createElement(Fragment, null, ...parts);
}
