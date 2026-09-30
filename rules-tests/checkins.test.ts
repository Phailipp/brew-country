import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  Timestamp, deleteDoc, doc, getDoc, serverTimestamp, setDoc, writeBatch, type Firestore,
} from 'firebase/firestore';
import { BEER, DAY, HOUR, anonDb, createEnv, privateProfile, round200, round50, seed, todayUtc, userDb } from './helpers';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const LAT = round200(48.1372);
const LON = round200(11.5761);

function drinkVote(id: string, userId: string, over: Record<string, unknown> = {}) {
  const createdAt = Date.now();
  return {
    id,
    userId,
    beerId: BEER,
    lat: LAT,
    lon: LON,
    placeKey: `${LAT}_${LON}`,
    createdAt,
    expiresAt: createdAt + DAY,
    gpsAccuracyM: 20,
    proofType: 'gps',
    ...over,
  };
}

/** Check-in batch: stats counter + drink vote, exactly like the client should write it. */
function checkIn(db: Firestore, uid: string, voteId: string, dayCount: number, voteOver: Record<string, unknown> = {}) {
  const b = writeBatch(db);
  b.set(doc(db, 'bc_userStats', uid), { lastDrinkAt: serverTimestamp(), day: todayUtc(), dayCount, lastVoteId: voteId });
  b.set(doc(db, 'bc_drinkVotes', voteId), drinkVote(voteId, uid, voteOver));
  return b.commit();
}

function seedStats(uid: string, data: Record<string, unknown>) {
  return seed(env, (db) => setDoc(doc(db, 'bc_userStats', uid), data));
}

describe('check-in batch (bc_userStats + bc_drinkVotes)', () => {
  it('allows the first check-in (stats create + vote)', async () => {
    await assertSucceeds(checkIn(userDb(env, 'alice'), 'alice', 'v1', 1));
  });
  it('allows a later check-in on the same day (dayCount +1, cooldown over)', async () => {
    await seedStats('alice', { lastDrinkAt: Timestamp.fromMillis(Date.now() - HOUR), day: todayUtc(), dayCount: 3 });
    await assertSucceeds(checkIn(userDb(env, 'alice'), 'alice', 'v2', 4));
  });
  it('allows the first check-in of a new day (dayCount resets to 1)', async () => {
    await seedStats('alice', {
      lastDrinkAt: Timestamp.fromMillis(Date.now() - DAY),
      day: Timestamp.fromMillis(todayUtc().toMillis() - DAY),
      dayCount: 12,
    });
    await assertSucceeds(checkIn(userDb(env, 'alice'), 'alice', 'v3', 1));
  });
  it('denies a drink vote without the stats write', async () => {
    const db = userDb(env, 'alice');
    await assertFails(setDoc(doc(db, 'bc_drinkVotes/v1'), drinkVote('v1', 'alice')));
  });
  it('denies a drink vote alone when old stats exist', async () => {
    await seedStats('alice', { lastDrinkAt: Timestamp.fromMillis(Date.now() - HOUR), day: todayUtc(), dayCount: 1 });
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_drinkVotes/v1'), drinkVote('v1', 'alice')));
  });
  it('denies a second check-in within the 15 min cooldown', async () => {
    await seedStats('alice', { lastDrinkAt: Timestamp.now(), day: todayUtc(), dayCount: 1 });
    await assertFails(checkIn(userDb(env, 'alice'), 'alice', 'v2', 2));
  });
  it('denies two back-to-back check-ins by the same client', async () => {
    const db = userDb(env, 'alice');
    await assertSucceeds(checkIn(db, 'alice', 'v1', 1));
    await assertFails(checkIn(db, 'alice', 'v2', 2));
  });
  it('denies the 13th check-in of the day', async () => {
    await seedStats('alice', { lastDrinkAt: Timestamp.fromMillis(Date.now() - HOUR), day: todayUtc(), dayCount: 12 });
    await assertFails(checkIn(userDb(env, 'alice'), 'alice', 'v13', 13));
  });
  it('denies resetting dayCount on the same day (3 → 1)', async () => {
    await seedStats('alice', { lastDrinkAt: Timestamp.fromMillis(Date.now() - HOUR), day: todayUtc(), dayCount: 3 });
    await assertFails(checkIn(userDb(env, 'alice'), 'alice', 'v4', 1));
  });
  it('denies a wrong day value (yesterday)', async () => {
    const db = userDb(env, 'alice');
    const b = writeBatch(db);
    b.set(doc(db, 'bc_userStats/alice'), {
      lastDrinkAt: serverTimestamp(), day: Timestamp.fromMillis(todayUtc().toMillis() - DAY), dayCount: 1, lastVoteId: 'v1',
    });
    b.set(doc(db, 'bc_drinkVotes/v1'), drinkVote('v1', 'alice'));
    await assertFails(b.commit());
  });
  it('denies a client-chosen lastDrinkAt (not serverTimestamp)', async () => {
    const db = userDb(env, 'alice');
    const b = writeBatch(db);
    b.set(doc(db, 'bc_userStats/alice'), { lastDrinkAt: Timestamp.now(), day: todayUtc(), dayCount: 1, lastVoteId: 'v1' });
    b.set(doc(db, 'bc_drinkVotes/v1'), drinkVote('v1', 'alice'));
    await assertFails(b.commit());
  });
  it('denies writing another user\'s stats', async () => {
    const db = userDb(env, 'alice');
    await assertFails(setDoc(doc(db, 'bc_userStats/bob'), { lastDrinkAt: serverTimestamp(), day: todayUtc(), dayCount: 1 }));
  });
  it('denies a drink vote with a foreign userId', async () => {
    await assertFails(checkIn(userDb(env, 'alice'), 'alice', 'v1', 1, { userId: 'bob' }));
  });
  it('denies a drink vote whose id field differs from the doc id', async () => {
    await assertFails(checkIn(userDb(env, 'alice'), 'alice', 'v1', 1, { id: 'other' }));
  });
  it('denies a wrong expiresAt', async () => {
    const createdAt = Date.now();
    await assertFails(checkIn(userDb(env, 'alice'), 'alice', 'v1', 1, { createdAt, expiresAt: createdAt + 7 * DAY }));
  });
  it('denies unrounded coordinates', async () => {
    await assertFails(checkIn(userDb(env, 'alice'), 'alice', 'v1', 1, { lat: 48.1372, lon: 11.5761 }));
  });
  it('allows check-ins anywhere in the world (Tokio)', async () => {
    await assertSucceeds(checkIn(userDb(env, 'alice'), 'alice', 'v1', 1, { lat: round200(35.6762), lon: round200(139.6503) }));
  });
  it('denies coordinates off the map (beyond ±85°)', async () => {
    await assertFails(checkIn(userDb(env, 'alice'), 'alice', 'v1', 1, { lat: round200(89.5), lon: round200(10) }));
  });
  it('denies poor GPS accuracy (> 75 m)', async () => {
    await assertFails(checkIn(userDb(env, 'alice'), 'alice', 'v1', 1, { gpsAccuracyM: 500 }));
  });
  it('denies a back-dated createdAt', async () => {
    const createdAt = Date.now() - HOUR;
    await assertFails(checkIn(userDb(env, 'alice'), 'alice', 'v1', 1, { createdAt, expiresAt: createdAt + DAY }));
  });
  it('denies unauthenticated check-ins', async () => {
    await assertFails(checkIn(anonDb(env), 'alice', 'v1', 1));
  });
  // Regression: only one stats write is required per batch, so a single batch can carry
  // any number of drink votes — the cooldown/daily cap is bypassed.
  it('denies two drink votes in the same batch', async () => {
    const db = userDb(env, 'alice');
    const b = writeBatch(db);
    b.set(doc(db, 'bc_userStats/alice'), { lastDrinkAt: serverTimestamp(), day: todayUtc(), dayCount: 1, lastVoteId: 'v1' });
    b.set(doc(db, 'bc_drinkVotes/v1'), drinkVote('v1', 'alice'));
    b.set(doc(db, 'bc_drinkVotes/v2'), drinkVote('v2', 'alice'));
    await assertFails(b.commit());
  });
  // Regression: users could delete their own bc_userStats doc, which resets cooldown and
  // daily cap (the next write is a "create" with dayCount 1 and no cooldown check).
  it('denies resetting the rate limit by deleting the own stats doc', async () => {
    await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'), privateProfile('alice')));
    await seedStats('alice', { lastDrinkAt: Timestamp.now(), day: todayUtc(), dayCount: 12 });
    await assertFails(deleteDoc(doc(userDb(env, 'alice'), 'bc_userStats/alice')));
  });
  it('allows deleting the stats together with the own profile (account deletion)', async () => {
    await seed(env, (db) => setDoc(doc(db, 'bc_users/alice'), privateProfile('alice')));
    await seedStats('alice', { lastDrinkAt: Timestamp.now(), day: todayUtc(), dayCount: 12 });
    const db = userDb(env, 'alice');
    const b = writeBatch(db);
    b.delete(doc(db, 'bc_userStats/alice'));
    b.delete(doc(db, 'bc_users/alice'));
    await assertSucceeds(b.commit());
  });
  it('allows reading own stats, denies reading foreign stats', async () => {
    await seedStats('alice', { lastDrinkAt: Timestamp.now(), day: todayUtc(), dayCount: 1 });
    await assertSucceeds(getDoc(doc(userDb(env, 'alice'), 'bc_userStats/alice')));
    await assertFails(getDoc(doc(userDb(env, 'bob'), 'bc_userStats/alice')));
  });
});

describe('bc_drinkVotes read / update / delete', () => {
  it('lets only the owner read a check-in (uid + position are private)', async () => {
    await seed(env, (db) => setDoc(doc(db, 'bc_drinkVotes/v1'), drinkVote('v1', 'alice')));
    await assertSucceeds(getDoc(doc(userDb(env, 'alice'), 'bc_drinkVotes/v1')));
    await assertFails(getDoc(doc(userDb(env, 'bob'), 'bc_drinkVotes/v1')));
    await assertFails(getDoc(doc(anonDb(env), 'bc_drinkVotes/v1')));
  });
  it('denies updates', async () => {
    await seed(env, (db) => setDoc(doc(db, 'bc_drinkVotes/v1'), drinkVote('v1', 'alice')));
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_drinkVotes/v1'), drinkVote('v1', 'alice', { gpsAccuracyM: 5 })));
  });
  it('allows deleting the own vote', async () => {
    await seed(env, (db) => setDoc(doc(db, 'bc_drinkVotes/v1'), drinkVote('v1', 'alice')));
    await assertSucceeds(deleteDoc(doc(userDb(env, 'alice'), 'bc_drinkVotes/v1')));
  });
  it('denies deleting a foreign, active vote', async () => {
    await seed(env, (db) => setDoc(doc(db, 'bc_drinkVotes/v1'), drinkVote('v1', 'alice')));
    await assertFails(deleteDoc(doc(userDb(env, 'bob'), 'bc_drinkVotes/v1')));
  });
  it('allows deleting a foreign, expired vote (cleanup)', async () => {
    const createdAt = Date.now() - 2 * DAY;
    await seed(env, (db) => setDoc(doc(db, 'bc_drinkVotes/v1'),
      drinkVote('v1', 'alice', { createdAt, expiresAt: createdAt + DAY })));
    await assertSucceeds(deleteDoc(doc(userDb(env, 'bob'), 'bc_drinkVotes/v1')));
  });
});

describe('bc_otrVotes (5 slots per user)', () => {
  function otr(id: string, userId: string, over: Record<string, unknown> = {}) {
    const createdAt = Date.now();
    return {
      id, userId, beerId: BEER, lat: round50(47.8), lon: round50(12.9),
      createdAt, expiresAt: createdAt + 14 * DAY, ...over,
    };
  }
  function expiredOtr(id: string, userId: string) {
    const createdAt = Date.now() - 15 * DAY;
    return otr(id, userId, { createdAt, expiresAt: createdAt + 14 * DAY });
  }

  it('allows slot alice_otr_0', async () => {
    await assertSucceeds(setDoc(doc(userDb(env, 'alice'), 'bc_otrVotes/alice_otr_0'), otr('alice_otr_0', 'alice')));
  });
  it('allows slot alice_otr_4', async () => {
    await assertSucceeds(setDoc(doc(userDb(env, 'alice'), 'bc_otrVotes/alice_otr_4'), otr('alice_otr_4', 'alice')));
  });
  it('denies slot alice_otr_7', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_otrVotes/alice_otr_7'), otr('alice_otr_7', 'alice')));
  });
  it('denies another user\'s slot id', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_otrVotes/bob_otr_0'), otr('bob_otr_0', 'alice')));
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_otrVotes/bob_otr_0'), otr('bob_otr_0', 'bob')));
  });
  it('denies coordinates off the 0.02° lattice', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_otrVotes/alice_otr_0'),
      otr('alice_otr_0', 'alice', { lat: 47.8123 })));
  });
  it('allows reusing a slot whose flag has expired', async () => {
    await seed(env, (db) => setDoc(doc(db, 'bc_otrVotes/alice_otr_1'), expiredOtr('alice_otr_1', 'alice')));
    await assertSucceeds(setDoc(doc(userDb(env, 'alice'), 'bc_otrVotes/alice_otr_1'), otr('alice_otr_1', 'alice')));
  });
  it('denies overwriting an active slot', async () => {
    await seed(env, (db) => setDoc(doc(db, 'bc_otrVotes/alice_otr_1'), otr('alice_otr_1', 'alice')));
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_otrVotes/alice_otr_1'), otr('alice_otr_1', 'alice')));
  });
  it('delete: own ✓, foreign active ✗, foreign expired ✓', async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, 'bc_otrVotes/alice_otr_0'), otr('alice_otr_0', 'alice'));
      await setDoc(doc(db, 'bc_otrVotes/alice_otr_1'), expiredOtr('alice_otr_1', 'alice'));
    });
    await assertFails(deleteDoc(doc(userDb(env, 'bob'), 'bc_otrVotes/alice_otr_0')));
    await assertSucceeds(deleteDoc(doc(userDb(env, 'bob'), 'bc_otrVotes/alice_otr_1')));
    await assertSucceeds(deleteDoc(doc(userDb(env, 'alice'), 'bc_otrVotes/alice_otr_0')));
  });
});
