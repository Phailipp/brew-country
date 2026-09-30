import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { createEnv, userDb, unverifiedDb, anonDb, seed, privateProfile } from './helpers';
import { visitDocId, venuePlayerId, hourFloor } from '../src/domain/visitIds';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env.cleanup(); });
const SALT: Record<string, string> = { alice: 'a'.repeat(64), bob: 'b'.repeat(64) };

beforeEach(async () => {
  await env.clearFirestore();
  // Players have a secret salt in their private profile
  await seed(env, async (db) => {
    await setDoc(doc(db, 'bc_users/alice'), privateProfile('alice', { visitSalt: SALT.alice }));
    await setDoc(doc(db, 'bc_users/bob'), privateProfile('bob', { visitSalt: SALT.bob }));
  });
});

const today = () => Math.floor(Date.now() / 86_400_000);

async function publicVisit(uid: string, slot: number, over: Record<string, unknown> = {}, salt = SALT[uid]) {
  const venueId = (over.venueId as string) ?? 'n123';
  return {
    id: await visitDocId(salt, (over.day as number) ?? today(), slot),
    data: {
      venueId,
      tile: '962_231',
      beerId: 'augustiner',
      alcoholFree: false,
      createdAt: hourFloor(Date.now()),
      pid: await venuePlayerId(salt, venueId),
      day: today(),
      slot,
      ...over,
    },
  };
}

/** The way the client writes: public visit + private passport entry in one batch. */
async function checkIn(db: Firestore, uid: string, slot: number, over: Record<string, unknown> = {}) {
  const v = await publicVisit(uid, slot, over);
  const batch = writeBatch(db);
  batch.set(doc(db, 'bc_venueVisits', v.id), v.data);
  batch.set(doc(db, `bc_users/${uid}/visits`, v.id), {
    venueId: v.data.venueId, venueName: 'Zum Augustiner', tile: v.data.tile, beerId: v.data.beerId,
    alcoholFree: v.data.alcoholFree, createdAt: Date.now(),
  });
  await batch.commit();
  return v.id;
}

describe('bc_venueVisits', () => {
  it('allows a verified player to check in (public + private in one batch)', async () => {
    await assertSucceeds(checkIn(userDb(env, 'alice'), 'alice', 0));
  });
  it('allows two visits per day, one per slot', async () => {
    const db = userDb(env, 'alice');
    await assertSucceeds(checkIn(db, 'alice', 0, { venueId: 'n1' }));
    await assertSucceeds(checkIn(db, 'alice', 1, { venueId: 'n2' }));
  });
  it('denies a third slot (responsible play: max 2 pubs a day)', async () => {
    await assertFails(checkIn(userDb(env, 'alice'), 'alice', 2));
  });
  it('denies ids derived from the uid instead of the secret salt', async () => {
    const v = await publicVisit('alice', 0, {}, 'alice');
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_venueVisits', v.id), v.data));
  });
  it('denies visits before a salt exists', async () => {
    await seed(env, (db) => setDoc(doc(db, 'bc_users/carol'), privateProfile('carol')));
    const v = await publicVisit('carol', 0, {}, 'c'.repeat(64));
    await assertFails(setDoc(doc(userDb(env, 'carol'), 'bc_venueVisits', v.id), v.data));
  });
  it('denies a precise (not hour-rounded) public time', async () => {
    const v = await publicVisit('alice', 0, { createdAt: Date.now() });
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_venueVisits', v.id), v.data));
  });
  it('denies reusing a slot on the same day', async () => {
    const db = userDb(env, 'alice');
    await assertSucceeds(checkIn(db, 'alice', 0, { venueId: 'n1' }));
    await assertFails(checkIn(db, 'alice', 0, { venueId: 'n2' }));
  });
  it('denies a visit id belonging to another player', async () => {
    const v = await publicVisit('bob', 0);
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_venueVisits', v.id), v.data));
  });
  it('denies a forged pseudonym', async () => {
    const v = await publicVisit('alice', 0, { pid: await venuePlayerId(SALT.bob, 'n123') });
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_venueVisits', v.id), v.data));
  });
  it('denies another day', async () => {
    const v = await publicVisit('alice', 0, { day: today() + 1 });
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_venueVisits', v.id), v.data));
  });
  it('denies a back-dated createdAt', async () => {
    const v = await publicVisit('alice', 0, { createdAt: hourFloor(Date.now()) - 2 * 3_600_000 });
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_venueVisits', v.id), v.data));
  });
  it('denies a malformed venue id and invalid beer', async () => {
    for (const over of [{ venueId: 'x1' }, { venueId: '../n1' }, { beerId: 'Bad Beer' }]) {
      const v = await publicVisit('alice', 0, over);
      await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_venueVisits', v.id), v.data));
    }
  });
  it('denies extra fields (e.g. a real user id)', async () => {
    const v = await publicVisit('alice', 0, { userId: 'alice' });
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_venueVisits', v.id), v.data));
  });
  it('denies unverified and anonymous users', async () => {
    await assertFails(checkIn(unverifiedDb(env, 'alice'), 'alice', 0));
    const v = await publicVisit('alice', 0);
    await assertFails(setDoc(doc(anonDb(env), 'bc_venueVisits', v.id), v.data));
  });
  it('denies updates', async () => {
    const db = userDb(env, 'alice');
    const id = await checkIn(db, 'alice', 0);
    await assertFails(setDoc(doc(db, 'bc_venueVisits', id), { beerId: 'paulaner' }, { merge: true }));
  });
  it('lets verified players read visits, not anonymous ones', async () => {
    await checkIn(userDb(env, 'alice'), 'alice', 0);
    await assertSucceeds(getDocs(collection(userDb(env, 'bob'), 'bc_venueVisits')));
    await assertFails(getDocs(collection(anonDb(env), 'bc_venueVisits')));
  });
  it('lets only the owner delete a visit', async () => {
    const id = await checkIn(userDb(env, 'alice'), 'alice', 0);
    await assertFails(deleteDoc(doc(userDb(env, 'bob'), 'bc_venueVisits', id)));
    await assertSucceeds(deleteDoc(doc(userDb(env, 'alice'), 'bc_venueVisits', id)));
  });
});

describe('private passport (bc_users/{uid}/visits)', () => {
  it('is readable by the owner only', async () => {
    const id = await checkIn(userDb(env, 'alice'), 'alice', 0);
    await assertSucceeds(getDoc(doc(userDb(env, 'alice'), `bc_users/alice/visits/${id}`)));
    await assertFails(getDoc(doc(userDb(env, 'bob'), `bc_users/alice/visits/${id}`)));
  });
  it('denies a passport entry without the matching public visit', async () => {
    await assertFails(setDoc(doc(userDb(env, 'alice'), 'bc_users/alice/visits/abc'), {
      venueId: 'n1', venueName: 'X', tile: '1_1', beerId: 'augustiner', alcoholFree: false, createdAt: Date.now(),
    }));
  });
  it('denies writing into another player\'s passport', async () => {
    const v = await publicVisit('bob', 0);
    await seed(env, (db) => setDoc(doc(db, 'bc_venueVisits', v.id), v.data));
    await assertFails(setDoc(doc(userDb(env, 'alice'), `bc_users/bob/visits/${v.id}`), {
      venueId: 'n123', venueName: 'X', tile: '962_231', beerId: 'augustiner', alcoholFree: false, createdAt: Date.now(),
    }));
  });
});

describe('visit salt in the private profile', () => {
  it('can be set once by the owner', async () => {
    await seed(env, (db) => setDoc(doc(db, 'bc_users/carol'), privateProfile('carol')));
    const db = userDb(env, 'carol');
    await assertSucceeds(setDoc(doc(db, 'bc_users/carol'), { visitSalt: 'c'.repeat(64) }, { merge: true }));
    await assertFails(setDoc(doc(db, 'bc_users/carol'), { visitSalt: 'd'.repeat(64) }, { merge: true }));
  });
  it('must be 64 hex chars', async () => {
    await seed(env, (db) => setDoc(doc(db, 'bc_users/carol'), privateProfile('carol')));
    await assertFails(setDoc(doc(userDb(env, 'carol'), 'bc_users/carol'), { visitSalt: 'carol' }, { merge: true }));
  });
  it('is not readable by others', async () => {
    await assertFails(getDoc(doc(userDb(env, 'bob'), 'bc_users/alice')));
  });
});
