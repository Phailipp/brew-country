/**
 * Ids for public venue visits, mirroring firestore.rules. `secret` is the
 * player's random salt from their private profile, never the uid:
 *  - document id = sha256(secret_day_slot) → max 2 visits per UTC day
 *  - pid         = sha256(secret|venueId|week) → per-venue, per-week pseudonym
 */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export const visitDocId = (secret: string, day: number, slot: number) => sha256Hex(`${secret}_${day}_${slot}`);
/** Weekly pseudonym: countable per week, never a long-term regular's profile. */
export const venuePlayerId = (secret: string, venueId: string, week: number) => sha256Hex(`${secret}|${venueId}|${week}`);

/** Week number as the rules compute it: floor((utcDay + 3) / 7), weeks start Monday. */
export const utcWeek = (ms: number) => Math.floor((Math.floor(ms / 86_400_000) + 3) / 7);

/** Public visits are deleted by a Firestore TTL policy after this (scoring uses 30 days). */
export const PUBLIC_VISIT_TTL_MS = 35 * 86_400_000;

/** 256 random bits as 64 lowercase hex chars. */
export function newVisitSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Public visit times are rounded down to the hour. */
export const hourFloor = (ms: number) => Math.floor(ms / 3_600_000) * 3_600_000;
