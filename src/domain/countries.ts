import { collator, getLocale } from '../i18n/locale';

/** Flag emoji for an ISO 3166-1 alpha-2 code ("DE" → 🇩🇪). */
export function countryFlag(code: string | undefined): string {
  if (!code || !/^[A-Z]{2}$/.test(code)) return '🌍';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Every country with a notable beer scene; the picker shows them by name. */
export const COUNTRY_CODES = [
  'AR', 'AT', 'AU', 'BE', 'BR', 'CA', 'CH', 'CL', 'CN', 'CO', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB',
  'GR', 'HR', 'HU', 'ID', 'IE', 'IN', 'IS', 'IT', 'JM', 'JP', 'KE', 'KR', 'LT', 'LU', 'LV', 'MX', 'NG', 'NL',
  'NO', 'NZ', 'PE', 'PH', 'PL', 'PT', 'RO', 'RS', 'SE', 'SG', 'SI', 'SK', 'TH', 'TR', 'UA', 'US', 'VN', 'ZA',
];

const names = new Map<string, Intl.DisplayNames>();

/** Country name in the UI language (falls back to the code). */
export function countryName(code: string, locale: string = getLocale()): string {
  try {
    let dn = names.get(locale);
    if (!dn) names.set(locale, dn = new Intl.DisplayNames([locale], { type: 'region' }));
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Codes sorted by their name in the UI language. */
export function sortedCountries(): { code: string; name: string }[] {
  const { compare } = collator();
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => compare(a.name, b.name));
}
