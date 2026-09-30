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

let names: Intl.DisplayNames | null = null;

/** Localised country name (falls back to the code). */
export function countryName(code: string, locale = 'de'): string {
  try {
    names ??= new Intl.DisplayNames([locale], { type: 'region' });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Codes sorted by their localised name. */
export function sortedCountries(): { code: string; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
