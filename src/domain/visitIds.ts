/**
 * Ids for public venue visits, mirroring firestore.rules. `secret` is the
 * player's random salt from their private profile, never the uid:
 *  - document id = sha256(secret_day_slot) → max 2 visits per UTC day
 *  - pid         = sha256(secret|venueId)  → per-venue pseudonym
 */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export const visitDocId = (secret: string, day: number, slot: number) => sha256Hex(`${secret}_${day}_${slot}`);
export const venuePlayerId = (secret: string, venueId: string) => sha256Hex(`${secret}|${venueId}`);

/** 256 random bits as 64 lowercase hex chars. */
export function newVisitSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Public visit times are rounded down to the hour. */
export const hourFloor = (ms: number) => Math.floor(ms / 3_600_000) * 3_600_000;
