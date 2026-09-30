/**
 * Brew Country is an adult game about beer. Minimum age per country:
 * the legal drinking age where it is above 18, otherwise 18.
 * The birthdate is only checked, never stored (data minimisation).
 */
const DRINKING_AGE_ABOVE_18: Record<string, number> = { US: 21, IN: 21, KR: 19, JP: 20, TH: 20, IS: 20 };

export function minimumAge(country: string | null | undefined): number {
  return (country && DRINKING_AGE_ABOVE_18[country]) || 18;
}

/** Full years between an ISO date (YYYY-MM-DD) and `now`; null if invalid or in the future. */
export function ageInYears(isoDate: string, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const birth = new Date(Date.UTC(y, mo - 1, d));
  if (birth.getUTCMonth() !== mo - 1 || birth.getUTCDate() !== d || y < 1900) return null;
  let age = now.getUTCFullYear() - y;
  const beforeBirthday = now.getUTCMonth() < mo - 1 || (now.getUTCMonth() === mo - 1 && now.getUTCDate() < d);
  if (beforeBirthday) age--;
  return age < 0 ? null : age;
}
