/**
 * Ids for public venue visits, mirroring firestore.rules:
 *  - document id = sha256(uid_day_slot)  → max 3 visits per UTC day
 *  - pid         = sha256(uid|venueId)   → per-venue pseudonym
 */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export const visitDocId = (uid: string, day: number, slot: number) => sha256Hex(`${uid}_${day}_${slot}`);
export const venuePlayerId = (uid: string, venueId: string) => sha256Hex(`${uid}|${venueId}`);
