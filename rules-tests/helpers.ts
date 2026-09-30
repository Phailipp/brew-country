import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, type Firestore } from 'firebase/firestore';

export const PROJECT_ID = 'demo-brew';
export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;

export const BEER = 'augustiner-hell';
export const OTHER_BEER = 'tegernseer-hell';

// Munich (exact home) — only ever stored in the private profile
export const HOME_LAT = 48.137;
export const HOME_LON = 11.575;

export async function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
}

/** Verified user (email_verified: true). */
export function userDb(env: RulesTestEnvironment, uid: string): Firestore {
  return env.authenticatedContext(uid, { email_verified: true }).firestore() as unknown as Firestore;
}
/** Signed in, but email not verified. */
export function unverifiedDb(env: RulesTestEnvironment, uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}
export function adminDb(env: RulesTestEnvironment, uid = 'admin'): Firestore {
  return env.authenticatedContext(uid, { email_verified: true, admin: true }).firestore() as unknown as Firestore;
}
export function anonDb(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

/** Seed data bypassing the rules. */
export async function seed(
  env: RulesTestEnvironment,
  fn: (db: Firestore) => Promise<unknown>,
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore() as unknown as Firestore);
  });
}

/** request.time.date() == UTC midnight of today. */
export function todayUtc(): Timestamp {
  const d = new Date();
  return Timestamp.fromMillis(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export const round50 = (x: number) => Math.round(x * 50) / 50; // 0.02° lattice
export const round200 = (x: number) => Math.round(x * 200) / 200; // 0.005° lattice

export function privateProfile(uid: string, over: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: uid,
    email: `${uid}@example.com`,
    nickname: uid,
    createdAt: now,
    lastActiveAt: now,
    homeLat: HOME_LAT,
    homeLon: HOME_LON,
    beerId: BEER,
    standYourGroundEnabled: true,
    ageVerified: true,
    ...over,
  };
}
